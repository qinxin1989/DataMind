---
name: doc_coauthoring
description: 分阶段文档协作工作流（脚手架、上下文、结构规划、分节起草、审阅、读者测试、修订合并）
version: 1.0.0
adapter: auto_legacy
actions:
  - name: createScaffold
    description: 生成 Markdown 文档脚手架
  - name: collectContext
    description: 整理上下文、缺失信息和澄清问题
  - name: planStructure
    description: 规划章节结构和起草顺序
  - name: brainstormSection
    description: 对单个章节做问题梳理和要点脑暴
  - name: draftSection
    description: 根据保留要点起草章节内容
  - name: reviseSection
    description: 根据反馈对章节做定向精修
  - name: review
    description: 对文档内容进行审阅并提供修改建议
  - name: readerTest
    description: 从陌生读者视角测试文档理解成本和盲点
  - name: mergeRevisions
    description: 合并多个版本的文档修订
---

`createScaffold` 可直接输出 Markdown 脚手架。

其余动作默认需要 OpenAI 实例，适合：
- PRD / RFC / 技术方案
- 设计文档 / 决策记录
- 复盘总结 / 提案 / 说明文档
