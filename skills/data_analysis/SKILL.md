---
name: data_analysis
description: 数据分析与可视化能力，兼容旧版 ai-agent-plus 的 Python 执行、统计分析、图表生成与环境重置动作
version: 1.0.0
adapter: legacy_skills
actions:
  - name: execute_python
    description: 执行 Python 代码
  - name: create_visualization
    description: 生成图表图片
  - name: statistical_analysis
    description: 统计分析
  - name: python_eval
    description: 执行简单表达式
  - name: reset_execution_context
    description: 重置执行环境
---

优先把 `args` 直接传成 JSON 对象或数组，不要再把 JSON 序列化成字符串。

常见用法：
- `execute_python`: 适合 pandas / numpy / matplotlib 分析脚本
- `create_visualization`: 传入 `data`、`chart_type`、`title`、`output_path`
- `statistical_analysis`: 传入数值列表，输出均值、中位数、标准差、四分位数
- `python_eval`: 适合快速求值

兼容说明：
- 旧命名 `data_analysis.execute_python` 会自动映射到当前实现
- `chart_type / output_path / x_label / y_label` 这类旧参数名也可继续使用
