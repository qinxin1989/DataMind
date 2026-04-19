---
name: excel
description: Excel 文件读写与分析能力，支持读取工作表、写入表格、结构分析和 JSON 转换
version: 1.0.0
adapter: legacy_skills
actions:
  - name: read_excel
    description: 读取 Excel
  - name: write_excel
    description: 写入 Excel
  - name: analyze_excel
    description: 分析 Excel
  - name: get_excel_sheets
    description: 获取工作表列表
  - name: excel_to_json
    description: 转换为 JSON
---

建议流程：
1. 先用 `get_excel_sheets` 看有哪些工作表
2. 再用 `read_excel` / `analyze_excel` 查看结构
3. 需要交给其他技能处理时，使用 `excel_to_json`

参数兼容：
- 支持旧参数名 `sheet_name`、`max_rows`
- `write_excel` 支持二维数组和对象数组
