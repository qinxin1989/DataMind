---
name: pdf
description: PDF 文档操作（读取/合并/拆分）
version: 1.0.0
adapter: auto_legacy
actions:
  - name: readPdf
    description: 读取 PDF 文件的文本内容
  - name: mergePdf
    description: 将多个 PDF 文件合并为一个
  - name: splitPdf
    description: 将 PDF 文件按页拆分
---

读取使用 pdf-parse，合并/拆分使用 pdf-lib。
