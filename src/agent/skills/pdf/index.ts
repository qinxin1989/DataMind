/**
 * PDF Skill - PDF 文档操作
 * 移植自 ai-agent-plus pdf_skill.py
 */

import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { SkillDefinition } from '../registry';

function pickParam<T = any>(params: Record<string, any>, ...keys: string[]): T | undefined {
  for (const key of keys) {
    if (params[key] !== undefined) {
      return params[key] as T;
    }
  }
  return undefined;
}

function runPythonJson(script: string, payload: Record<string, any>): Promise<any> {
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64');
  return new Promise((resolve, reject) => {
    execFile(
      'python',
      ['-c', script],
      {
        env: {
          ...process.env,
          DATAMIND_PDF_PAYLOAD: encodedPayload,
        },
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
          return;
        }

        try {
          resolve(JSON.parse(stdout || '{}'));
        } catch (parseError: any) {
          reject(new Error(parseError.message));
        }
      }
    );
  });
}

const readPdf: SkillDefinition = {
  name: 'pdf.readPdf',
  category: 'document',
  displayName: '读取 PDF',
  description: '读取 PDF 文件内容（提取文本）',
  parameters: [
    { name: 'path', type: 'string', description: 'PDF 文件路径', required: true },
    { name: 'maxPages', type: 'number', description: '最多读取页数', required: false },
  ],
  execute: async (params) => {
    const filePath = path.resolve(pickParam<string>(params, 'path', 'pdf_path') || '');
    if (!fs.existsSync(filePath)) return { success: false, message: `Error: 文件不存在: ${filePath}` };

    try {
      const pdfParse = require('pdf-parse');
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer, { max: Number(pickParam(params, 'maxPages', 'max_pages')) || 0 });
      const text = data.text || '';
      const truncated = text.length > 10000 ? text.slice(0, 10000) + `\n...(共${text.length}字符)` : text;
      return {
        success: true,
        data: truncated,
        message: `PDF: ${filePath} (${data.numpages} 页, ${text.length} 字符)`,
      };
    } catch (e: any) {
      return { success: false, message: `Error: 读取 PDF 失败: ${e.message}` };
    }
  },
};

const mergePdf: SkillDefinition = {
  name: 'pdf.mergePdf',
  category: 'document',
  displayName: '合并 PDF',
  description: '将多个 PDF 文件合并为一个',
  parameters: [
    { name: 'inputPaths', type: 'array', description: 'PDF 文件路径数组', required: true },
    { name: 'outputPath', type: 'string', description: '输出文件路径', required: true },
  ],
  execute: async (params) => {
    try {
      const { PDFDocument } = require('pdf-lib');
      const mergedPdf = await PDFDocument.create();

      const inputPaths = pickParam<string[]>(params, 'inputPaths', 'input_paths') || [];
      for (const inputPath of inputPaths) {
        const filePath = path.resolve(inputPath);
        if (!fs.existsSync(filePath)) return { success: false, message: `Error: 文件不存在: ${filePath}` };
        const buffer = fs.readFileSync(filePath);
        const doc = await PDFDocument.load(buffer);
        const pages = await mergedPdf.copyPages(doc, doc.getPageIndices());
        pages.forEach((page: any) => mergedPdf.addPage(page));
      }

      const outputPath = path.resolve(pickParam<string>(params, 'outputPath', 'output_path') || '');
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, await mergedPdf.save());
      return { success: true, message: `成功合并 ${inputPaths.length} 个 PDF`, outputPath };
    } catch (e: any) {
      return { success: false, message: `Error: 合并 PDF 失败: ${e.message}` };
    }
  },
};

const splitPdf: SkillDefinition = {
  name: 'pdf.splitPdf',
  category: 'document',
  displayName: '拆分 PDF',
  description: '将 PDF 文件按页拆分',
  parameters: [
    { name: 'path', type: 'string', description: 'PDF 文件路径', required: true },
    { name: 'outputDir', type: 'string', description: '输出目录', required: true },
    { name: 'pages', type: 'array', description: '要提取的页码数组(1-indexed)，不传则拆分所有页', required: false },
  ],
  execute: async (params) => {
    try {
      const { PDFDocument } = require('pdf-lib');
      const filePath = path.resolve(pickParam<string>(params, 'path', 'pdf_path') || '');
      if (!fs.existsSync(filePath)) return { success: false, message: `Error: 文件不存在: ${filePath}` };

      const buffer = fs.readFileSync(filePath);
      const srcDoc = await PDFDocument.load(buffer);
      const totalPages = srcDoc.getPageCount();
      const pageNums: number[] = pickParam<number[]>(params, 'pages')
        || Array.from({ length: totalPages }, (_, i) => i + 1);

      const outputDir = path.resolve(pickParam<string>(params, 'outputDir', 'output_dir') || '');
      fs.mkdirSync(outputDir, { recursive: true });
      const outputPaths: string[] = [];

      for (const pageNum of pageNums) {
        if (pageNum < 1 || pageNum > totalPages) continue;
        const newDoc = await PDFDocument.create();
        const [page] = await newDoc.copyPages(srcDoc, [pageNum - 1]);
        newDoc.addPage(page);
        const outPath = path.join(outputDir, `page_${pageNum}.pdf`);
        fs.writeFileSync(outPath, await newDoc.save());
        outputPaths.push(outPath);
      }

      return { success: true, message: `成功拆分 ${outputPaths.length} 页`, data: outputPaths };
    } catch (e: any) {
      return { success: false, message: `Error: 拆分 PDF 失败: ${e.message}` };
    }
  },
};

const extractPdfText: SkillDefinition = {
  name: 'pdf.extractPdfText',
  category: 'document',
  displayName: '提取 PDF 文本',
  description: '按页范围提取 PDF 文本内容',
  parameters: [
    { name: 'path', type: 'string', description: 'PDF 文件路径', required: true },
    { name: 'startPage', type: 'number', description: '起始页（1-based）', required: false },
    { name: 'endPage', type: 'number', description: '结束页（1-based，含）', required: false },
  ],
  execute: async (params) => {
    const filePath = path.resolve(pickParam<string>(params, 'path', 'pdf_path') || '');
    if (!fs.existsSync(filePath)) {
      return { success: false, message: `Error: 文件不存在: ${filePath}` };
    }

    const script = `
import os, json, base64
import fitz
payload = json.loads(base64.b64decode(os.environ['DATAMIND_PDF_PAYLOAD']).decode('utf-8'))
doc = fitz.open(payload['path'])
start = max(int(payload.get('startPage', 1)) - 1, 0)
end = min(int(payload.get('endPage') or doc.page_count), doc.page_count)
parts = []
for index in range(start, end):
    page = doc.load_page(index)
    text = page.get_text('text') or ''
    if text.strip():
        parts.append(f"[Page {index + 1}]\\n{text.strip()}")
print(json.dumps({
    "pageCount": doc.page_count,
    "processedPages": max(end - start, 0),
    "text": "\\n\\n".join(parts)
}, ensure_ascii=False))
`;

    try {
      const result = await runPythonJson(script, {
        path: filePath,
        startPage: pickParam(params, 'startPage', 'start_page') || 1,
        endPage: pickParam(params, 'endPage', 'end_page'),
      });

      return {
        success: true,
        message: `成功提取 PDF 文本，共处理 ${result.processedPages} 页`,
        data: result.text || '',
      };
    } catch (error: any) {
      return { success: false, message: `Error: 提取 PDF 文本失败: ${error.message}` };
    }
  },
};

const extractPdfImages: SkillDefinition = {
  name: 'pdf.extractPdfImages',
  category: 'document',
  displayName: '提取 PDF 图片',
  description: '提取 PDF 中的图片资源到指定目录',
  parameters: [
    { name: 'path', type: 'string', description: 'PDF 文件路径', required: true },
    { name: 'outputDir', type: 'string', description: '输出目录', required: true },
    { name: 'minWidth', type: 'number', description: '最小宽度过滤', required: false },
    { name: 'minHeight', type: 'number', description: '最小高度过滤', required: false },
  ],
  execute: async (params) => {
    const filePath = path.resolve(pickParam<string>(params, 'path', 'pdf_path') || '');
    const outputDir = path.resolve(pickParam<string>(params, 'outputDir', 'output_dir') || '');
    if (!fs.existsSync(filePath)) {
      return { success: false, message: `Error: 文件不存在: ${filePath}` };
    }

    const script = `
import os, json, base64
import fitz
payload = json.loads(base64.b64decode(os.environ['DATAMIND_PDF_PAYLOAD']).decode('utf-8'))
doc = fitz.open(payload['path'])
output_dir = payload['outputDir']
os.makedirs(output_dir, exist_ok=True)
min_width = int(payload.get('minWidth') or 0)
min_height = int(payload.get('minHeight') or 0)
images = []
for page_index in range(doc.page_count):
    page = doc.load_page(page_index)
    for img_index, img in enumerate(page.get_images(full=True)):
        xref = img[0]
        base = doc.extract_image(xref)
        if not base:
            continue
        width = int(base.get('width') or 0)
        height = int(base.get('height') or 0)
        if width < min_width or height < min_height:
            continue
        ext = base.get('ext', 'png')
        filename = f"page_{page_index + 1}_img_{img_index + 1}.{ext}"
        output_path = os.path.join(output_dir, filename)
        with open(output_path, 'wb') as fh:
            fh.write(base.get('image'))
        images.append(output_path)
print(json.dumps({"images": images}, ensure_ascii=False))
`;

    try {
      const result = await runPythonJson(script, {
        path: filePath,
        outputDir,
        minWidth: pickParam(params, 'minWidth', 'min_width') || 0,
        minHeight: pickParam(params, 'minHeight', 'min_height') || 0,
      });

      return {
        success: true,
        message: `成功提取 ${Array.isArray(result.images) ? result.images.length : 0} 张图片`,
        data: result.images || [],
      };
    } catch (error: any) {
      return { success: false, message: `Error: 提取 PDF 图片失败: ${error.message}` };
    }
  },
};

export const pdfSkills: SkillDefinition[] = [
  readPdf,
  mergePdf,
  splitPdf,
  extractPdfText,
  extractPdfImages,
];
