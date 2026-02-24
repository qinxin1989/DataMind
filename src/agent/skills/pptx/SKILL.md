---
name: pptx
description: PPTX 演示文稿 OOXML 级操作（文本替换、幻灯片重排）
version: 0.2.0
adapter: auto_legacy
actions:
  - name: inventory
    description: 列出 PPTX 幻灯片内容摘要
  - name: replaceText
    description: 按映射批量替换 PPTX 文本
  - name: rearrange
    description: 按指定顺序重排幻灯片
---

依赖：jszip（OOXML 解包/打包）。
