/**
 * 文件工具服务
 */

import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import { pathToFileURL } from 'url';
import type {
  FileFormat,
  ConversionConfig,
  ConversionHistory,
  ConversionRequest,
  ConversionResponse,
  HistoryQueryParams,
  HistoryQueryResult,
  FileToolsConfig
} from './types';

export class FileToolsService {
  private uploadDir: string;
  private config: FileToolsConfig;
  private db: any;

  constructor(db: any, config?: Partial<FileToolsConfig>) {
    this.db = db;
    this.config = {
      maxFileSize: 100 * 1024 * 1024, // 100MB
      allowedFormats: ['word', 'excel', 'image', 'pdf', 'txt', 'csv', 'json'],
      uploadDir: path.join(process.cwd(), 'uploads', 'file-tools'),
      tempDir: path.join(process.cwd(), 'uploads', 'temp'),
      retentionDays: 7,
      enableHistory: true,
      ...config
    };
    
    this.uploadDir = this.config.uploadDir;
    this.ensureDirectories();
  }

  /**
   * 确保目录存在
   */
  private ensureDirectories(): void {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
    if (!fs.existsSync(this.config.tempDir)) {
      fs.mkdirSync(this.config.tempDir, { recursive: true });
    }
  }

  /**
   * 文件格式转换
   */
  async convertFiles(request: ConversionRequest, userId: string): Promise<ConversionResponse> {
    const { files, sourceFormat, targetFormat, options } = request;

    if (!files || files.length === 0) {
      throw new Error('请上传文件');
    }

    if (!sourceFormat || !targetFormat) {
      throw new Error('请指定源格式和目标格式');
    }

    const results: string[] = [];
    const historyId = uuidv4();

    // 创建历史记录
    if (this.config.enableHistory) {
      await this.createHistory({
        id: historyId,
        userId,
        sourceFormat,
        targetFormat,
        originalFilename: files[0].originalname,
        fileSize: files[0].size,
        status: 'processing',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }

    try {
      for (const file of files) {
        const outputPath = await this.convertFile(file, sourceFormat, targetFormat, options);
        results.push(outputPath);
        
        // 清理源文件
        this.cleanupFile(file.path);
      }

      if (results.length === 0) {
        throw new Error('转换过程未生成任何结果');
      }

      const finalFile = results[0];
      const fileId = path.basename(finalFile);
      const originalName = files[0].originalname;
      const nameWithoutExt = path.parse(originalName).name;
      const outputExt = this.getOutputExtension(targetFormat);
      const safeName = `${nameWithoutExt}_converted.${outputExt}`;

      // 更新历史记录
      if (this.config.enableHistory) {
        await this.updateHistory(historyId, {
          status: 'success',
          resultFilename: safeName,
          updatedAt: Date.now()
        });
      }

      return {
        success: true,
        fileId,
        safeName,
        message: '转换完成，请下载'
      };
    } catch (error: any) {
      // 更新历史记录为失败
      if (this.config.enableHistory) {
        await this.updateHistory(historyId, {
          status: 'failed',
          errorMessage: error.message,
          updatedAt: Date.now()
        });
      }

      throw error;
    }
  }

  /**
   * 转换单个文件
   */
  private async convertFile(
    file: Express.Multer.File,
    sourceFormat: FileFormat,
    targetFormat: FileFormat,
    options?: ConversionConfig['options']
  ): Promise<string> {
    const outputExt = this.getOutputExtension(targetFormat);
    const outputPath = path.join(this.uploadDir, `${uuidv4()}.${outputExt}`);

    // PDF 转文本
    if (sourceFormat === 'pdf' && targetFormat === 'txt') {
      return await this.convertPdfToText(file.path, outputPath);
    }
    
    // CSV 转 Excel
    if (sourceFormat === 'csv' && targetFormat === 'excel') {
      return await this.convertCsvToExcel(file.path, outputPath);
    }
    
    // JSON 转 Excel
    if (sourceFormat === 'json' && targetFormat === 'excel') {
      return await this.convertJsonToExcel(file.path, outputPath);
    }
    
    // 默认：直接复制
    fs.copyFileSync(file.path, outputPath);
    return outputPath;
  }

  /**
   * PDF 转文本
   */
  private async convertPdfToText(inputPath: string, outputPath: string): Promise<string> {
    try {
      const mod = await import('pdf-parse');
      const PDFParseClass = mod.PDFParse || (mod.default as any)?.PDFParse || mod.default;

      if (!PDFParseClass) {
        throw new Error('PDF解析库加载失败');
      }

      const dataBuffer = fs.readFileSync(inputPath);
      const cMapPath = path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'cmaps/');
      const cMapUrl = pathToFileURL(cMapPath).href;

      const parser = new PDFParseClass({
        data: dataBuffer,
        cMapUrl: cMapUrl,
        cMapPacked: true
      });

      const textResult = await parser.getText();
      const text = textResult.text || '';

      // 添加 BOM 解决 Windows 乱码
      fs.writeFileSync(outputPath, '\uFEFF' + text);
      return outputPath;
    } catch (error: any) {
      console.error('PDF转换错误:', error);
      throw new Error(`PDF转换失败: ${error.message}`);
    }
  }

  /**
   * CSV 转 Excel
   */
  private async convertCsvToExcel(inputPath: string, outputPath: string): Promise<string> {
    const workbook = XLSX.readFile(inputPath);
    XLSX.writeFile(workbook, outputPath);
    return outputPath;
  }

  /**
   * JSON 转 Excel
   */
  private async convertJsonToExcel(inputPath: string, outputPath: string): Promise<string> {
    const jsonData = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
    const worksheet = XLSX.utils.json_to_sheet(Array.isArray(jsonData) ? jsonData : [jsonData]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    XLSX.writeFile(workbook, outputPath);
    return outputPath;
  }

  /**
   * 获取输出文件扩展名
   */
  private getOutputExtension(format: FileFormat): string {
    const extensions: Record<FileFormat, string> = {
      word: 'docx',
      excel: 'xlsx',
      image: 'png',
      pdf: 'pdf',
      txt: 'txt',
      csv: 'csv',
      json: 'json'
    };
    return extensions[format] || format;
  }

  /**
   * 获取文件路径
   */
  getFilePath(fileId: string): string {
    return path.join(this.uploadDir, fileId);
  }

  /**
   * 检查文件是否存在
   */
  fileExists(fileId: string): boolean {
    return fs.existsSync(this.getFilePath(fileId));
  }

  /**
   * 清理文件
   */
  cleanupFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error('清理文件失败:', error);
    }
  }

  /**
   * 创建历史记录
   */
  private async createHistory(history: ConversionHistory): Promise<void> {
    const query = `
      INSERT INTO file_conversion_history 
      (id, user_id, source_format, target_format, original_filename, result_filename, file_size, status, error_message, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.db.run(query, [
      history.id,
      history.userId,
      history.sourceFormat,
      history.targetFormat,
      history.originalFilename,
      history.resultFilename || null,
      history.fileSize || null,
      history.status,
      history.errorMessage || null,
      history.createdAt,
      history.updatedAt
    ]);
  }

  /**
   * 更新历史记录
   */
  private async updateHistory(id: string, updates: Partial<ConversionHistory>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.status) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.resultFilename) {
      fields.push('result_filename = ?');
      values.push(updates.resultFilename);
    }
    if (updates.errorMessage) {
      fields.push('error_message = ?');
      values.push(updates.errorMessage);
    }
    if (updates.updatedAt) {
      fields.push('updated_at = ?');
      values.push(updates.updatedAt);
    }

    if (fields.length === 0) return;

    values.push(id);
    const query = `UPDATE file_conversion_history SET ${fields.join(', ')} WHERE id = ?`;
    await this.db.run(query, values);
  }

  /**
   * 获取历史记录
   */
  async getHistory(params: HistoryQueryParams): Promise<HistoryQueryResult> {
    const { userId, page = 1, pageSize = 20, status, startDate, endDate } = params;
    
    let whereClause = 'WHERE user_id = ?';
    const queryParams: any[] = [userId];

    if (status) {
      whereClause += ' AND status = ?';
      queryParams.push(status);
    }
    if (startDate) {
      whereClause += ' AND created_at >= ?';
      queryParams.push(startDate);
    }
    if (endDate) {
      whereClause += ' AND created_at <= ?';
      queryParams.push(endDate);
    }

    // 获取总数
    const countQuery = `SELECT COUNT(*) as total FROM file_conversion_history ${whereClause}`;
    const countResult = await this.db.get(countQuery, queryParams);
    const total = countResult.total;

    // 获取数据
    const offset = (page - 1) * pageSize;
    const dataQuery = `
      SELECT * FROM file_conversion_history 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    const items = await this.db.all(dataQuery, [...queryParams, pageSize, offset]);

    return {
      total,
      page,
      pageSize,
      items
    };
  }

  /**
   * 删除历史记录
   */
  async deleteHistory(id: string, userId: string): Promise<void> {
    const query = 'DELETE FROM file_conversion_history WHERE id = ? AND user_id = ?';
    await this.db.run(query, [id, userId]);
  }

  /**
   * 清理过期文件
   */
  async cleanupExpiredFiles(): Promise<number> {
    const expiryTime = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000);
    
    // 获取过期记录
    const query = 'SELECT * FROM file_conversion_history WHERE created_at < ? AND status = ?';
    const expiredRecords = await this.db.all(query, [expiryTime, 'success']);

    let cleanedCount = 0;
    for (const record of expiredRecords) {
      if (record.result_filename) {
        const filePath = this.getFilePath(record.result_filename);
        this.cleanupFile(filePath);
        cleanedCount++;
      }
    }

    // 删除过期记录
    const deleteQuery = 'DELETE FROM file_conversion_history WHERE created_at < ?';
    await this.db.run(deleteQuery, [expiryTime]);

    return cleanedCount;
  }
}
