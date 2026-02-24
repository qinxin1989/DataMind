---
name: shell
description: 执行系统命令（谨慎使用）
version: 1.0.0
adapter: auto_legacy
actions:
  - name: runCommand
    description: 执行命令行命令并返回结果
---

优先使用更安全的专用技能；仅在必要时执行命令。禁止执行高危命令。
