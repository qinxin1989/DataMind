/**
 * Docx Skill - Word 文档操作
 * 移植自 ai-agent-plus word_skill.py
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
      ['-X', 'utf8', '-c', script],
      {
        env: {
          ...process.env,
          DATAMIND_DOCX_PAYLOAD: encodedPayload,
          PYTHONUTF8: '1',
          PYTHONIOENCODING: 'utf-8',
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

async function loadZip(filePath: string) {
  const JSZip = require('jszip');
  const buffer = fs.readFileSync(filePath);
  return JSZip.loadAsync(buffer);
}

function walkDirectory(rootDir: string, currentDir = rootDir): string[] {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDirectory(rootDir, fullPath));
    } else {
      files.push(path.relative(rootDir, fullPath).replace(/\\/g, '/'));
    }
  }

  return files;
}

async function postProcessUnpackedWord(outputDir: string): Promise<{ suggestedRsid?: string; xmlFiles?: number }> {
  const script = `
import os, json, base64, random
from pathlib import Path
import defusedxml.minidom

payload = json.loads(base64.b64decode(os.environ['DATAMIND_DOCX_PAYLOAD']).decode('utf-8'))
output_dir = Path(payload['outputDir'])
xml_files = list(output_dir.rglob('*.xml')) + list(output_dir.rglob('*.rels'))

for xml_file in xml_files:
    content = xml_file.read_text(encoding='utf-8')
    dom = defusedxml.minidom.parseString(content)
    xml_file.write_bytes(dom.toprettyxml(indent='  ', encoding='ascii'))

print(json.dumps({
    'suggestedRsid': ''.join(random.choices('0123456789ABCDEF', k=8)),
    'xmlFiles': len(xml_files)
}, ensure_ascii=False))
`;

  return runPythonJson(script, { outputDir });
}

async function runDocxLibraryJson(script: string, payload: Record<string, any>): Promise<any> {
  return runPythonJson(script, {
    ...payload,
    skillRoot: path.join(process.cwd(), 'skills', 'docx'),
  });
}

const readWord: SkillDefinition = {
  name: 'docx.readWord',
  category: 'document',
  displayName: '读取 Word',
  description: '读取 Word(.docx) 文件的文本内容',
  parameters: [
    { name: 'path', type: 'string', description: 'Word 文件路径', required: true },
    { name: 'includeTables', type: 'boolean', description: '是否包含表格内容', required: false },
  ],
  execute: async (params) => {
    const filePath = path.resolve(pickParam<string>(params, 'path') || '');
    if (!fs.existsSync(filePath)) return { success: false, message: `Error: 文件不存在: ${filePath}` };

    if (pickParam<boolean>(params, 'includeTables', 'include_tables')) {
      const script = `
import os, json, base64
from docx import Document
payload = json.loads(base64.b64decode(os.environ['DATAMIND_DOCX_PAYLOAD']).decode('utf-8'))
document = Document(payload['path'])
parts = []
for para in document.paragraphs:
    text = para.text.strip()
    if text:
        parts.append(text)
if payload.get('includeTables'):
    for table_index, table in enumerate(document.tables, 1):
        parts.append(f"\\n[表格 {table_index}]")
        for row in table.rows:
            cells = [cell.text.strip() for cell in row.cells]
            parts.append(" | ".join(cells))
print(json.dumps({"text": "\\n".join(parts)}, ensure_ascii=False))
`;

      try {
        const result = await runPythonJson(script, {
          path: filePath,
          includeTables: true,
        });
        const text = String(result.text || '');
        const truncated = text.length > 10000 ? `${text.slice(0, 10000)}\n...(共${text.length}字符)` : text;
        return { success: true, data: truncated, message: `Word: ${filePath} (${text.length} 字符)` };
      } catch (error: any) {
        return { success: false, message: `Error: 读取 Word 失败: ${error.message}` };
      }
    }

    try {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      const text = result.value || '';
      const truncated = text.length > 10000 ? text.slice(0, 10000) + `\n...(共${text.length}字符)` : text;
      return { success: true, data: truncated, message: `Word: ${filePath} (${text.length} 字符)` };
    } catch (e: any) {
      return { success: false, message: `Error: 读取 Word 失败: ${e.message}` };
    }
  },
};

const updateWordContent: SkillDefinition = {
  name: 'docx.updateWordContent',
  category: 'document',
  displayName: '更新 Word 内容',
  description: '在现有 Word 文档中查找并替换指定文本',
  parameters: [
    { name: 'docPath', type: 'string', description: 'Word 文档路径', required: true },
    { name: 'findText', type: 'string', description: '待查找文本', required: true },
    { name: 'replaceText', type: 'string', description: '替换后的文本', required: true },
    { name: 'replaceAll', type: 'boolean', description: '是否替换所有匹配', required: false },
  ],
  execute: async (params) => {
    const docPath = path.resolve(pickParam<string>(params, 'docPath', 'doc_path') || '');
    if (!fs.existsSync(docPath)) {
      return { success: false, message: `Error: 文档不存在: ${docPath}` };
    }

    const script = `
import os, json, base64
from docx import Document
payload = json.loads(base64.b64decode(os.environ['DATAMIND_DOCX_PAYLOAD']).decode('utf-8'))
document = Document(payload['docPath'])
find_text = payload['findText']
replace_text = payload['replaceText']
replace_all = bool(payload.get('replaceAll', True))
count = 0
for para in document.paragraphs:
    if find_text in para.text:
        replaced = para.text.replace(find_text, replace_text) if replace_all else para.text.replace(find_text, replace_text, 1)
        if replaced != para.text:
            count += para.text.count(find_text) if replace_all else 1
            para.text = replaced
            if not replace_all:
                break
if replace_all or count == 0:
    for table in document.tables:
        for row in table.rows:
            for cell in row.cells:
                if find_text in cell.text:
                    replaced = cell.text.replace(find_text, replace_text) if replace_all else cell.text.replace(find_text, replace_text, 1)
                    if replaced != cell.text:
                        count += cell.text.count(find_text) if replace_all else 1
                        cell.text = replaced
                        if not replace_all:
                            break
            if not replace_all and count > 0:
                break
        if not replace_all and count > 0:
            break
document.save(payload['docPath'])
print(json.dumps({"count": count}, ensure_ascii=False))
`;

    try {
      const result = await runPythonJson(script, {
        docPath,
        findText: pickParam<string>(params, 'findText', 'find_text') || '',
        replaceText: pickParam<string>(params, 'replaceText', 'replace_text') || '',
        replaceAll: pickParam<boolean>(params, 'replaceAll', 'replace_all') !== false,
      });
      return {
        success: true,
        message: `成功更新文档: ${docPath}\n替换次数: ${Number(result.count) || 0}`,
        outputPath: docPath,
      };
    } catch (error: any) {
      return { success: false, message: `Error: 更新文档失败: ${error.message}` };
    }
  },
};

const appendToWord: SkillDefinition = {
  name: 'docx.appendToWord',
  category: 'document',
  displayName: '追加 Word 内容',
  description: '在现有 Word 文档末尾追加正文内容',
  parameters: [
    { name: 'docPath', type: 'string', description: 'Word 文档路径', required: true },
    { name: 'content', type: 'string', description: '追加内容（支持简单 Markdown）', required: true },
    { name: 'addPageBreak', type: 'boolean', description: '追加前是否分页', required: false },
  ],
  execute: async (params) => {
    const docPath = path.resolve(pickParam<string>(params, 'docPath', 'doc_path') || '');
    if (!fs.existsSync(docPath)) {
      return { success: false, message: `Error: 文档不存在: ${docPath}` };
    }

    const script = `
import os, json, base64, re
from docx import Document
from docx.shared import Pt
payload = json.loads(base64.b64decode(os.environ['DATAMIND_DOCX_PAYLOAD']).decode('utf-8'))
document = Document(payload['docPath'])

def add_heading_safe(text, level):
    paragraph = document.add_paragraph()
    run = paragraph.add_run(text)
    run.bold = True
    try:
        run.font.size = Pt({1: 16, 2: 14, 3: 12}.get(level, 12))
    except Exception:
        pass

def add_list_safe(text, fallback_prefix):
    document.add_paragraph(fallback_prefix + text)

if payload.get('addPageBreak'):
    document.add_page_break()
for raw_line in str(payload['content']).splitlines():
    line = raw_line.strip()
    if not line:
        document.add_paragraph('')
    elif line.startswith('### '):
        add_heading_safe(line[4:], 3)
    elif line.startswith('## '):
        add_heading_safe(line[3:], 2)
    elif line.startswith('# '):
        add_heading_safe(line[2:], 1)
    elif line.startswith('- ') or line.startswith('* '):
        add_list_safe(line[2:], '• ')
    elif re.match(r'^\\d+\\.\\s', line):
        number_match = re.match(r'^(\\d+)\\.\\s', line)
        number_prefix = f"{number_match.group(1)}. " if number_match else ''
        add_list_safe(re.sub(r'^\\d+\\.\\s', '', line), number_prefix)
    else:
        document.add_paragraph(line)
document.save(payload['docPath'])
print(json.dumps({"appended": True}, ensure_ascii=False))
`;

    try {
      await runPythonJson(script, {
        docPath,
        content: pickParam<string>(params, 'content') || '',
        addPageBreak: Boolean(pickParam(params, 'addPageBreak', 'add_page_break')),
      });
      return {
        success: true,
        message: `成功追加内容到: ${docPath}`,
        outputPath: docPath,
      };
    } catch (error: any) {
      return { success: false, message: `Error: 追加内容失败: ${error.message}` };
    }
  },
};

const addTableToWord: SkillDefinition = {
  name: 'docx.addTableToWord',
  category: 'document',
  displayName: '插入 Word 表格',
  description: '向 Word 文档中插入二维表格',
  parameters: [
    { name: 'docPath', type: 'string', description: 'Word 文档路径', required: true },
    { name: 'tableData', type: 'array', description: '二维表格数据', required: true },
    { name: 'tableTitle', type: 'string', description: '表格标题', required: false },
  ],
  execute: async (params) => {
    const docPath = path.resolve(pickParam<string>(params, 'docPath', 'doc_path') || '');
    if (!fs.existsSync(docPath)) {
      return { success: false, message: `Error: 文档不存在: ${docPath}` };
    }

    const script = `
import os, json, base64
from docx import Document
from docx.shared import Pt
payload = json.loads(base64.b64decode(os.environ['DATAMIND_DOCX_PAYLOAD']).decode('utf-8'))
document = Document(payload['docPath'])

def add_heading_safe(text, level):
    paragraph = document.add_paragraph()
    run = paragraph.add_run(text)
    run.bold = True
    try:
        run.font.size = Pt({1: 16, 2: 14, 3: 12}.get(level, 12))
    except Exception:
        pass

table_data = payload['tableData']
if isinstance(table_data, str):
    table_data = json.loads(table_data)
if not isinstance(table_data, list) or not table_data:
    raise ValueError('tableData 必须是非空二维数组')
if payload.get('tableTitle'):
    add_heading_safe(payload['tableTitle'], 2)
table = document.add_table(rows=len(table_data), cols=len(table_data[0]))
for row_index, row_data in enumerate(table_data):
    for col_index, cell_data in enumerate(row_data):
        table.rows[row_index].cells[col_index].text = str(cell_data)
document.save(payload['docPath'])
print(json.dumps({"rows": len(table_data), "cols": len(table_data[0])}, ensure_ascii=False))
`;

    try {
      const result = await runPythonJson(script, {
        docPath,
        tableData: pickParam(params, 'tableData', 'table_data'),
        tableTitle: pickParam<string>(params, 'tableTitle', 'table_title'),
      });
      return {
        success: true,
        message: `成功添加表格到: ${docPath}\n表格大小: ${Number(result.rows) || 0} 行 x ${Number(result.cols) || 0} 列`,
        outputPath: docPath,
      };
    } catch (error: any) {
      return { success: false, message: `Error: 添加表格失败: ${error.message}` };
    }
  },
};

const addImageToWord: SkillDefinition = {
  name: 'docx.addImageToWord',
  category: 'document',
  displayName: '插入 Word 图片',
  description: '向 Word 文档中插入图片和说明文字',
  parameters: [
    { name: 'docPath', type: 'string', description: 'Word 文档路径', required: true },
    { name: 'imagePath', type: 'string', description: '图片路径', required: true },
    { name: 'caption', type: 'string', description: '图片说明', required: false },
    { name: 'widthInches', type: 'number', description: '图片宽度（英寸）', required: false },
  ],
  execute: async (params) => {
    const docPath = path.resolve(pickParam<string>(params, 'docPath', 'doc_path') || '');
    const imagePath = path.resolve(pickParam<string>(params, 'imagePath', 'image_path') || '');
    if (!fs.existsSync(docPath)) {
      return { success: false, message: `Error: 文档不存在: ${docPath}` };
    }
    if (!fs.existsSync(imagePath)) {
      return { success: false, message: `Error: 图片不存在: ${imagePath}` };
    }

    const script = `
import os, json, base64
from docx import Document
from docx.shared import Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
payload = json.loads(base64.b64decode(os.environ['DATAMIND_DOCX_PAYLOAD']).decode('utf-8'))
document = Document(payload['docPath'])
width = float(payload.get('widthInches') or 6)
document.add_picture(payload['imagePath'], width=Inches(width))
if payload.get('caption'):
    paragraph = document.add_paragraph(payload['caption'])
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
document.save(payload['docPath'])
print(json.dumps({"inserted": True}, ensure_ascii=False))
`;

    try {
      await runPythonJson(script, {
        docPath,
        imagePath,
        caption: pickParam<string>(params, 'caption'),
        widthInches: pickParam<number>(params, 'widthInches', 'width_inches') || 6,
      });
      return {
        success: true,
        message: `成功添加图片到: ${docPath}`,
        outputPath: docPath,
      };
    } catch (error: any) {
      return { success: false, message: `Error: 添加图片失败: ${error.message}` };
    }
  },
};

const unpackWord: SkillDefinition = {
  name: 'docx.unpackWord',
  category: 'document',
  displayName: '解包 Word OOXML',
  description: '将 .docx 文档解包为可编辑的 OOXML 目录结构',
  parameters: [
    { name: 'path', type: 'string', description: 'Word 文件路径', required: true },
    { name: 'outputDir', type: 'string', description: '输出目录路径', required: true },
  ],
  execute: async (params) => {
    const filePath = path.resolve(pickParam<string>(params, 'path', 'docPath', 'doc_path') || '');
    const outputDir = path.resolve(pickParam<string>(params, 'outputDir', 'output_dir') || '');

    if (!fs.existsSync(filePath)) {
      return { success: false, message: `Error: 文件不存在: ${filePath}` };
    }

    try {
      const zip = await loadZip(filePath);
      fs.mkdirSync(outputDir, { recursive: true });

      let fileCount = 0;
      for (const entryName of Object.keys(zip.files)) {
        const entry = zip.files[entryName];
        const outputPath = path.join(outputDir, entryName);

        if (entry.dir) {
          fs.mkdirSync(outputPath, { recursive: true });
          continue;
        }

        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, await entry.async('nodebuffer'));
        fileCount += 1;
      }

      const postProcess = await postProcessUnpackedWord(outputDir);

      return {
        success: true,
        message: `已解包 Word 到目录: ${outputDir}\n文件数: ${fileCount}\nXML 文件: ${Number(postProcess.xmlFiles) || 0}\n建议 RSID: ${postProcess.suggestedRsid || '未生成'}`,
        outputPath: outputDir,
        data: postProcess,
      };
    } catch (error: any) {
      return { success: false, message: `Error: 解包 Word 失败: ${error.message}` };
    }
  },
};

const addCommentToWord: SkillDefinition = {
  name: 'docx.addCommentToWord',
  category: 'document',
  displayName: '添加 Word 批注',
  description: '在已解包的 Word OOXML 目录中，按行号或文本定位添加批注',
  parameters: [
    { name: 'unpackedDir', type: 'string', description: '已解包目录路径', required: true },
    { name: 'commentText', type: 'string', description: '批注内容', required: true },
    { name: 'startTag', type: 'string', description: '起始节点标签，默认 w:p', required: false },
    { name: 'startLineNumber', type: 'number', description: '起始节点行号', required: false },
    { name: 'startContains', type: 'string', description: '起始节点包含文本', required: false },
    { name: 'endTag', type: 'string', description: '结束节点标签，默认与起始节点相同', required: false },
    { name: 'endLineNumber', type: 'number', description: '结束节点行号', required: false },
    { name: 'endContains', type: 'string', description: '结束节点包含文本', required: false },
    { name: 'author', type: 'string', description: '批注作者', required: false },
    { name: 'initials', type: 'string', description: '作者缩写', required: false },
  ],
  execute: async (params) => {
    const unpackedDir = path.resolve(pickParam<string>(params, 'unpackedDir', 'unpacked_dir') || '');
    if (!fs.existsSync(unpackedDir) || !fs.statSync(unpackedDir).isDirectory()) {
      return { success: false, message: `Error: 解包目录不存在: ${unpackedDir}` };
    }

    const script = `
import os, sys, io, json, base64, contextlib

payload = json.loads(base64.b64decode(os.environ['DATAMIND_DOCX_PAYLOAD']).decode('utf-8'))
sys.path.insert(0, payload['skillRoot'])
from scripts.document import Document

def resolve_node(editor, prefix):
    tag = payload.get(f"{prefix}Tag") or 'w:p'
    kwargs = {}
    line_number = payload.get(f"{prefix}LineNumber")
    contains = payload.get(f"{prefix}Contains")
    attrs = payload.get(f"{prefix}Attrs")
    if line_number is not None:
        kwargs['line_number'] = int(line_number)
    if contains:
        kwargs['contains'] = contains
    if attrs:
        kwargs['attrs'] = attrs
    return editor.get_node(tag=tag, **kwargs)

with contextlib.redirect_stdout(io.StringIO()):
    doc = Document(
        payload['unpackedDir'],
        track_revisions=True,
        author=payload.get('author') or 'Claude',
        initials=payload.get('initials') or 'C',
    )

editor = doc['word/document.xml']
start = resolve_node(editor, 'start')
if payload.get('endLineNumber') is None and not payload.get('endContains') and not payload.get('endAttrs') and not payload.get('endTag'):
    end = start
else:
    end = resolve_node(editor, 'end')

comment_id = doc.add_comment(start=start, end=end, text=payload['commentText'])
with contextlib.redirect_stdout(io.StringIO()):
    doc.save(destination=payload['unpackedDir'], validate=False)

print(json.dumps({'commentId': int(comment_id)}, ensure_ascii=False))
`;

    try {
      const result = await runDocxLibraryJson(script, {
        unpackedDir,
        commentText: pickParam<string>(params, 'commentText', 'comment_text') || '',
        startTag: pickParam<string>(params, 'startTag', 'start_tag'),
        startLineNumber: pickParam<number>(params, 'startLineNumber', 'start_line_number'),
        startContains: pickParam<string>(params, 'startContains', 'start_contains'),
        endTag: pickParam<string>(params, 'endTag', 'end_tag'),
        endLineNumber: pickParam<number>(params, 'endLineNumber', 'end_line_number'),
        endContains: pickParam<string>(params, 'endContains', 'end_contains'),
        author: pickParam<string>(params, 'author'),
        initials: pickParam<string>(params, 'initials'),
      });
      await postProcessUnpackedWord(unpackedDir);
      return {
        success: true,
        message: `已添加批注到解包目录: ${unpackedDir}\n批注 ID: ${Number(result.commentId) || 0}`,
        data: result,
      };
    } catch (error: any) {
      return { success: false, message: `Error: 添加批注失败: ${error.message}` };
    }
  },
};

const replyToWordComment: SkillDefinition = {
  name: 'docx.replyToWordComment',
  category: 'document',
  displayName: '回复 Word 批注',
  description: '对已存在的 Word 批注添加回复',
  parameters: [
    { name: 'unpackedDir', type: 'string', description: '已解包目录路径', required: true },
    { name: 'parentCommentId', type: 'number', description: '父批注 ID', required: true },
    { name: 'replyText', type: 'string', description: '回复内容', required: true },
    { name: 'author', type: 'string', description: '回复作者', required: false },
    { name: 'initials', type: 'string', description: '作者缩写', required: false },
  ],
  execute: async (params) => {
    const unpackedDir = path.resolve(pickParam<string>(params, 'unpackedDir', 'unpacked_dir') || '');
    if (!fs.existsSync(unpackedDir) || !fs.statSync(unpackedDir).isDirectory()) {
      return { success: false, message: `Error: 解包目录不存在: ${unpackedDir}` };
    }

    const script = `
import os, sys, io, json, base64, contextlib

payload = json.loads(base64.b64decode(os.environ['DATAMIND_DOCX_PAYLOAD']).decode('utf-8'))
sys.path.insert(0, payload['skillRoot'])
from scripts.document import Document

with contextlib.redirect_stdout(io.StringIO()):
    doc = Document(
        payload['unpackedDir'],
        track_revisions=True,
        author=payload.get('author') or 'Claude',
        initials=payload.get('initials') or 'C',
    )
reply_id = doc.reply_to_comment(int(payload['parentCommentId']), payload['replyText'])
with contextlib.redirect_stdout(io.StringIO()):
    doc.save(destination=payload['unpackedDir'], validate=False)

print(json.dumps({'replyId': int(reply_id)}, ensure_ascii=False))
`;

    try {
      const result = await runDocxLibraryJson(script, {
        unpackedDir,
        parentCommentId: pickParam<number>(params, 'parentCommentId', 'parent_comment_id') || 0,
        replyText: pickParam<string>(params, 'replyText', 'reply_text') || '',
        author: pickParam<string>(params, 'author'),
        initials: pickParam<string>(params, 'initials'),
      });
      await postProcessUnpackedWord(unpackedDir);
      return {
        success: true,
        message: `已回复批注 ${pickParam<number>(params, 'parentCommentId', 'parent_comment_id')}\n回复 ID: ${Number(result.replyId) || 0}`,
        data: result,
      };
    } catch (error: any) {
      return { success: false, message: `Error: 回复批注失败: ${error.message}` };
    }
  },
};

const suggestDeletionInWord: SkillDefinition = {
  name: 'docx.suggestDeletionInWord',
  category: 'document',
  displayName: 'Word 红线删除',
  description: '对已解包的 Word 文档节点添加 tracked deletion（红线删除）',
  parameters: [
    { name: 'unpackedDir', type: 'string', description: '已解包目录路径', required: true },
    { name: 'tag', type: 'string', description: '目标标签，默认 w:p', required: false },
    { name: 'lineNumber', type: 'number', description: '目标节点行号', required: false },
    { name: 'contains', type: 'string', description: '目标节点包含文本', required: false },
    { name: 'author', type: 'string', description: '红线作者', required: false },
    { name: 'initials', type: 'string', description: '作者缩写', required: false },
  ],
  execute: async (params) => {
    const unpackedDir = path.resolve(pickParam<string>(params, 'unpackedDir', 'unpacked_dir') || '');
    if (!fs.existsSync(unpackedDir) || !fs.statSync(unpackedDir).isDirectory()) {
      return { success: false, message: `Error: 解包目录不存在: ${unpackedDir}` };
    }

    const script = `
import os, sys, io, json, base64, contextlib

payload = json.loads(base64.b64decode(os.environ['DATAMIND_DOCX_PAYLOAD']).decode('utf-8'))
sys.path.insert(0, payload['skillRoot'])
from scripts.document import Document

with contextlib.redirect_stdout(io.StringIO()):
    doc = Document(
        payload['unpackedDir'],
        track_revisions=True,
        author=payload.get('author') or 'Claude',
        initials=payload.get('initials') or 'C',
    )
editor = doc['word/document.xml']
kwargs = {}
if payload.get('lineNumber') is not None:
    kwargs['line_number'] = int(payload['lineNumber'])
if payload.get('contains'):
    kwargs['contains'] = payload['contains']
node = editor.get_node(tag=payload.get('tag') or 'w:p', **kwargs)
editor.suggest_deletion(node)
with contextlib.redirect_stdout(io.StringIO()):
    doc.save(destination=payload['unpackedDir'], validate=False)

print(json.dumps({'applied': True}, ensure_ascii=False))
`;

    try {
      await runDocxLibraryJson(script, {
        unpackedDir,
        tag: pickParam<string>(params, 'tag'),
        lineNumber: pickParam<number>(params, 'lineNumber', 'line_number'),
        contains: pickParam<string>(params, 'contains'),
        author: pickParam<string>(params, 'author'),
        initials: pickParam<string>(params, 'initials'),
      });
      await postProcessUnpackedWord(unpackedDir);
      return {
        success: true,
        message: `已在解包目录中添加红线删除: ${unpackedDir}`,
      };
    } catch (error: any) {
      return { success: false, message: `Error: 红线删除失败: ${error.message}` };
    }
  },
};

const trackReplaceTextInWord: SkillDefinition = {
  name: 'docx.trackReplaceTextInWord',
  category: 'document',
  displayName: 'Word 红线替换文本',
  description: '在单个 run 内将旧文本替换为新文本，并生成 deletion/insertion 红线',
  parameters: [
    { name: 'unpackedDir', type: 'string', description: '已解包目录路径', required: true },
    { name: 'findText', type: 'string', description: '待替换旧文本', required: true },
    { name: 'replaceText', type: 'string', description: '替换后文本', required: true },
    { name: 'tag', type: 'string', description: '目标标签，默认 w:r', required: false },
    { name: 'lineNumber', type: 'number', description: '目标节点行号', required: false },
    { name: 'contains', type: 'string', description: '目标节点包含文本，默认使用 findText', required: false },
    { name: 'author', type: 'string', description: '修订作者', required: false },
    { name: 'initials', type: 'string', description: '作者缩写', required: false },
  ],
  execute: async (params) => {
    const unpackedDir = path.resolve(pickParam<string>(params, 'unpackedDir', 'unpacked_dir') || '');
    if (!fs.existsSync(unpackedDir) || !fs.statSync(unpackedDir).isDirectory()) {
      return { success: false, message: `Error: 解包目录不存在: ${unpackedDir}` };
    }

    const script = `
import os, sys, io, json, html, base64, contextlib

payload = json.loads(base64.b64decode(os.environ['DATAMIND_DOCX_PAYLOAD']).decode('utf-8'))
sys.path.insert(0, payload['skillRoot'])
from scripts.document import Document

with contextlib.redirect_stdout(io.StringIO()):
    doc = Document(
        payload['unpackedDir'],
        track_revisions=True,
        author=payload.get('author') or 'Claude',
        initials=payload.get('initials') or 'C',
    )

editor = doc['word/document.xml']
contains = payload.get('contains') or payload['findText']
contains = html.unescape(contains) if contains else contains
tag = payload.get('tag') or 'w:r'
line_number = int(payload['lineNumber']) if payload.get('lineNumber') is not None else None
find_text = normalize_text(payload['findText']) if 'normalize_text' in globals() else html.unescape(payload['findText'])

def normalize_text(value):
    return html.unescape(value or '')

def element_text(node):
    parts = []
    for child in node.childNodes:
        if child.nodeType == child.TEXT_NODE and child.data.strip():
            parts.append(child.data)
        elif child.nodeType == child.ELEMENT_NODE:
            parts.append(element_text(child))
    return normalize_text(''.join(parts))

def collect_run_candidates(container):
    matches = []
    for node in container.getElementsByTagName('w:r'):
        node_text = normalize_text(element_text(node))
        node_xml = normalize_text(node.toxml())
        if contains and contains not in node_text and contains not in node_xml:
            continue
        t_nodes = node.getElementsByTagName('w:t')
        raw_text = t_nodes[0].firstChild.data if len(t_nodes) == 1 and t_nodes[0].firstChild else ''
        search_text = normalize_text(raw_text) if raw_text else node_xml
        if find_text in search_text:
            matches.append(node)
    return matches

kwargs = {}
if line_number is not None:
    kwargs['line_number'] = line_number
if contains:
    kwargs['contains'] = contains

candidates = []
if tag == 'w:r':
    try:
        direct_run = editor.get_node(tag='w:r', **kwargs)
        candidates = [direct_run]
    except Exception:
        try:
            para = editor.get_node(tag='w:p', **kwargs)
            candidates = collect_run_candidates(para)
        except Exception:
            candidates = []
else:
    container = editor.get_node(tag=tag, **kwargs)
    candidates = collect_run_candidates(container)

if not candidates:
    raise ValueError('未找到满足条件的单 run 文本节点，请先 inspect XML 并提供更精确的 lineNumber')

if len(candidates) > 1:
    exact_matches = []
    for node in candidates:
        t_nodes = node.getElementsByTagName('w:t')
        text = t_nodes[0].firstChild.data if t_nodes and t_nodes[0].firstChild else ''
        if normalize_text(text) == contains:
            exact_matches.append(node)
    if len(exact_matches) == 1:
        target = exact_matches[0]
    else:
        raise ValueError('匹配到多个可替换节点，请补充 lineNumber 精确定位')
else:
    target = candidates[0]

t_nodes = target.getElementsByTagName('w:t')
if len(t_nodes) != 1 or not t_nodes[0].firstChild:
    raise ValueError('当前仅支持单个 w:t 的简单文本 run 替换，请先 inspect XML 后定位更精确的节点')

original_text = normalize_text(element_text(target))
replace_text = normalize_text(payload['replaceText'])
if find_text not in original_text:
    raise ValueError(f"目标节点中未找到待替换文本: {find_text}")

before, after = original_text.split(find_text, 1)
rpr_nodes = target.getElementsByTagName('w:rPr')
rpr_xml = rpr_nodes[0].toxml() if rpr_nodes else ''

def make_run(text):
    return f'<w:r>{rpr_xml}<w:t>{html.escape(text)}</w:t></w:r>'

parts = []
if before:
    parts.append(make_run(before))
parts.append(f'<w:del><w:r>{rpr_xml}<w:delText>{html.escape(find_text)}</w:delText></w:r></w:del>')
parts.append(f'<w:ins><w:r>{rpr_xml}<w:t>{html.escape(replace_text)}</w:t></w:r></w:ins>')
if after:
    parts.append(make_run(after))

editor.replace_node(target, ''.join(parts))
with contextlib.redirect_stdout(io.StringIO()):
    doc.save(destination=payload['unpackedDir'], validate=False)

print(json.dumps({'replaced': True}, ensure_ascii=False))
`;

    try {
      await runDocxLibraryJson(script, {
        unpackedDir,
        findText: pickParam<string>(params, 'findText', 'find_text') || '',
        replaceText: pickParam<string>(params, 'replaceText', 'replace_text') || '',
        tag: pickParam<string>(params, 'tag'),
        lineNumber: pickParam<number>(params, 'lineNumber', 'line_number'),
        contains: pickParam<string>(params, 'contains'),
        author: pickParam<string>(params, 'author'),
        initials: pickParam<string>(params, 'initials'),
      });
      await postProcessUnpackedWord(unpackedDir);
      return { success: true, message: `已在解包目录中完成红线替换: ${unpackedDir}` };
    } catch (error: any) {
      return { success: false, message: `Error: 红线替换失败: ${error.message}` };
    }
  },
};

const revertInsertionInWord: SkillDefinition = {
  name: 'docx.revertInsertionInWord',
  category: 'document',
  displayName: '拒绝插入修订',
  description: '对已解包 Word 文档中的插入修订执行 reject insertion',
  parameters: [
    { name: 'unpackedDir', type: 'string', description: '已解包目录路径', required: true },
    { name: 'tag', type: 'string', description: '目标标签，默认 w:ins', required: false },
    { name: 'lineNumber', type: 'number', description: '目标节点行号', required: false },
    { name: 'contains', type: 'string', description: '目标节点包含文本', required: false },
    { name: 'author', type: 'string', description: '修订作者', required: false },
    { name: 'initials', type: 'string', description: '作者缩写', required: false },
  ],
  execute: async (params) => {
    const unpackedDir = path.resolve(pickParam<string>(params, 'unpackedDir', 'unpacked_dir') || '');
    if (!fs.existsSync(unpackedDir) || !fs.statSync(unpackedDir).isDirectory()) {
      return { success: false, message: `Error: 解包目录不存在: ${unpackedDir}` };
    }

    const script = `
import os, sys, io, json, base64, contextlib

payload = json.loads(base64.b64decode(os.environ['DATAMIND_DOCX_PAYLOAD']).decode('utf-8'))
sys.path.insert(0, payload['skillRoot'])
from scripts.document import Document

with contextlib.redirect_stdout(io.StringIO()):
    doc = Document(
        payload['unpackedDir'],
        track_revisions=True,
        author=payload.get('author') or 'Claude',
        initials=payload.get('initials') or 'C',
    )
editor = doc['word/document.xml']
kwargs = {}
if payload.get('lineNumber') is not None:
    kwargs['line_number'] = int(payload['lineNumber'])
if payload.get('contains'):
    kwargs['contains'] = payload['contains']
node = editor.get_node(tag=payload.get('tag') or 'w:ins', **kwargs)
editor.revert_insertion(node)
with contextlib.redirect_stdout(io.StringIO()):
    doc.save(destination=payload['unpackedDir'], validate=False)

print(json.dumps({'applied': True}, ensure_ascii=False))
`;

    try {
      await runDocxLibraryJson(script, {
        unpackedDir,
        tag: pickParam<string>(params, 'tag'),
        lineNumber: pickParam<number>(params, 'lineNumber', 'line_number'),
        contains: pickParam<string>(params, 'contains'),
        author: pickParam<string>(params, 'author'),
        initials: pickParam<string>(params, 'initials'),
      });
      await postProcessUnpackedWord(unpackedDir);
      return { success: true, message: `已处理插入修订回退: ${unpackedDir}` };
    } catch (error: any) {
      return { success: false, message: `Error: 回退插入修订失败: ${error.message}` };
    }
  },
};

const revertDeletionInWord: SkillDefinition = {
  name: 'docx.revertDeletionInWord',
  category: 'document',
  displayName: '恢复删除修订',
  description: '对已解包 Word 文档中的删除修订执行 revert deletion',
  parameters: [
    { name: 'unpackedDir', type: 'string', description: '已解包目录路径', required: true },
    { name: 'tag', type: 'string', description: '目标标签，默认 w:del', required: false },
    { name: 'lineNumber', type: 'number', description: '目标节点行号', required: false },
    { name: 'contains', type: 'string', description: '目标节点包含文本', required: false },
    { name: 'author', type: 'string', description: '修订作者', required: false },
    { name: 'initials', type: 'string', description: '作者缩写', required: false },
  ],
  execute: async (params) => {
    const unpackedDir = path.resolve(pickParam<string>(params, 'unpackedDir', 'unpacked_dir') || '');
    if (!fs.existsSync(unpackedDir) || !fs.statSync(unpackedDir).isDirectory()) {
      return { success: false, message: `Error: 解包目录不存在: ${unpackedDir}` };
    }

    const script = `
import os, sys, io, json, base64, contextlib

payload = json.loads(base64.b64decode(os.environ['DATAMIND_DOCX_PAYLOAD']).decode('utf-8'))
sys.path.insert(0, payload['skillRoot'])
from scripts.document import Document

with contextlib.redirect_stdout(io.StringIO()):
    doc = Document(
        payload['unpackedDir'],
        track_revisions=True,
        author=payload.get('author') or 'Claude',
        initials=payload.get('initials') or 'C',
    )
editor = doc['word/document.xml']
kwargs = {}
if payload.get('lineNumber') is not None:
    kwargs['line_number'] = int(payload['lineNumber'])
if payload.get('contains'):
    kwargs['contains'] = payload['contains']
node = editor.get_node(tag=payload.get('tag') or 'w:del', **kwargs)
editor.revert_deletion(node)
with contextlib.redirect_stdout(io.StringIO()):
    doc.save(destination=payload['unpackedDir'], validate=False)

print(json.dumps({'applied': True}, ensure_ascii=False))
`;

    try {
      await runDocxLibraryJson(script, {
        unpackedDir,
        tag: pickParam<string>(params, 'tag'),
        lineNumber: pickParam<number>(params, 'lineNumber', 'line_number'),
        contains: pickParam<string>(params, 'contains'),
        author: pickParam<string>(params, 'author'),
        initials: pickParam<string>(params, 'initials'),
      });
      await postProcessUnpackedWord(unpackedDir);
      return { success: true, message: `已恢复删除修订: ${unpackedDir}` };
    } catch (error: any) {
      return { success: false, message: `Error: 恢复删除修订失败: ${error.message}` };
    }
  },
};

const packWord: SkillDefinition = {
  name: 'docx.packWord',
  category: 'document',
  displayName: '打包 Word OOXML',
  description: '将解包后的 OOXML 目录重新打包为 .docx 文档',
  parameters: [
    { name: 'inputDir', type: 'string', description: '已解包目录路径', required: true },
    { name: 'outputPath', type: 'string', description: '输出 .docx 路径', required: true },
  ],
  execute: async (params) => {
    const inputDir = path.resolve(pickParam<string>(params, 'inputDir', 'input_dir', 'unpackedDir', 'unpacked_dir') || '');
    const outputPath = path.resolve(pickParam<string>(params, 'outputPath', 'output_path') || '');

    if (!fs.existsSync(inputDir) || !fs.statSync(inputDir).isDirectory()) {
      return { success: false, message: `Error: 目录不存在: ${inputDir}` };
    }

    try {
      const JSZip = require('jszip');
      const zip = new JSZip();
      const files = walkDirectory(inputDir);

      for (const relativePath of files) {
        zip.file(relativePath, fs.readFileSync(path.join(inputDir, relativePath)));
      }

      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(
        outputPath,
        await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
      );

      return {
        success: true,
        message: `已打包 Word 文档: ${outputPath}\n文件数: ${files.length}`,
        outputPath,
      };
    } catch (error: any) {
      return { success: false, message: `Error: 打包 Word 失败: ${error.message}` };
    }
  },
};

const inspectWordXml: SkillDefinition = {
  name: 'docx.inspectWordXml',
  category: 'document',
  displayName: '查看 Word XML',
  description: '查看 .docx 包中的 XML / rels 文件内容，便于后续 OOXML 编辑',
  parameters: [
    { name: 'path', type: 'string', description: 'Word 文件路径', required: false },
    { name: 'unpackedDir', type: 'string', description: '已解包目录路径', required: false },
    { name: 'partPath', type: 'string', description: '包内路径，如 word/document.xml', required: false },
    { name: 'maxLength', type: 'number', description: '最大返回长度', required: false },
  ],
  execute: async (params) => {
    const filePath = pickParam<string>(params, 'path', 'docPath', 'doc_path');
    const unpackedDir = pickParam<string>(params, 'unpackedDir', 'unpacked_dir', 'inputDir', 'input_dir');
    const partPath = pickParam<string>(params, 'partPath', 'part_path') || 'word/document.xml';
    const maxLength = Math.max(500, Number(pickParam<number>(params, 'maxLength', 'max_length') || 12000));

    try {
      let content = '';

      if (filePath) {
        const resolvedFile = path.resolve(filePath);
        if (!fs.existsSync(resolvedFile)) {
          return { success: false, message: `Error: 文件不存在: ${resolvedFile}` };
        }

        const zip = await loadZip(resolvedFile);
        const entry = zip.file(partPath);
        if (!entry) {
          return { success: false, message: `Error: Word 包中不存在该部件: ${partPath}` };
        }

        content = await entry.async('string');
      } else if (unpackedDir) {
        const resolvedDir = path.resolve(unpackedDir);
        const absolutePartPath = path.join(resolvedDir, partPath);
        if (!fs.existsSync(absolutePartPath)) {
          return { success: false, message: `Error: 解包目录中不存在该部件: ${absolutePartPath}` };
        }

        content = fs.readFileSync(absolutePartPath, 'utf-8');
      } else {
        return { success: false, message: 'Error: 需要提供 path 或 unpackedDir 之一' };
      }

      const truncated = content.length > maxLength
        ? `${content.slice(0, maxLength)}\n...(共${content.length}字符)`
        : content;

      return {
        success: true,
        data: truncated,
        message: `已读取 Word 部件: ${partPath} (${content.length} 字符)`,
      };
    } catch (error: any) {
      return { success: false, message: `Error: 查看 Word XML 失败: ${error.message}` };
    }
  },
};

const validateWordPackage: SkillDefinition = {
  name: 'docx.validateWordPackage',
  category: 'document',
  displayName: '校验 Word 包结构',
  description: '对解包后的 Word OOXML 目录做基础结构校验',
  parameters: [
    { name: 'unpackedDir', type: 'string', description: '已解包目录路径', required: true },
  ],
  execute: async (params) => {
    const unpackedDir = path.resolve(pickParam<string>(params, 'unpackedDir', 'unpacked_dir', 'inputDir', 'input_dir') || '');
    if (!fs.existsSync(unpackedDir) || !fs.statSync(unpackedDir).isDirectory()) {
      return { success: false, message: `Error: 解包目录不存在: ${unpackedDir}` };
    }

    const requiredPaths = [
      '[Content_Types].xml',
      '_rels/.rels',
      'word/document.xml',
      'word/_rels/document.xml.rels',
      'word/styles.xml',
      'word/settings.xml',
    ];

    const missing = requiredPaths.filter((relativePath) =>
      !fs.existsSync(path.join(unpackedDir, relativePath))
    );

    return {
      success: true,
      data: {
        valid: missing.length === 0,
        missing,
      },
      message: missing.length === 0
        ? 'Word 包结构校验通过'
        : `Word 包结构缺少 ${missing.length} 个关键文件`,
    };
  },
};

const createWordDocument: SkillDefinition = {
  name: 'docx.createWordDocument',
  category: 'document',
  displayName: '创建 Word 文档',
  description: '创建一个新的 Word(.docx) 文档',
  parameters: [
    { name: 'outputPath', type: 'string', description: '输出文件路径', required: true },
    { name: 'title', type: 'string', description: '文档标题', required: false },
    { name: 'content', type: 'string', description: '文档内容（纯文本，段落用换行分隔）', required: true },
  ],
  execute: async (params) => {
    try {
      const docx = require('docx');
      const title = pickParam<string>(params, 'title');
      const content = pickParam<string>(params, 'content') || '';
      const paragraphs = content.split('\n').map((line: string) => {
        if (title && line === title) {
          return new docx.Paragraph({ text: line, heading: docx.HeadingLevel.HEADING_1 });
        }
        return new docx.Paragraph({ text: line });
      });

      if (title) {
        paragraphs.unshift(new docx.Paragraph({ text: title, heading: docx.HeadingLevel.TITLE }));
      }

      const doc = new docx.Document({
        sections: [{ properties: {}, children: paragraphs }],
      });

      const outputPath = path.resolve(pickParam<string>(params, 'outputPath', 'output_path') || '');
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      const buffer = await docx.Packer.toBuffer(doc);
      fs.writeFileSync(outputPath, buffer);
      return { success: true, message: `成功创建 Word 文档: ${outputPath}`, outputPath };
    } catch (e: any) {
      return { success: false, message: `Error: 创建 Word 文档失败: ${e.message}` };
    }
  },
};

const generateWordReport: SkillDefinition = {
  name: 'docx.generateWordReport',
  category: 'document',
  displayName: '生成 Word 报告',
  description: '基于数据生成结构化的 Word 报告',
  parameters: [
    { name: 'outputPath', type: 'string', description: '输出文件路径', required: true },
    { name: 'title', type: 'string', description: '报告标题', required: true },
    { name: 'sections', type: 'array', description: '报告章节数组，每项 {heading, content}', required: true },
  ],
  execute: async (params) => {
    try {
      const docx = require('docx');
      const children: any[] = [];
      const title = pickParam<string>(params, 'title', 'report_title') || 'Word 报告';
      const sections = pickParam<any[]>(params, 'sections') || [];

      children.push(new docx.Paragraph({ text: title, heading: docx.HeadingLevel.TITLE }));
      children.push(new docx.Paragraph({ text: '' }));

      const summary = pickParam<string>(params, 'summary');
      if (summary) {
        children.push(new docx.Paragraph({ text: '摘要', heading: docx.HeadingLevel.HEADING_1 }));
        children.push(new docx.Paragraph({ text: summary }));
        children.push(new docx.Paragraph({ text: '' }));
      }

      for (const section of sections) {
        if (section.heading) {
          children.push(new docx.Paragraph({ text: section.heading, heading: docx.HeadingLevel.HEADING_1 }));
        }
        if (section.title && !section.heading) {
          children.push(new docx.Paragraph({ text: section.title, heading: docx.HeadingLevel.HEADING_1 }));
        }
        const lines = (section.content || '').split('\n');
        for (const line of lines) {
          children.push(new docx.Paragraph({ text: line }));
        }
        children.push(new docx.Paragraph({ text: '' }));
      }

      const doc = new docx.Document({
        sections: [{ properties: {}, children }],
      });

      const outputPath = path.resolve(pickParam<string>(params, 'outputPath', 'output_path') || '');
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      const buffer = await docx.Packer.toBuffer(doc);
      fs.writeFileSync(outputPath, buffer);
      return { success: true, message: `成功生成报告: ${outputPath}`, outputPath };
    } catch (e: any) {
      return { success: false, message: `Error: 生成报告失败: ${e.message}` };
    }
  },
};

export const docxSkills: SkillDefinition[] = [
  readWord,
  createWordDocument,
  updateWordContent,
  appendToWord,
  generateWordReport,
  addTableToWord,
  addImageToWord,
  unpackWord,
  packWord,
  inspectWordXml,
  validateWordPackage,
  addCommentToWord,
  replyToWordComment,
  suggestDeletionInWord,
  trackReplaceTextInWord,
  revertInsertionInWord,
  revertDeletionInWord,
];
