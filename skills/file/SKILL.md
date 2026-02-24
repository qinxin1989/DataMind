---
name: file
description: 文件与目录操作（读取/写入/搜索/创建/删除）
version: 1.0.0
adapter: auto_legacy
actions:
  - name: readFile
    description: 读取文本文件内容，支持指定行范围
  - name: writeFile
    description: 写入文本文件内容
  - name: listDirectory
    description: 列出目录内容
  - name: searchFiles
    description: 按 glob 模式搜索文件
  - name: createDirectory
    description: 创建目录（含父目录）
  - name: deletePath
    description: 删除文件或目录
---

使用绝对路径。写入/删除操作需要谨慎确认。
