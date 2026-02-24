---
name: pptx
description: PowerPoint OOXML 级操作（目录/替换文本/重排幻灯片）
version: 1.0.0
adapter: auto_legacy
actions:
  - name: inventory
    description: 列出 PPTX 中所有幻灯片标题和内容摘要
  - name: replaceText
    description: 在 PPTX 中批量替换文本
  - name: rearrange
    description: 按指定顺序重排幻灯片
---

使用 JSZip 直接操作 OOXML 结构。
