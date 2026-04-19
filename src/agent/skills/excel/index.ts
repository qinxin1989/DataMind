/**
 * Excel Skill - Excel 文件读写与分析
 * 兼容 ai-agent-plus 的 excel.* 动作
 */

import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { SkillDefinition } from '../registry';

function pickParam<T = any>(params: Record<string, any>, ...keys: string[]): T | undefined {
  for (const key of keys) {
    if (params[key] !== undefined) {
      return params[key] as T;
    }
  }
  return undefined;
}

function ensureWorkbookPath(filePath: string): string {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`文件不存在: ${resolved}`);
  }
  return resolved;
}

function resolveSheetName(workbook: XLSX.WorkBook, sheetInput?: string | number): string {
  if (typeof sheetInput === 'number') {
    return workbook.SheetNames[sheetInput] || workbook.SheetNames[0];
  }

  if (typeof sheetInput === 'string' && sheetInput.trim()) {
    const maybeIndex = Number(sheetInput);
    if (!Number.isNaN(maybeIndex) && `${maybeIndex}` === sheetInput.trim()) {
      return workbook.SheetNames[maybeIndex] || workbook.SheetNames[0];
    }

    if (workbook.SheetNames.includes(sheetInput)) {
      return sheetInput;
    }
  }

  return workbook.SheetNames[0];
}

function parseStructuredData(value: any): any {
  if (typeof value === 'string') {
    return JSON.parse(value);
  }
  return value;
}

function normalizeTableData(value: any): { rows: any[][]; columns: string[] } {
  const parsed = parseStructuredData(value);

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('数据格式错误，需要非空数组');
  }

  if (Array.isArray(parsed[0])) {
    const rows = parsed as any[][];
    const columns = rows[0].map((item, index) => String(item ?? `列${index + 1}`));
    return {
      columns,
      rows: rows.slice(1),
    };
  }

  if (typeof parsed[0] === 'object' && parsed[0] !== null) {
    const rows = parsed as Record<string, any>[];
    const columnSet = new Set<string>();
    rows.forEach(row => Object.keys(row).forEach(key => columnSet.add(key)));
    const columns = Array.from(columnSet);
    return {
      columns,
      rows: rows.map(row => columns.map(column => row[column] ?? null)),
    };
  }

  throw new Error('数据格式错误，仅支持二维数组或对象数组');
}

function tablePreview(rows: any[][], columns: string[], maxRows: number): string {
  const previewRows = rows.slice(0, maxRows);
  const table = previewRows.map(row => {
    const item: Record<string, any> = {};
    columns.forEach((column, index) => {
      item[column] = row[index] ?? null;
    });
    return item;
  });

  return JSON.stringify(table, null, 2);
}

const readExcel: SkillDefinition = {
  name: 'excel.readExcel',
  category: 'document',
  displayName: '读取 Excel',
  description: '读取 Excel 文件内容并返回表头、行数和预览数据',
  parameters: [
    { name: 'path', type: 'string', description: 'Excel 文件路径', required: true },
    { name: 'sheetName', type: 'string', description: '工作表名称或索引', required: false },
    { name: 'maxRows', type: 'number', description: '最多展示多少行', required: false },
  ],
  execute: async (params) => {
    try {
      const filePath = ensureWorkbookPath(pickParam<string>(params, 'path') || '');
      const workbook = XLSX.readFile(filePath, { cellDates: true });
      const sheetName = resolveSheetName(
        workbook,
        pickParam<string | number>(params, 'sheetName', 'sheet_name')
      );
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: null });
      const [headerRow = [], ...dataRows] = rows;
      const maxRows = Number(pickParam(params, 'maxRows', 'max_rows')) || 100;
      const columns = headerRow.map((item, index) => String(item ?? `列${index + 1}`));

      return {
        success: true,
        message: `Excel: ${filePath}\n工作表: ${sheetName}\n行数: ${dataRows.length}\n列数: ${columns.length}`,
        data: tablePreview(dataRows, columns, maxRows),
      };
    } catch (error: any) {
      return { success: false, message: `Error: 读取 Excel 失败: ${error.message}` };
    }
  },
};

const writeExcel: SkillDefinition = {
  name: 'excel.writeExcel',
  category: 'document',
  displayName: '写入 Excel',
  description: '将二维数组或对象数组写入 Excel 文件',
  parameters: [
    { name: 'path', type: 'string', description: '输出 Excel 文件路径', required: true },
    { name: 'data', type: 'array', description: '二维数组或对象数组', required: true },
    { name: 'sheetName', type: 'string', description: '工作表名称', required: false },
  ],
  execute: async (params) => {
    try {
      const outputPath = path.resolve(pickParam<string>(params, 'path') || '');
      const sheetName = pickParam<string>(params, 'sheetName', 'sheet_name') || 'Sheet1';
      const structured = parseStructuredData(pickParam(params, 'data'));
      let worksheet: XLSX.WorkSheet;

      if (Array.isArray(structured) && Array.isArray(structured[0])) {
        worksheet = XLSX.utils.aoa_to_sheet(structured);
      } else if (Array.isArray(structured)) {
        worksheet = XLSX.utils.json_to_sheet(structured);
      } else {
        throw new Error('data 必须是二维数组或对象数组');
      }

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      XLSX.writeFile(workbook, outputPath);

      return {
        success: true,
        message: `成功写入 Excel: ${outputPath}`,
        outputPath,
      };
    } catch (error: any) {
      return { success: false, message: `Error: 写入 Excel 失败: ${error.message}` };
    }
  },
};

const analyzeExcel: SkillDefinition = {
  name: 'excel.analyzeExcel',
  category: 'document',
  displayName: '分析 Excel',
  description: '输出 Excel 数据规模、列信息、空值情况和数值列统计',
  parameters: [
    { name: 'path', type: 'string', description: 'Excel 文件路径', required: true },
    { name: 'sheetName', type: 'string', description: '工作表名称或索引', required: false },
  ],
  execute: async (params) => {
    try {
      const filePath = ensureWorkbookPath(pickParam<string>(params, 'path') || '');
      const workbook = XLSX.readFile(filePath, { cellDates: true });
      const sheetName = resolveSheetName(
        workbook,
        pickParam<string | number>(params, 'sheetName', 'sheet_name')
      );
      const worksheet = workbook.Sheets[sheetName];
      const records = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: null });
      const columns = Object.keys(records[0] || {});
      const lines = [
        'Excel 数据分析报告',
        `文件: ${filePath}`,
        `工作表: ${sheetName}`,
        `行数: ${records.length}`,
        `列数: ${columns.length}`,
        '',
        '列概览：',
      ];

      for (const column of columns) {
        const values = records.map(row => row[column]);
        const nullCount = values.filter(value => value === null || value === undefined || value === '').length;
        const numericValues = values.filter(value => typeof value === 'number') as number[];
        let line = `- ${column}: 空值 ${nullCount}`;
        if (numericValues.length > 0) {
          const total = numericValues.reduce((sum, value) => sum + value, 0);
          const min = Math.min(...numericValues);
          const max = Math.max(...numericValues);
          const avg = total / numericValues.length;
          line += `；数值 ${numericValues.length} 条；均值 ${avg.toFixed(2)}；最小 ${min}；最大 ${max}`;
        }
        lines.push(line);
      }

      lines.push('');
      lines.push('预览：');
      lines.push(JSON.stringify(records.slice(0, 10), null, 2));

      return {
        success: true,
        data: lines.join('\n'),
      };
    } catch (error: any) {
      return { success: false, message: `Error: 分析 Excel 失败: ${error.message}` };
    }
  },
};

const getExcelSheets: SkillDefinition = {
  name: 'excel.getExcelSheets',
  category: 'document',
  displayName: '获取工作表列表',
  description: '返回 Excel 文件中的所有工作表名称',
  parameters: [
    { name: 'path', type: 'string', description: 'Excel 文件路径', required: true },
  ],
  execute: async (params) => {
    try {
      const filePath = ensureWorkbookPath(pickParam<string>(params, 'path') || '');
      const workbook = XLSX.readFile(filePath, { cellDates: true });
      return {
        success: true,
        data: workbook.SheetNames,
        message: `共 ${workbook.SheetNames.length} 个工作表`,
      };
    } catch (error: any) {
      return { success: false, message: `Error: 获取工作表失败: ${error.message}` };
    }
  },
};

const excelToJson: SkillDefinition = {
  name: 'excel.excelToJson',
  category: 'document',
  displayName: 'Excel 转 JSON',
  description: '将 Excel 指定工作表转换为 JSON',
  parameters: [
    { name: 'path', type: 'string', description: 'Excel 文件路径', required: true },
    { name: 'sheetName', type: 'string', description: '工作表名称或索引', required: false },
    { name: 'orient', type: 'string', description: '输出格式 records/columns/values', required: false },
  ],
  execute: async (params) => {
    try {
      const filePath = ensureWorkbookPath(pickParam<string>(params, 'path') || '');
      const workbook = XLSX.readFile(filePath, { cellDates: true });
      const sheetName = resolveSheetName(
        workbook,
        pickParam<string | number>(params, 'sheetName', 'sheet_name')
      );
      const worksheet = workbook.Sheets[sheetName];
      const orient = pickParam<string>(params, 'orient') || 'records';
      let data: any;

      if (orient === 'values') {
        data = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: null });
      } else if (orient === 'columns') {
        const records = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: null });
        const columns: Record<string, any[]> = {};
        Object.keys(records[0] || {}).forEach(column => {
          columns[column] = records.map(row => row[column] ?? null);
        });
        data = columns;
      } else {
        data = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: null });
      }

      return {
        success: true,
        data,
        message: `已转换工作表 ${sheetName} 为 ${orient} JSON`,
      };
    } catch (error: any) {
      return { success: false, message: `Error: Excel 转 JSON 失败: ${error.message}` };
    }
  },
};

export const excelSkills: SkillDefinition[] = [
  readExcel,
  writeExcel,
  analyzeExcel,
  getExcelSheets,
  excelToJson,
];
