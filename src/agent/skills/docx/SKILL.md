---
name: docx
description: Word 文档读写、OOXML 解包检查、批注和基础红线修订能力（.docx）
version: 1.0.0
adapter: auto_legacy
actions:
  - name: readWord
    description: 读取 Word 文档
  - name: createWordDocument
    description: 创建 Word 文档
  - name: updateWordContent
    description: 替换文档内容
  - name: appendToWord
    description: 追加内容
  - name: generateWordReport
    description: 生成结构化 Word 报告
  - name: addTableToWord
    description: 插入表格
  - name: addImageToWord
    description: 插入图片
  - name: unpackWord
    description: 解包 Word 为 OOXML 目录
  - name: packWord
    description: 从 OOXML 目录打包 Word
  - name: inspectWordXml
    description: 查看包内 XML / rels 内容
  - name: validateWordPackage
    description: 校验 OOXML 目录结构
  - name: addCommentToWord
    description: 在解包目录里添加批注
  - name: replyToWordComment
    description: 回复已有批注
  - name: suggestDeletionInWord
    description: 添加 tracked deletion（红线删除）
  - name: trackReplaceTextInWord
    description: 添加基础版 tracked replacement（删除+插入）
  - name: revertInsertionInWord
    description: 拒绝已有插入修订
  - name: revertDeletionInWord
    description: 恢复已有删除修订
---

依赖：mammoth、docx、python-docx，以及 `skills/docx/` 下的 OOXML Python 辅助脚本。仅支持 .docx 格式。
