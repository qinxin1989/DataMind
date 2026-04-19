---
name: docx
description: Word 文档读取、创建、编辑、报告生成和 OOXML 解包检查能力
version: 1.0.0
adapter: auto_legacy
actions:
  - name: readWord
    description: 读取 Word(.docx) 文件的文本内容
  - name: createWordDocument
    description: 创建新的 Word 文档
  - name: updateWordContent
    description: 查找并替换现有文档中的指定文本
  - name: appendToWord
    description: 在文档末尾追加内容
  - name: generateWordReport
    description: 基于数据生成结构化 Word 报告
  - name: addTableToWord
    description: 向文档中插入表格
  - name: addImageToWord
    description: 向文档中插入图片
  - name: unpackWord
    description: 将 .docx 解包为 OOXML 目录
  - name: packWord
    description: 将 OOXML 目录重新打包为 .docx
  - name: inspectWordXml
    description: 查看包内 XML / rels 文件内容
  - name: validateWordPackage
    description: 校验 OOXML 目录关键结构
  - name: addCommentToWord
    description: 在解包目录里按行号或文本定位添加批注
  - name: replyToWordComment
    description: 对已有批注添加回复
  - name: suggestDeletionInWord
    description: 对节点添加 tracked deletion（红线删除）
  - name: trackReplaceTextInWord
    description: 在单个 run 内做 tracked replacement（删除+插入）
  - name: revertInsertionInWord
    description: 拒绝已有插入修订
  - name: revertDeletionInWord
    description: 恢复已有删除修订
---

读取优先使用 mammoth，表格读取和编辑动作走 python-docx；OOXML 动作走 JSZip 目录解包/回包。

适合流程：
- 先 `readWord` 理解原文
- 再 `updateWordContent` / `appendToWord` 做局部修订
- 需要结构化输出时用 `generateWordReport`
- 有图片或统计表时继续用 `addImageToWord`、`addTableToWord`
- 需要深入排查样式、批注、关系文件或后续做 tracked changes 时，先 `unpackWord`
- 修改 `word/document.xml`、`word/comments.xml`、`word/_rels/document.xml.rels` 后，用 `validateWordPackage` + `packWord`
- 想快速查看某个部件时，用 `inspectWordXml`
- 做批注时，用 `addCommentToWord` / `replyToWordComment`
- 做基础红线修订时，用 `suggestDeletionInWord`
- 做简单文本替换红线时，用 `trackReplaceTextInWord`
- 处理已存在的修订时，用 `revertInsertionInWord` / `revertDeletionInWord`

注意：
- 这些高级动作当前优先面向 `unpackWord` 之后的目录工作流
- `lineNumber` 依赖 pretty-printed XML，因此建议先使用本 skill 的 `unpackWord`
- `trackReplaceTextInWord` 当前要求目标文本位于单个 `w:r / w:t` 中，复杂跨 run 替换仍建议先 inspect XML 再处理
