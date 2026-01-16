# 文档处理技能 (Document Skills)

## 概述
文档处理技能用于各种文档格式的转换、合并和提取操作。

## 技能列表

### 1. document.pdf_to_word - PDF转Word
**描述**: 将PDF文档转换为Word格式
**参数**:
- `inputPath` (string, required): 输入PDF文件路径
- `outputPath` (string, optional): 输出Word文件路径
- `preserveLayout` (boolean, optional): 是否保留布局，默认true

**返回**:
```json
{
  "success": true,
  "outputPath": "/path/to/output.docx",
  "pageCount": 10
}
```

### 2. document.word_to_pdf - Word转PDF
**描述**: 将Word文档转换为PDF格式
**参数**:
- `inputPath` (string, required): 输入Word文件路径
- `outputPath` (string, optional): 输出PDF文件路径

**返回**:
```json
{
  "success": true,
  "outputPath": "/path/to/output.pdf",
  "pageCount": 10
}
```

### 3. document.merge - 文档合并
**描述**: 合并多个文档为一个
**参数**:
- `inputPaths` (string[], required): 输入文件路径列表
- `outputPath` (string, required): 输出文件路径
- `format` (string, optional): 输出格式 (pdf/docx)

**返回**:
```json
{
  "success": true,
  "outputPath": "/path/to/merged.pdf",
  "totalPages": 50
}
```

### 4. document.extract_text - 文本提取
**描述**: 从文档中提取纯文本内容
**参数**:
- `inputPath` (string, required): 输入文件路径
- `pages` (number[], optional): 指定页码，默认全部

**返回**:
```json
{
  "success": true,
  "text": "提取的文本内容...",
  "pageCount": 10,
  "wordCount": 5000
}
```

### 5. document.extract_tables - 表格提取
**描述**: 从文档中提取表格数据
**参数**:
- `inputPath` (string, required): 输入文件路径
- `format` (string, optional): 输出格式 (json/csv/xlsx)

**返回**:
```json
{
  "success": true,
  "tables": [
    { "page": 1, "data": [...], "rows": 10, "cols": 5 }
  ],
  "totalTables": 3
}
```

### 6. document.split - 文档拆分
**描述**: 将文档按页拆分为多个文件
**参数**:
- `inputPath` (string, required): 输入文件路径
- `outputDir` (string, required): 输出目录
- `pagesPerFile` (number, optional): 每个文件的页数，默认1

**返回**:
```json
{
  "success": true,
  "outputFiles": ["/path/to/page1.pdf", "/path/to/page2.pdf"],
  "totalFiles": 10
}
```

## MCP 调用示例

```json
{
  "tool": "document_convert",
  "arguments": {
    "skill": "document.pdf_to_word",
    "inputPath": "/uploads/report.pdf"
  }
}
```

## 依赖服务
- LibreOffice (用于 Word/PDF 转换)
- pdf-lib (用于 PDF 操作)
- mammoth (用于 Word 解析)
