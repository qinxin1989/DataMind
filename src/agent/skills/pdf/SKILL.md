---
name: pdf
description: PDF 文档操作（读取文本、合并、拆分）
version: 0.2.0
adapter: auto_legacy
actions:
  - name: readPdf
    description: 读取 PDF 内容（提取文本）
  - name: mergePdf
    description: 合并多个 PDF
  - name: splitPdf
    description: 拆分 PDF（逐页或按范围）
---

依赖：pdf-parse（读取）、pdf-lib（合并/拆分）。
