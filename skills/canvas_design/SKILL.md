---
name: canvas
description: 画布设计（海报、信息图、流程图、静态视觉作品），先生成设计哲学，再生成最终画布
version: 1.0.0
adapter: auto_legacy
actions:
  - name: generate
    description: 根据描述生成设计哲学 Markdown 与 HTML 画布设计
---

执行方式：
1. 先生成一份“设计哲学” Markdown，明确视觉方向、节奏、色彩和留白策略
2. 再根据哲学生成单文件 HTML 画布作品

适合任务：
- 海报
- 封面
- 信息图
- 单页视觉表达
- 偏艺术化的流程/关系示意图

使用建议：
- `description` 里描述业务主题、想传达的感觉和必须出现的关键信息
- `theme_hint` 可补充更隐含的审美线索
- `output_path` 输出 HTML
- `philosophy_path` 可选，用于保存设计哲学 Markdown

实现说明：
- 当前输出为可本地打开的 HTML 作品
- 会优先识别 `skills/canvas_design/canvas-fonts` 下的本地字体资产
- 需要 OpenAI 实例
