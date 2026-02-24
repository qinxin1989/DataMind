---
name: architecture_diagram
description: 生成架构图（基于 Mermaid 语法，输出 SVG/PNG）
version: 0.1.0
adapter: auto_legacy
actions:
  - name: generateArchitectureDiagram
    description: 根据 Mermaid 代码生成架构图
---

支持 flowchart、sequence、class、state 等 Mermaid 图表类型。
输出格式支持 SVG 和 PNG。
