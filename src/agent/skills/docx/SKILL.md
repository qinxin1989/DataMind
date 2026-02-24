---
name: docx
description: Word 文档读写与报告生成（.docx）
version: 0.2.0
adapter: auto_legacy
actions:
  - name: readWord
    description: 读取 Word 文档
  - name: createWordDocument
    description: 创建 Word 文档
  - name: generateWordReport
    description: 生成结构化 Word 报告
---

依赖：mammoth（读取）、docx（创建）。仅支持 .docx 格式。
