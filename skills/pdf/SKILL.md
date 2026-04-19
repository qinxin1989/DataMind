---
name: pdf
description: PDF 文档读取、合并、拆分、文本提取和图片提取能力，兼容旧版 pdf skill 的动作命名
version: 1.0.0
adapter: legacy_skills
actions:
  - name: read_pdf
    description: 读取 PDF 内容（文本优先）
  - name: merge_pdf
    description: 合并多个 PDF 文件
  - name: split_pdf
    description: 按页或页码范围拆分 PDF
  - name: extract_pdf_text
    description: 提取 PDF 原始文本，不做 OCR
  - name: extract_pdf_images
    description: 提取 PDF 内嵌图片资源
---

适合场景：
- 先 `read_pdf` 快速理解文档正文
- 需要更干净的原始文本时，用 `extract_pdf_text`
- 需要拿出图表、截图、扫描图片时，用 `extract_pdf_images`
- 多文件归档或整理时，用 `merge_pdf` / `split_pdf`

实现说明：
- 读取优先使用 `pdf-parse`
- 合并 / 拆分使用 `pdf-lib`
- 文本提取和图片提取走 Python + `fitz`

兼容说明：
- 旧命名 `pdf.read_pdf`、`pdf.merge_pdf`、`pdf.split_pdf`、`pdf.extract_pdf_text`、`pdf.extract_pdf_images` 可继续使用
- `input_path`、`output_path`、`page_ranges` 等旧参数名仍可沿用
