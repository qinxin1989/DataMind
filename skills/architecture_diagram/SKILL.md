---
name: diagram
description: 架构图生成（基于 Mermaid 语法）
version: 1.0.0
adapter: auto_legacy
actions:
  - name: generateArchitectureDiagram
    description: 基于 Mermaid 语法生成架构图（SVG/PNG）
---

需要 @mermaid-js/mermaid-cli。如不可用，输出 .mmd 源文件供在线渲染。
