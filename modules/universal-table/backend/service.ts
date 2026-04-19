import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { execFile } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { ConfigStore } from '../../../src/store/configStore';
import type { DataSourceConfig } from '../../../src/types';
import { fileEncryption } from '../../../src/services/fileEncryption';
import { dataMasking } from '../../../src/services/dataMasking';
import { aiProviderService } from '../../../src/services/aiProviderService';
import { dataSourceManager } from '../../datasource-management/backend/manager';
import { buildCollectionScript } from './scriptTemplate';
import { buildFieldMapping, findBestStandardTableMatch, mappingToDictionary } from './matching';
import type {
  AnalysisDatasetRecord,
  CollectionResultRecord,
  CollectionScriptRecord,
  FileProfile,
  ProjectFileRecord,
  ProjectRecord,
  StandardCategoryRecord,
  StandardColumn,
  StandardTableRecord,
  TableMatchResult,
  UniversalTableDb,
} from './types';

const execFileAsync = promisify(execFile);
const DEFAULT_CATEGORIES = ['金融数据', '通信数据', '资产数据', '人事信息', '综合资料', '其他'];

function safeJsonParse<T>(value: any, fallback: T): T {
  if (!value) {
    return fallback;
  }
  if (typeof value !== 'string') {
    return value as T;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function ensureDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function decodeOriginalName(originalName: string): string {
  try {
    return Buffer.from(originalName, 'latin1').toString('utf8');
  } catch {
    return originalName;
  }
}

function parseJsonFromText(text: string): any {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const blockMatch = trimmed.match(/```json\s*([\s\S]+?)```/i) || trimmed.match(/```([\s\S]+?)```/);
    if (blockMatch?.[1]) {
      return JSON.parse(blockMatch[1].trim());
    }

    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }

    const arrayStart = trimmed.indexOf('[');
    const arrayEnd = trimmed.lastIndexOf(']');
    if (arrayStart >= 0 && arrayEnd > arrayStart) {
      return JSON.parse(trimmed.slice(arrayStart, arrayEnd + 1));
    }

    throw new Error('AI 返回内容不是有效 JSON');
  }
}

function normalizeColumns(columns: any[], fallbacks: string[] = []): StandardColumn[] {
  const source = Array.isArray(columns) && columns.length > 0
    ? columns
    : fallbacks.map((title) => ({ title }));

  return source.map((column, index) => {
    const title = String(column?.title || column?.name || column?.label || `字段${index + 1}`).trim();
    const key = String(column?.key || column?.dataIndex || column?.name || title)
      .replace(/[^\w\u4e00-\u9fa5]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase() || `field_${index + 1}`;

    return {
      key,
      title,
      type: column?.type === 'number' || column?.type === 'date' || column?.type === 'boolean' ? column.type : 'string',
      required: Boolean(column?.required),
      aliases: Array.isArray(column?.aliases)
        ? column.aliases.map((item: any) => String(item)).filter(Boolean)
        : undefined,
    };
  });
}

function sanitizeSqlIdentifier(value: string, maxLength = 48): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');

  const ascii = normalized.replace(/[^\w]+/g, '_');
  const finalValue = ascii || 'dataset';
  return finalValue.slice(0, maxLength);
}

export class UniversalTableService {
  private db: UniversalTableDb;
  private baseDir: string;
  private tempDir: string;
  private pythonScriptPath: string;

  constructor(db: UniversalTableDb) {
    this.db = db;
    this.baseDir = path.join(process.cwd(), 'uploads', 'universal-table');
    this.tempDir = path.join(this.baseDir, 'temp');
    this.pythonScriptPath = path.join(process.cwd(), 'modules', 'universal-table', 'backend', 'python', 'desensitize.py');

    ensureDirectory(this.baseDir);
    ensureDirectory(this.tempDir);
  }

  async initTables(): Promise<void> {
    const statements = [
      `CREATE TABLE IF NOT EXISTS ut_standard_categories (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        name VARCHAR(128) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_ut_category_user_name (user_id, name)
      )`,
      `CREATE TABLE IF NOT EXISTS ut_standard_tables (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(128) DEFAULT '其他',
        columns_json LONGTEXT NOT NULL,
        header_examples_json LONGTEXT NULL,
        source VARCHAR(32) DEFAULT 'manual',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS ut_projects (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT NULL,
        status VARCHAR(32) DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS ut_project_files (
        id VARCHAR(36) PRIMARY KEY,
        project_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(64) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        file_ext VARCHAR(32) NOT NULL,
        mime_type VARCHAR(191) NULL,
        file_size BIGINT DEFAULT 0,
        original_path TEXT NOT NULL,
        masked_path TEXT NULL,
        test_path TEXT NULL,
        sample_text LONGTEXT NULL,
        headers_json LONGTEXT NULL,
        preview_rows_json LONGTEXT NULL,
        total_rows INT DEFAULT 0,
        standard_table_id VARCHAR(36) NULL,
        standard_table_name VARCHAR(255) NULL,
        classification_confidence DECIMAL(6, 3) DEFAULT 0,
        classification_status VARCHAR(32) DEFAULT 'pending',
        mask_status VARCHAR(32) DEFAULT 'pending',
        test_status VARCHAR(32) DEFAULT 'pending',
        collection_status VARCHAR(32) DEFAULT 'pending',
        latest_mapping_json LONGTEXT NULL,
        latest_script_id VARCHAR(36) NULL,
        latest_result_id VARCHAR(36) NULL,
        error_message TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS ut_collection_scripts (
        id VARCHAR(36) PRIMARY KEY,
        project_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(64) NOT NULL,
        standard_table_id VARCHAR(36) NULL,
        sample_file_id VARCHAR(36) NULL,
        name VARCHAR(255) NOT NULL,
        sample_source VARCHAR(32) DEFAULT 'masked',
        source_format VARCHAR(32) NULL,
        script_body LONGTEXT NOT NULL,
        metadata_json LONGTEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS ut_collection_results (
        id VARCHAR(36) PRIMARY KEY,
        project_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(64) NOT NULL,
        file_id VARCHAR(36) NOT NULL,
        script_id VARCHAR(36) NOT NULL,
        status VARCHAR(32) DEFAULT 'completed',
        detected_headers_json LONGTEXT NULL,
        output_headers_json LONGTEXT NULL,
        preview_rows_json LONGTEXT NULL,
        output_path TEXT NULL,
        mapping_json LONGTEXT NULL,
        mapping_status VARCHAR(32) DEFAULT 'auto',
        manual_confirmation_required TINYINT(1) DEFAULT 0,
        datasource_id VARCHAR(36) NULL,
        analysis_table_name VARCHAR(64) NULL,
        ingested_row_count INT DEFAULT 0,
        error_message TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS ut_analysis_datasets (
        id VARCHAR(36) PRIMARY KEY,
        project_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(64) NOT NULL,
        standard_table_id VARCHAR(36) NOT NULL,
        standard_table_name VARCHAR(255) NOT NULL,
        analysis_table_name VARCHAR(64) NOT NULL,
        datasource_id VARCHAR(64) NOT NULL,
        datasource_name VARCHAR(255) NOT NULL,
        last_result_id VARCHAR(36) NULL,
        row_count INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_ut_analysis_dataset (project_id, standard_table_id)
      )`,
    ];

    for (const statement of statements) {
      await this.db.execute(statement);
    }

    const alterStatements = [
      `ALTER TABLE ut_collection_results ADD COLUMN datasource_id VARCHAR(64) NULL`,
      `ALTER TABLE ut_collection_results ADD COLUMN analysis_table_name VARCHAR(64) NULL`,
      `ALTER TABLE ut_collection_results ADD COLUMN ingested_row_count INT DEFAULT 0`,
    ];

    for (const statement of alterStatements) {
      try {
        await this.db.execute(statement);
      } catch {
        // ignore duplicate column
      }
    }
  }

  private projectDir(projectId: string): string {
    return path.join(this.baseDir, 'projects', projectId);
  }

  private projectOriginalDir(projectId: string): string {
    return path.join(this.projectDir(projectId), 'originals');
  }

  private projectArtifactsDir(projectId: string, fileId: string): string {
    return path.join(this.projectDir(projectId), 'artifacts', fileId);
  }

  private projectScriptsDir(projectId: string): string {
    return path.join(this.projectDir(projectId), 'scripts');
  }

  private projectResultsDir(projectId: string): string {
    return path.join(this.projectDir(projectId), 'results');
  }

  private escapeId(identifier: string): string {
    return `\`${identifier.replace(/`/g, '``')}\``;
  }

  private datasetId(projectId: string, standardTableId: string): string {
    const projectPart = projectId.replace(/-/g, '').slice(0, 12);
    const tablePart = standardTableId.replace(/-/g, '').slice(0, 12);
    return `utds_${projectPart}_${tablePart}`.slice(0, 36);
  }

  private analysisTableName(projectId: string, standardTable: StandardTableRecord): string {
    const projectPart = sanitizeSqlIdentifier(projectId.replace(/-/g, '').slice(0, 8), 10);
    const tablePart = sanitizeSqlIdentifier(standardTable.name || standardTable.id, 30);
    return `ut_data_${projectPart}_${tablePart}`.slice(0, 64);
  }

  private analysisColumnName(column: StandardColumn): string {
    return sanitizeSqlIdentifier(column.key || column.title, 40);
  }

  private sqlTypeForColumn(column: StandardColumn): string {
    if (column.type === 'number') {
      return 'DOUBLE NULL';
    }
    if (column.type === 'boolean') {
      return 'TINYINT(1) NULL';
    }
    if (column.type === 'date') {
      return 'VARCHAR(64) NULL';
    }
    return 'LONGTEXT NULL';
  }

  private normalizeAnalysisValue(value: any, column: StandardColumn): any {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    if (column.type === 'number') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }

    if (column.type === 'boolean') {
      if (typeof value === 'boolean') {
        return value ? 1 : 0;
      }
      const text = String(value).trim().toLowerCase();
      if (['1', 'true', '是', 'yes'].includes(text)) return 1;
      if (['0', 'false', '否', 'no'].includes(text)) return 0;
      return null;
    }

    return String(value);
  }

  private async run<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const [rows] = await this.db.execute(sql, params);
    return rows as unknown as T[];
  }

  private async runOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const rows = await this.run<T>(sql, params);
    return rows[0] || null;
  }

  private async ensureAnalysisDataset(
    userId: string,
    project: ProjectRecord,
    standardTable: StandardTableRecord,
    resultId: string,
  ) {
    const analysisTableName = this.analysisTableName(project.id, standardTable);
    const datasourceId = this.datasetId(project.id, standardTable.id);
    const datasourceName = `${project.name}-${standardTable.name}-采集数据`;

    const columnsSql = standardTable.columns.map((column) => {
      const columnName = this.analysisColumnName(column);
      return `${this.escapeId(columnName)} ${this.sqlTypeForColumn(column)}`;
    });

    await this.db.execute(
      `CREATE TABLE IF NOT EXISTS ${this.escapeId(analysisTableName)} (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        dataset_row_id VARCHAR(36) NOT NULL,
        source_project_id VARCHAR(36) NOT NULL,
        source_file_id VARCHAR(36) NOT NULL,
        source_result_id VARCHAR(36) NOT NULL,
        imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        row_json JSON NULL,
        ${columnsSql.join(',\n        ')},
        INDEX idx_ut_source_file_id (source_file_id),
        INDEX idx_ut_source_result_id (source_result_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    );

    const existingColumns = await this.run<any>(`SHOW COLUMNS FROM ${this.escapeId(analysisTableName)}`);
    const existingNames = new Set(existingColumns.map((item) => item.Field));
    for (const column of standardTable.columns) {
      const columnName = this.analysisColumnName(column);
      if (!existingNames.has(columnName)) {
        await this.db.execute(
          `ALTER TABLE ${this.escapeId(analysisTableName)} ADD COLUMN ${this.escapeId(columnName)} ${this.sqlTypeForColumn(column)}`,
        );
      }
    }

    const configStore = new ConfigStore();
    const datasourceConfig: DataSourceConfig = {
      id: datasourceId,
      userId,
      name: datasourceName,
      type: 'mysql',
      visibility: 'private',
      approvalStatus: 'approved',
      datasetId: datasourceId,
      config: {
        host: process.env.CONFIG_DB_HOST || 'localhost',
        port: Number(process.env.CONFIG_DB_PORT || '3306'),
        user: process.env.CONFIG_DB_USER || 'root',
        password: process.env.CONFIG_DB_PASSWORD || '',
        database: process.env.CONFIG_DB_NAME || 'datamind',
        allowedTables: [analysisTableName],
      },
    };

    await configStore.save(datasourceConfig);
    await dataSourceManager.register(datasourceConfig);

    await this.db.execute(
      `INSERT INTO ut_analysis_datasets
       (id, project_id, user_id, standard_table_id, standard_table_name, analysis_table_name, datasource_id, datasource_name, last_result_id, row_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
       ON DUPLICATE KEY UPDATE
         standard_table_name = VALUES(standard_table_name),
         analysis_table_name = VALUES(analysis_table_name),
         datasource_id = VALUES(datasource_id),
         datasource_name = VALUES(datasource_name),
         last_result_id = VALUES(last_result_id),
         updated_at = CURRENT_TIMESTAMP`,
      [uuidv4(), project.id, userId, standardTable.id, standardTable.name, analysisTableName, datasourceId, datasourceName, resultId],
    );

    return {
      analysisTableName,
      datasourceId,
      datasourceName,
    };
  }

  private async ingestAnalysisRows(
    userId: string,
    project: ProjectRecord,
    file: ProjectFileRecord,
    standardTable: StandardTableRecord,
    resultId: string,
    records: Array<Record<string, any>>,
  ) {
    const dataset = await this.ensureAnalysisDataset(userId, project, standardTable, resultId);
    const columnMeta = standardTable.columns.map((column) => ({
      source: column.title,
      field: this.analysisColumnName(column),
      column,
    }));

    await this.db.execute(
      `DELETE FROM ${this.escapeId(dataset.analysisTableName)} WHERE source_file_id = ?`,
      [file.id],
    );

    for (const record of records) {
      const fields = ['dataset_row_id', 'source_project_id', 'source_file_id', 'source_result_id', 'row_json', ...columnMeta.map((item) => item.field)];
      const placeholders = fields.map(() => '?').join(', ');
      const values = [
        uuidv4(),
        project.id,
        file.id,
        resultId,
        JSON.stringify(record),
        ...columnMeta.map((item) => this.normalizeAnalysisValue(record[item.source], item.column)),
      ];

      await this.db.execute(
        `INSERT INTO ${this.escapeId(dataset.analysisTableName)} (${fields.map((field) => this.escapeId(field)).join(', ')}) VALUES (${placeholders})`,
        values,
      );
    }

    await this.db.execute(
      `UPDATE ut_analysis_datasets
       SET row_count = (SELECT COUNT(*) FROM ${this.escapeId(dataset.analysisTableName)}),
           last_result_id = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE project_id = ? AND standard_table_id = ?`,
      [resultId, project.id, standardTable.id],
    );

    return {
      ...dataset,
      ingestedRowCount: records.length,
    };
  }

  private mapCategoryRow(row: any): StandardCategoryRecord {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapStandardTableRow(row: any): StandardTableRecord {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      category: row.category,
      columns: normalizeColumns(safeJsonParse<any[]>(row.columns_json, [])),
      headerExamples: safeJsonParse<string[]>(row.header_examples_json, []),
      source: row.source || 'manual',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapProjectRow(row: any): ProjectRecord {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description || '',
      status: row.status || 'active',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapProjectFileRow(row: any): ProjectFileRecord {
    return {
      id: row.id,
      projectId: row.project_id,
      userId: row.user_id,
      originalName: row.original_name,
      fileExt: row.file_ext,
      mimeType: row.mime_type || '',
      fileSize: Number(row.file_size || 0),
      originalPath: row.original_path,
      maskedPath: row.masked_path,
      testPath: row.test_path,
      sampleText: row.sample_text,
      headers: safeJsonParse<string[]>(row.headers_json, []),
      previewRows: safeJsonParse<Array<Record<string, any>>>(row.preview_rows_json, []),
      totalRows: Number(row.total_rows || 0),
      standardTableId: row.standard_table_id,
      standardTableName: row.standard_table_name,
      classificationConfidence: Number(row.classification_confidence || 0),
      classificationStatus: row.classification_status || 'pending',
      maskStatus: row.mask_status || 'pending',
      testStatus: row.test_status || 'pending',
      collectionStatus: row.collection_status || 'pending',
      latestMapping: safeJsonParse<Record<string, string> | null>(row.latest_mapping_json, null),
      latestScriptId: row.latest_script_id,
      latestResultId: row.latest_result_id,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapScriptRow(row: any): CollectionScriptRecord {
    return {
      id: row.id,
      projectId: row.project_id,
      userId: row.user_id,
      standardTableId: row.standard_table_id,
      sampleFileId: row.sample_file_id,
      name: row.name,
      sampleSource: row.sample_source,
      sourceFormat: row.source_format,
      scriptBody: row.script_body,
      metadata: safeJsonParse<Record<string, any>>(row.metadata_json, {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapResultRow(row: any): CollectionResultRecord {
    return {
      id: row.id,
      projectId: row.project_id,
      userId: row.user_id,
      fileId: row.file_id,
      scriptId: row.script_id,
      status: row.status || 'completed',
      detectedHeaders: safeJsonParse<string[]>(row.detected_headers_json, []),
      outputHeaders: safeJsonParse<string[]>(row.output_headers_json, []),
      previewRows: safeJsonParse<Array<Record<string, any>>>(row.preview_rows_json, []),
      outputPath: row.output_path,
      mapping: safeJsonParse<Record<string, string> | null>(row.mapping_json, null),
      mappingStatus: row.mapping_status || 'auto',
      manualConfirmationRequired: Boolean(row.manual_confirmation_required),
      datasourceId: row.datasource_id,
      analysisTableName: row.analysis_table_name,
      ingestedRowCount: Number(row.ingested_row_count || 0),
      errorMessage: row.error_message,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapAnalysisDatasetRow(row: any): AnalysisDatasetRecord {
    return {
      id: row.id,
      projectId: row.project_id,
      userId: row.user_id,
      standardTableId: row.standard_table_id,
      standardTableName: row.standard_table_name,
      analysisTableName: row.analysis_table_name,
      datasourceId: row.datasource_id,
      datasourceName: row.datasource_name,
      lastResultId: row.last_result_id,
      rowCount: Number(row.row_count || 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private resolvePythonExecutable(): string {
    const candidates = [
      process.env.PYTHON_PATH,
      process.platform === 'win32'
        ? path.join(process.cwd(), '.venv', 'Scripts', 'python.exe')
        : path.join(process.cwd(), '.venv', 'bin', 'python'),
      process.platform === 'win32' ? 'python.exe' : 'python3',
      'python',
    ].filter(Boolean) as string[];

    return candidates[0];
  }

  private async runPythonScript(args: string[]): Promise<any> {
    const python = this.resolvePythonExecutable();
    const { stdout, stderr } = await execFileAsync(python, [this.pythonScriptPath, ...args], {
      cwd: process.cwd(),
      maxBuffer: 20 * 1024 * 1024,
    });

    const output = stdout?.trim() || stderr?.trim();
    if (!output) {
      throw new Error('Python 脚本没有返回结果');
    }

    return parseJsonFromText(output);
  }

  private async extractSpreadsheetProfile(filePath: string, originalName: string): Promise<FileProfile> {
    const workbook = XLSX.readFile(filePath, { cellDates: false });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const matrix = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: '' }) as any[][];
    const headers = (matrix[0] || []).map((cell) => String(cell || '').trim()).filter(Boolean);
    const rows = headers.length > 0
      ? XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '', raw: false })
      : [];

    return {
      originalName,
      fileExt: path.extname(originalName).toLowerCase(),
      headers,
      previewRows: rows.slice(0, 5),
      totalRows: rows.length,
      sampleText: JSON.stringify(rows.slice(0, 5), null, 2).slice(0, 4000),
      sourceFormat: path.extname(originalName).replace('.', '').toLowerCase(),
    };
  }

  private async extractTextProfile(filePath: string, originalName: string): Promise<FileProfile> {
    const text = fs.readFileSync(filePath, 'utf8');
    return {
      originalName,
      fileExt: path.extname(originalName).toLowerCase(),
      headers: [],
      previewRows: [],
      totalRows: text.split(/\r?\n/).length,
      sampleText: dataMasking.maskText(text).slice(0, 4000),
      sourceFormat: path.extname(originalName).replace('.', '').toLowerCase() || 'txt',
    };
  }

  private async extractDocxProfile(filePath: string, originalName: string): Promise<FileProfile> {
    const raw = await mammoth.extractRawText({ path: filePath });
    const text = raw.value || '';
    return {
      originalName,
      fileExt: path.extname(originalName).toLowerCase(),
      headers: [],
      previewRows: [],
      totalRows: text.split(/\r?\n/).filter(Boolean).length,
      sampleText: dataMasking.maskText(text).slice(0, 4000),
      sourceFormat: 'docx',
    };
  }

  private async extractPdfProfile(filePath: string, originalName: string): Promise<FileProfile> {
    try {
      const mod = await import('pdf-parse');
      const PDFParseClass = (mod as any).PDFParse || (mod as any).default?.PDFParse || (mod as any).default;
      if (!PDFParseClass) {
        throw new Error('PDF 解析库加载失败');
      }
      const parser = new PDFParseClass({ data: fs.readFileSync(filePath) });
      const result = await parser.getText();
      const text = result?.text || '';
      return {
        originalName,
        fileExt: path.extname(originalName).toLowerCase(),
        headers: [],
        previewRows: [],
        totalRows: text.split(/\r?\n/).filter(Boolean).length,
        sampleText: dataMasking.maskText(text).slice(0, 4000),
        sourceFormat: 'pdf',
      };
    } catch {
      return this.extractTextProfile(filePath, originalName);
    }
  }

  private async extractFileProfile(filePath: string, originalName: string): Promise<FileProfile> {
    const ext = path.extname(originalName).toLowerCase();

    if (['.xlsx', '.xls', '.csv'].includes(ext)) {
      return this.extractSpreadsheetProfile(filePath, originalName);
    }
    if (ext === '.docx') {
      return this.extractDocxProfile(filePath, originalName);
    }
    if (ext === '.pdf') {
      return this.extractPdfProfile(filePath, originalName);
    }

    return this.extractTextProfile(filePath, originalName);
  }

  private buildDeterministicStandardTable(profile: FileProfile) {
    const headers = profile.headers.length > 0 ? profile.headers : ['内容'];
    return {
      name: path.basename(profile.originalName, path.extname(profile.originalName)),
      category: '其他',
      columns: normalizeColumns([], headers),
      headerExamples: headers,
      source: 'import',
    };
  }

  private async generateStandardTablesWithAi(profiles: FileProfile[]): Promise<any[]> {
    const prompt = [
      '你是数据标准表设计助手。请根据多份文件的表头和内容摘要，输出适合建立标准表的 JSON。',
      '输出格式必须是：{"tables":[{"name":"标准表名","category":"分类","columns":[{"title":"字段名","type":"string","aliases":["别名1"]}]}]}',
      '字段 type 仅允许 string、number、date、boolean。',
      '如果多个文件属于同一类，请合并为一个标准表，并给字段补 aliases。',
      '',
      ...profiles.map((profile, index) => [
        `文件${index + 1}: ${profile.originalName}`,
        `表头: ${profile.headers.join('、') || '无明确表头'}`,
        `摘要: ${profile.sampleText.slice(0, 800) || '无摘要'}`,
      ].join('\n')),
    ].join('\n');

    const result = await aiProviderService.call({
      userId: 'system',
      temperature: 0.1,
      maxTokens: 3000,
      messages: [
        { role: 'system', content: '你输出的内容必须是可解析 JSON，不要添加说明文字。' },
        { role: 'user', content: prompt },
      ],
    });

    if (!result.success || !result.content) {
      throw new Error(result.error || 'AI 批量识别标准表失败');
    }

    const parsed = parseJsonFromText(result.content);
    return Array.isArray(parsed?.tables) ? parsed.tables : [];
  }

  private buildRuleSensitivePlan(file: ProjectFileRecord) {
    return {
      fields: file.headers
        .map((header) => {
          const type = dataMasking.isSensitiveField(header);
          return type
            ? { field: header, sensitiveType: type, confidence: 0.9, reason: '根据字段名规则识别' }
            : null;
        })
        .filter(Boolean),
      textTypes: [],
    };
  }

  private async buildAiSensitivePlan(file: ProjectFileRecord) {
    const prompt = [
      '你是文件脱敏助手。请根据字段名和摘要判断哪些字段属于敏感信息，并输出 JSON。',
      '输出格式必须是：{"fields":[{"field":"字段名","sensitiveType":"name","confidence":0.9,"reason":"原因"}],"textTypes":["phone"]}',
      'sensitiveType 仅允许 idCard、phone、name、address、email、bankCard、password。',
      `字段列表: ${file.headers.join('、') || '无明确表头'}`,
      `内容摘要: ${dataMasking.maskText(file.sampleText || '').slice(0, 1500) || '无摘要'}`,
    ].join('\n');

    const result = await aiProviderService.call({
      userId: file.userId,
      temperature: 0.1,
      maxTokens: 1500,
      messages: [
        { role: 'system', content: '你输出的内容必须是 JSON，不要解释。' },
        { role: 'user', content: prompt },
      ],
    });

    if (!result.success || !result.content) {
      return this.buildRuleSensitivePlan(file);
    }

    try {
      return parseJsonFromText(result.content) || this.buildRuleSensitivePlan(file);
    } catch {
      return this.buildRuleSensitivePlan(file);
    }
  }

  private async refineClassificationWithAi(file: ProjectFileRecord, tables: StandardTableRecord[]): Promise<TableMatchResult | null> {
    if (tables.length === 0) {
      return null;
    }

    const prompt = [
      '你是文件分类助手。请从候选标准表中选出最适合当前文件的一张，或者返回 null。',
      '输出格式必须是：{"standardTableId":"id或null","confidence":0.82,"reason":"原因"}',
      `文件名: ${file.originalName}`,
      `表头: ${file.headers.join('、') || '无明确表头'}`,
      `内容摘要: ${(file.sampleText || '').slice(0, 1200) || '无摘要'}`,
      '',
      ...tables.map((table) => `候选 ${table.id}: ${table.name} / ${table.category} / 字段: ${table.columns.map((col) => col.title).join('、')}`),
    ].join('\n');

    const result = await aiProviderService.call({
      userId: file.userId,
      temperature: 0.1,
      maxTokens: 1000,
      messages: [
        { role: 'system', content: '你输出的内容必须是 JSON。' },
        { role: 'user', content: prompt },
      ],
    });

    if (!result.success || !result.content) {
      return null;
    }

    try {
      const parsed = parseJsonFromText(result.content);
      const matchedTable = tables.find((table) => table.id === parsed?.standardTableId);
      if (!matchedTable) {
        return null;
      }
      const mapping = buildFieldMapping(file.headers, matchedTable.columns);
      return {
        standardTableId: matchedTable.id,
        standardTableName: matchedTable.name,
        confidence: Number(parsed.confidence || 0),
        coverage: matchedTable.columns.length === 0 ? 0 : mapping.length / matchedTable.columns.length,
        mapping,
        needsConfirm: Number(parsed.confidence || 0) < 0.9,
      };
    } catch {
      return null;
    }
  }

  private async refineMappingWithAi(file: ProjectFileRecord, table: StandardTableRecord, mapping: any[]) {
    const prompt = [
      '你是表头映射助手。请根据文件表头、样例内容和标准表字段，补充更准确的映射建议与抽取提示。',
      '输出格式必须是：{"mapping":{"源表头":"标准字段"},"hints":["需要提取的字段关键词"]}',
      `文件名: ${file.originalName}`,
      `文件表头: ${file.headers.join('、') || '无表头'}`,
      `文件摘要: ${(file.sampleText || '').slice(0, 1200)}`,
      `标准表: ${table.name}`,
      `标准字段: ${table.columns.map((col) => col.title).join('、')}`,
      `现有建议: ${JSON.stringify(mapping)}`,
    ].join('\n');

    const result = await aiProviderService.call({
      userId: file.userId,
      temperature: 0.1,
      maxTokens: 1400,
      messages: [
        { role: 'system', content: '只输出 JSON。' },
        { role: 'user', content: prompt },
      ],
    });

    if (!result.success || !result.content) {
      return null;
    }

    try {
      return parseJsonFromText(result.content);
    } catch {
      return null;
    }
  }

  private async ensureProjectOwner(userId: string, projectId: string): Promise<ProjectRecord> {
    const row = await this.runOne<any>('SELECT * FROM ut_projects WHERE id = ? AND user_id = ?', [projectId, userId]);
    if (!row) {
      throw new Error('项目不存在或无权限访问');
    }

    return this.mapProjectRow(row);
  }

  private async ensureFileOwner(userId: string, fileId: string): Promise<ProjectFileRecord> {
    const row = await this.runOne<any>('SELECT * FROM ut_project_files WHERE id = ? AND user_id = ?', [fileId, userId]);
    if (!row) {
      throw new Error('文件不存在或无权限访问');
    }

    return this.mapProjectFileRow(row);
  }

  private async ensureScriptOwner(userId: string, scriptId: string): Promise<CollectionScriptRecord> {
    const row = await this.runOne<any>('SELECT * FROM ut_collection_scripts WHERE id = ? AND user_id = ?', [scriptId, userId]);
    if (!row) {
      throw new Error('脚本不存在或无权限访问');
    }

    return this.mapScriptRow(row);
  }

  async listCategories(userId: string): Promise<StandardCategoryRecord[]> {
    const rows = await this.run<any>('SELECT * FROM ut_standard_categories WHERE user_id = ? ORDER BY name ASC', [userId]);
    const categories = rows.map((row) => this.mapCategoryRow(row));
    const known = new Set(categories.map((item) => item.name));

    for (const name of DEFAULT_CATEGORIES) {
      if (!known.has(name)) {
        categories.unshift({ id: `builtin-${name}`, userId, name });
      }
    }

    return categories.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  }

  async createCategory(userId: string, name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('分类名称不能为空');
    }

    await this.db.execute(
      `INSERT INTO ut_standard_categories (id, user_id, name) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`,
      [uuidv4(), userId, trimmed],
    );
  }

  async deleteCategory(userId: string, name: string): Promise<void> {
    await this.db.execute('DELETE FROM ut_standard_categories WHERE user_id = ? AND name = ?', [userId, name]);
  }

  async listStandardTables(userId: string): Promise<StandardTableRecord[]> {
    const rows = await this.run<any>('SELECT * FROM ut_standard_tables WHERE user_id = ? ORDER BY updated_at DESC', [userId]);
    return rows.map((row) => this.mapStandardTableRow(row));
  }

  async saveStandardTable(
    userId: string,
    payload: Partial<StandardTableRecord> & { name: string; columns: StandardColumn[] },
  ): Promise<StandardTableRecord> {
    const id = payload.id || uuidv4();
    const category = payload.category?.trim() || '其他';
    await this.createCategory(userId, category);

    await this.db.execute(
      `INSERT INTO ut_standard_tables
       (id, user_id, name, category, columns_json, header_examples_json, source)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         category = VALUES(category),
         columns_json = VALUES(columns_json),
         header_examples_json = VALUES(header_examples_json),
         source = VALUES(source),
         updated_at = CURRENT_TIMESTAMP`,
      [
        id,
        userId,
        payload.name.trim(),
        category,
        JSON.stringify(normalizeColumns(payload.columns)),
        JSON.stringify(payload.headerExamples || payload.columns.map((column) => column.title)),
        payload.source || 'manual',
      ],
    );

    const table = await this.runOne<any>('SELECT * FROM ut_standard_tables WHERE id = ?', [id]);
    if (!table) {
      throw new Error('保存标准表失败');
    }
    return this.mapStandardTableRow(table);
  }

  async deleteStandardTable(userId: string, id: string): Promise<void> {
    await this.db.execute('DELETE FROM ut_standard_tables WHERE id = ? AND user_id = ?', [id, userId]);
  }

  async importStandardTableDrafts(userId: string, files: Express.Multer.File[], mode: 'rule' | 'ai' = 'rule') {
    const profiles: FileProfile[] = [];

    try {
      for (const file of files) {
        profiles.push(await this.extractFileProfile(file.path, decodeOriginalName(file.originalname)));
      }

      if (mode === 'ai') {
        try {
          const aiTables = await this.generateStandardTablesWithAi(profiles);
          if (aiTables.length > 0) {
            return aiTables.map((table) => ({
              name: table.name,
              category: table.category || '其他',
              columns: normalizeColumns(table.columns || []),
              headerExamples: (table.columns || []).map((item: any) => item.title).filter(Boolean),
              source: 'ai-import',
            }));
          }
        } catch {
          // fallback below
        }
      }

      return profiles.map((profile) => this.buildDeterministicStandardTable(profile));
    } finally {
      files.forEach((file) => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }
  }

  async listProjects(userId: string): Promise<ProjectRecord[]> {
    const rows = await this.run<any>('SELECT * FROM ut_projects WHERE user_id = ? ORDER BY updated_at DESC', [userId]);
    return rows.map((row) => this.mapProjectRow(row));
  }

  async createProject(userId: string, payload: { name: string; description?: string }): Promise<ProjectRecord> {
    if (!payload.name?.trim()) {
      throw new Error('项目名称不能为空');
    }

    const id = uuidv4();
    await this.db.execute(
      'INSERT INTO ut_projects (id, user_id, name, description) VALUES (?, ?, ?, ?)',
      [id, userId, payload.name.trim(), payload.description?.trim() || null],
    );

    ensureDirectory(this.projectOriginalDir(id));
    ensureDirectory(this.projectScriptsDir(id));
    ensureDirectory(this.projectResultsDir(id));

    const row = await this.runOne<any>('SELECT * FROM ut_projects WHERE id = ?', [id]);
    if (!row) {
      throw new Error('创建项目失败');
    }

    return this.mapProjectRow(row);
  }

  async updateProject(userId: string, projectId: string, payload: { name?: string; description?: string; status?: string }) {
    await this.ensureProjectOwner(userId, projectId);

    await this.db.execute(
      `UPDATE ut_projects
       SET name = COALESCE(?, name),
           description = COALESCE(?, description),
           status = COALESCE(?, status),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [
        payload.name?.trim() || null,
        payload.description?.trim() || null,
        payload.status || null,
        projectId,
        userId,
      ],
    );

    const row = await this.runOne<any>('SELECT * FROM ut_projects WHERE id = ?', [projectId]);
    return row ? this.mapProjectRow(row) : null;
  }

  async deleteProject(userId: string, projectId: string): Promise<void> {
    await this.ensureProjectOwner(userId, projectId);

    await this.db.execute('DELETE FROM ut_collection_results WHERE project_id = ? AND user_id = ?', [projectId, userId]);
    await this.db.execute('DELETE FROM ut_collection_scripts WHERE project_id = ? AND user_id = ?', [projectId, userId]);
    await this.db.execute('DELETE FROM ut_project_files WHERE project_id = ? AND user_id = ?', [projectId, userId]);
    await this.db.execute('DELETE FROM ut_projects WHERE id = ? AND user_id = ?', [projectId, userId]);

    const resolved = path.resolve(this.projectDir(projectId));
    if (resolved.startsWith(path.resolve(this.baseDir)) && fs.existsSync(resolved)) {
      fs.rmSync(resolved, { recursive: true, force: true });
    }
  }

  async listProjectFiles(userId: string, projectId: string): Promise<ProjectFileRecord[]> {
    await this.ensureProjectOwner(userId, projectId);
    const rows = await this.run<any>(
      'SELECT * FROM ut_project_files WHERE project_id = ? AND user_id = ? ORDER BY created_at DESC',
      [projectId, userId],
    );
    return rows.map((row) => this.mapProjectFileRow(row));
  }

  async uploadProjectFiles(userId: string, projectId: string, files: Express.Multer.File[]) {
    await this.ensureProjectOwner(userId, projectId);
    ensureDirectory(this.projectOriginalDir(projectId));

    const inserted: ProjectFileRecord[] = [];
    for (const file of files) {
      const originalName = decodeOriginalName(file.originalname);
      const profile = await this.extractFileProfile(file.path, originalName);
      const fileId = uuidv4();
      const ext = path.extname(originalName).toLowerCase() || '.dat';
      const encryptedPath = path.join(this.projectOriginalDir(projectId), `${fileId}${ext}.enc`);

      await fileEncryption.encryptFile(file.path, encryptedPath);
      await this.db.execute(
        `INSERT INTO ut_project_files
         (id, project_id, user_id, original_name, file_ext, mime_type, file_size, original_path, sample_text, headers_json, preview_rows_json, total_rows)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          fileId,
          projectId,
          userId,
          originalName,
          profile.fileExt.replace('.', '') || 'dat',
          file.mimetype || null,
          file.size || 0,
          encryptedPath,
          profile.sampleText,
          JSON.stringify(profile.headers),
          JSON.stringify(profile.previewRows),
          profile.totalRows,
        ],
      );

      const row = await this.runOne<any>('SELECT * FROM ut_project_files WHERE id = ?', [fileId]);
      if (row) {
        inserted.push(this.mapProjectFileRow(row));
      }
    }

    return inserted;
  }

  async classifyProjectFiles(userId: string, projectId: string, mode: 'rule' | 'ai' = 'rule') {
    const files = await this.listProjectFiles(userId, projectId);
    const tables = await this.listStandardTables(userId);

    for (const file of files) {
      let match = findBestStandardTableMatch(file.headers, tables, file.sampleText || '');

      if ((mode === 'ai' || match.confidence < 0.7) && tables.length > 0) {
        const aiMatch = await this.refineClassificationWithAi(file, tables);
        if (aiMatch && aiMatch.confidence >= match.confidence) {
          match = aiMatch;
        }
      }

      const status = !match.standardTableId
        ? 'unmatched'
        : match.needsConfirm || match.confidence < 0.9
          ? 'needs_confirm'
          : 'matched';

      await this.db.execute(
        `UPDATE ut_project_files
         SET standard_table_id = ?, standard_table_name = ?, classification_confidence = ?, classification_status = ?, latest_mapping_json = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ?`,
        [
          match.standardTableId,
          match.standardTableName,
          match.confidence,
          status,
          JSON.stringify(mappingToDictionary(match.mapping)),
          file.id,
          userId,
        ],
      );
    }

    return this.listProjectFiles(userId, projectId);
  }

  async assignProjectFile(userId: string, fileId: string, standardTableId: string | null) {
    const file = await this.ensureFileOwner(userId, fileId);
    let table: StandardTableRecord | null = null;

    if (standardTableId) {
      const row = await this.runOne<any>('SELECT * FROM ut_standard_tables WHERE id = ? AND user_id = ?', [standardTableId, userId]);
      if (!row) {
        throw new Error('标准表不存在');
      }
      table = this.mapStandardTableRow(row);
    }

    await this.db.execute(
      `UPDATE ut_project_files
       SET standard_table_id = ?, standard_table_name = ?, classification_status = ?, classification_confidence = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [table?.id || null, table?.name || null, table ? 'matched' : 'pending', table ? 1 : 0, file.id, userId],
    );

    return this.ensureFileOwner(userId, fileId);
  }

  private createArtifactPath(projectId: string, fileId: string, originalName: string, suffix: 'masked' | 'test') {
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext).replace(/[^\w\u4e00-\u9fa5\-]+/g, '_');
    const dir = this.projectArtifactsDir(projectId, fileId);
    ensureDirectory(dir);
    return path.join(dir, `${baseName}__${suffix}${ext}`);
  }

  async generateMaskedFile(userId: string, fileId: string, mode: 'rule' | 'ai' = 'rule') {
    const file = await this.ensureFileOwner(userId, fileId);
    const tempInput = fileEncryption.decryptFileToTemp(file.originalPath);
    const outputPath = this.createArtifactPath(file.projectId, file.id, file.originalName, 'masked');

    try {
      const plan = mode === 'ai' ? await this.buildAiSensitivePlan(file) : this.buildRuleSensitivePlan(file);
      const result = await this.runPythonScript([
        '--action', 'mask',
        '--input', tempInput,
        '--output', outputPath,
        '--mode', mode,
        '--plan-json', JSON.stringify(plan),
      ]);

      await this.db.execute(
        `UPDATE ut_project_files
         SET masked_path = ?, mask_status = 'completed', error_message = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ?`,
        [result.outputPath || outputPath, file.id, userId],
      );
    } catch (error: any) {
      await this.db.execute(
        `UPDATE ut_project_files SET mask_status = 'failed', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
        [error.message, file.id, userId],
      );
      throw error;
    } finally {
      fileEncryption.cleanupTempFile(tempInput);
    }

    return this.ensureFileOwner(userId, fileId);
  }

  async generateTestData(userId: string, fileId: string, options?: { count?: number; mode?: 'rule' | 'ai' }) {
    const file = await this.ensureFileOwner(userId, fileId);
    const tempInput = fileEncryption.decryptFileToTemp(file.originalPath);
    const outputPath = this.createArtifactPath(file.projectId, file.id, file.originalName, 'test');

    try {
      const table = file.standardTableId
        ? await this.runOne<any>('SELECT * FROM ut_standard_tables WHERE id = ? AND user_id = ?', [file.standardTableId, userId])
        : null;
      const schemaColumns = table
        ? this.mapStandardTableRow(table).columns
        : normalizeColumns([], file.headers.length > 0 ? file.headers : ['内容']);
      const plan = options?.mode === 'ai' ? await this.buildAiSensitivePlan(file) : this.buildRuleSensitivePlan(file);

      const result = await this.runPythonScript([
        '--action', 'testdata',
        '--input', tempInput,
        '--output', outputPath,
        '--count', String(options?.count || Math.min(Math.max(file.totalRows || 10, 5), 30)),
        '--plan-json', JSON.stringify(plan),
        '--schema-json', JSON.stringify(schemaColumns),
      ]);

      await this.db.execute(
        `UPDATE ut_project_files
         SET test_path = ?, test_status = 'completed', error_message = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ?`,
        [result.outputPath || outputPath, file.id, userId],
      );
    } catch (error: any) {
      await this.db.execute(
        `UPDATE ut_project_files SET test_status = 'failed', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
        [error.message, file.id, userId],
      );
      throw error;
    } finally {
      fileEncryption.cleanupTempFile(tempInput);
    }

    return this.ensureFileOwner(userId, fileId);
  }

  async prepareGroupSamples(userId: string, projectId: string) {
    const files = await this.listProjectFiles(userId, projectId);
    const grouped = new Map<string, ProjectFileRecord>();
    for (const file of files) {
      if (file.standardTableId && !grouped.has(file.standardTableId)) {
        grouped.set(file.standardTableId, file);
      }
    }

    const results = [];
    for (const sampleFile of grouped.values()) {
      const masked = await this.generateMaskedFile(userId, sampleFile.id, 'ai');
      const testData = await this.generateTestData(userId, sampleFile.id, { mode: 'ai' });
      results.push({
        standardTableId: sampleFile.standardTableId,
        standardTableName: sampleFile.standardTableName,
        sampleFileId: sampleFile.id,
        maskedPath: masked.maskedPath,
        testPath: testData.testPath,
      });
    }
    return results;
  }

  private async buildSampleProfileForScript(file: ProjectFileRecord, sampleSource: 'masked' | 'test' | 'original'): Promise<FileProfile> {
    if (sampleSource === 'masked' && file.maskedPath && fs.existsSync(file.maskedPath)) {
      return this.extractFileProfile(file.maskedPath, path.basename(file.maskedPath));
    }
    if (sampleSource === 'test' && file.testPath && fs.existsSync(file.testPath)) {
      return this.extractFileProfile(file.testPath, path.basename(file.testPath));
    }

    const tempInput = fileEncryption.decryptFileToTemp(file.originalPath);
    try {
      return await this.extractFileProfile(tempInput, file.originalName);
    } finally {
      fileEncryption.cleanupTempFile(tempInput);
    }
  }

  async generateCollectionScript(userId: string, payload: { projectId: string; standardTableId?: string; sampleFileId: string; sampleSource: 'masked' | 'test' | 'original'; useAi?: boolean; name?: string; }) {
    await this.ensureProjectOwner(userId, payload.projectId);
    const file = await this.ensureFileOwner(userId, payload.sampleFileId);
    const tableId = payload.standardTableId || file.standardTableId;
    if (!tableId) {
      throw new Error('请先为文件匹配标准表');
    }

    const tableRow = await this.runOne<any>('SELECT * FROM ut_standard_tables WHERE id = ? AND user_id = ?', [tableId, userId]);
    if (!tableRow) {
      throw new Error('标准表不存在');
    }
    const table = this.mapStandardTableRow(tableRow);
    const sampleProfile = await this.buildSampleProfileForScript(file, payload.sampleSource);
    const mapping = buildFieldMapping(sampleProfile.headers, table.columns);
    let mappingDict = mappingToDictionary(mapping);
    let hints = table.columns.map((column) => column.title);

    if (payload.useAi) {
      const aiRefinement = await this.refineMappingWithAi(file, table, mapping);
      if (aiRefinement?.mapping && typeof aiRefinement.mapping === 'object') {
        mappingDict = { ...mappingDict, ...aiRefinement.mapping };
      }
      if (Array.isArray(aiRefinement?.hints)) {
        hints = aiRefinement.hints.map((item: any) => String(item)).filter(Boolean);
      }
    }

    const finalMapping = Object.entries(mappingDict).map(([sourceHeader, standardField]) => ({
      sourceHeader,
      standardField,
      confidence: 1,
      reason: '脚本使用映射字典',
      exact: sampleProfile.headers.includes(sourceHeader) && table.columns.some((column) => column.title === standardField),
    }));
    const scriptBody = buildCollectionScript({
      projectName: payload.projectId,
      standardTableName: table.name,
      sampleFileName: file.originalName,
      sourceFormat: sampleProfile.sourceFormat,
      standardFields: table.columns,
      mapping: finalMapping,
      extractionHints: hints,
    });

    const scriptId = uuidv4();
    const scriptPath = path.join(this.projectScriptsDir(payload.projectId), `${scriptId}.py`);
    ensureDirectory(path.dirname(scriptPath));
    fs.writeFileSync(scriptPath, scriptBody, 'utf8');

    await this.db.execute(
      `INSERT INTO ut_collection_scripts
       (id, project_id, user_id, standard_table_id, sample_file_id, name, sample_source, source_format, script_body, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        scriptId,
        payload.projectId,
        userId,
        table.id,
        file.id,
        payload.name?.trim() || `${table.name} 采集脚本`,
        payload.sampleSource,
        sampleProfile.sourceFormat,
        scriptBody,
        JSON.stringify({ scriptPath, mapping: mappingDict, sourceHeaders: sampleProfile.headers, extractionHints: hints, sampleSource: payload.sampleSource }),
      ],
    );

    await this.db.execute('UPDATE ut_project_files SET latest_script_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?', [scriptId, file.id, userId]);
    const row = await this.runOne<any>('SELECT * FROM ut_collection_scripts WHERE id = ?', [scriptId]);
    return row ? this.mapScriptRow(row) : null;
  }

  async listScripts(userId: string, projectId: string) {
    await this.ensureProjectOwner(userId, projectId);
    const rows = await this.run<any>('SELECT * FROM ut_collection_scripts WHERE project_id = ? AND user_id = ? ORDER BY updated_at DESC', [projectId, userId]);
    return rows.map((row) => this.mapScriptRow(row));
  }

  async getScript(userId: string, scriptId: string) {
    return this.ensureScriptOwner(userId, scriptId);
  }

  async runCollectionScript(userId: string, scriptId: string, fileIds?: string[]) {
    const script = await this.ensureScriptOwner(userId, scriptId);
    const project = await this.ensureProjectOwner(userId, script.projectId);
    const scriptPath = script.metadata?.scriptPath as string;
    if (!scriptPath || !fs.existsSync(scriptPath)) {
      throw new Error('脚本文件不存在，请重新生成');
    }

    const tableRow = script.standardTableId
      ? await this.runOne<any>('SELECT * FROM ut_standard_tables WHERE id = ? AND user_id = ?', [script.standardTableId, userId])
      : null;
    if (!tableRow) {
      throw new Error('标准表不存在');
    }
    const standardTable = this.mapStandardTableRow(tableRow);
    const files = fileIds?.length
      ? await Promise.all(fileIds.map((fileId) => this.ensureFileOwner(userId, fileId)))
      : (await this.listProjectFiles(userId, script.projectId)).filter((file) => !script.standardTableId || file.standardTableId === script.standardTableId);

    for (const file of files) {
      const tempInput = fileEncryption.decryptFileToTemp(file.originalPath);
      const resultId = uuidv4();
      const outputPath = path.join(this.projectResultsDir(script.projectId), `${resultId}.json`);
      ensureDirectory(path.dirname(outputPath));

      try {
        const python = this.resolvePythonExecutable();
        await execFileAsync(python, [scriptPath, '--input', tempInput, '--output', outputPath], {
          cwd: process.cwd(),
          maxBuffer: 20 * 1024 * 1024,
        });

        const payload = safeJsonParse<any>(fs.readFileSync(outputPath, 'utf8'), {});
        const outputHeaders = Array.isArray(payload.headers)
          ? payload.headers.map((header: any) => String(header))
          : Object.keys((payload.previewRows && payload.previewRows[0]) || {});
        const mapping = buildFieldMapping(outputHeaders, standardTable.columns);
        const coverage = standardTable.columns.length === 0 ? 0 : mapping.length / standardTable.columns.length;
        const autoMapped = mapping.every((item) => item.exact) && coverage >= 1;
        const dataset = await this.ingestAnalysisRows(
          userId,
          project,
          file,
          standardTable,
          resultId,
          Array.isArray(payload.records) ? payload.records : [],
        );

        await this.db.execute(
          `INSERT INTO ut_collection_results
           (id, project_id, user_id, file_id, script_id, status, detected_headers_json, output_headers_json, preview_rows_json, output_path, mapping_json, mapping_status, manual_confirmation_required, datasource_id, analysis_table_name, ingested_row_count)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            resultId,
            script.projectId,
            userId,
            file.id,
            script.id,
            'completed',
            JSON.stringify(file.headers),
            JSON.stringify(outputHeaders),
            JSON.stringify(payload.previewRows || []),
            outputPath,
            JSON.stringify(mappingToDictionary(mapping)),
            autoMapped ? 'auto' : 'needs_confirm',
            autoMapped ? 0 : 1,
            dataset.datasourceId,
            dataset.analysisTableName,
            dataset.ingestedRowCount,
          ],
        );

        await this.db.execute(
          `UPDATE ut_project_files
           SET latest_result_id = ?, latest_mapping_json = ?, collection_status = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND user_id = ?`,
          [resultId, JSON.stringify(mappingToDictionary(mapping)), autoMapped ? 'completed' : 'needs_confirm', file.id, userId],
        );
      } catch (error: any) {
        await this.db.execute(
          `INSERT INTO ut_collection_results
           (id, project_id, user_id, file_id, script_id, status, detected_headers_json, output_headers_json, preview_rows_json, output_path, mapping_json, mapping_status, manual_confirmation_required, error_message)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [resultId, script.projectId, userId, file.id, script.id, 'failed', JSON.stringify(file.headers), JSON.stringify([]), JSON.stringify([]), null, JSON.stringify({}), 'failed', 0, error.message],
        );

        await this.db.execute('UPDATE ut_project_files SET latest_result_id = ?, collection_status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?', [resultId, 'failed', error.message, file.id, userId]);
      } finally {
        fileEncryption.cleanupTempFile(tempInput);
      }
    }

    const rows = await this.run<any>('SELECT * FROM ut_collection_results WHERE script_id = ? AND user_id = ? ORDER BY created_at DESC', [script.id, userId]);
    return rows.map((row) => this.mapResultRow(row));
  }

  async listResults(userId: string, projectId: string) {
    await this.ensureProjectOwner(userId, projectId);
    const rows = await this.run<any>('SELECT * FROM ut_collection_results WHERE project_id = ? AND user_id = ? ORDER BY created_at DESC', [projectId, userId]);
    return rows.map((row) => this.mapResultRow(row));
  }

  async listAnalysisDatasets(userId: string, projectId: string) {
    await this.ensureProjectOwner(userId, projectId);
    const rows = await this.run<any>(
      'SELECT * FROM ut_analysis_datasets WHERE project_id = ? AND user_id = ? ORDER BY updated_at DESC',
      [projectId, userId],
    );
    return rows.map((row) => this.mapAnalysisDatasetRow(row));
  }

  async confirmResultMapping(userId: string, resultId: string, mapping: Record<string, string>) {
    const row = await this.runOne<any>('SELECT * FROM ut_collection_results WHERE id = ? AND user_id = ?', [resultId, userId]);
    if (!row) {
      throw new Error('结果不存在或无权限访问');
    }

    await this.db.execute('UPDATE ut_collection_results SET mapping_json = ?, mapping_status = ?, manual_confirmation_required = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?', [JSON.stringify(mapping), 'confirmed', resultId, userId]);
    await this.db.execute('UPDATE ut_project_files SET latest_mapping_json = ?, collection_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?', [JSON.stringify(mapping), 'completed', row.file_id, userId]);

    const refreshed = await this.runOne<any>('SELECT * FROM ut_collection_results WHERE id = ?', [resultId]);
    return refreshed ? this.mapResultRow(refreshed) : null;
  }

  async getArtifactDownload(userId: string, fileId: string, kind: 'masked' | 'test') {
    const file = await this.ensureFileOwner(userId, fileId);
    const targetPath = kind === 'masked' ? file.maskedPath : file.testPath;
    if (!targetPath || !fs.existsSync(targetPath)) {
      throw new Error('文件尚未生成');
    }

    return {
      filePath: targetPath,
      fileName: path.basename(targetPath),
    };
  }
}
