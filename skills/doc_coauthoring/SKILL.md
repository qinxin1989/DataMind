---
name: docCoauthoring
description: 分阶段文档协作工作流，覆盖脚手架创建、上下文收集、结构规划、分节起草、审阅、读者测试和修订合并
version: 1.0.0
adapter: auto_legacy
actions:
  - name: createScaffold
    description: 生成 Markdown 文档脚手架，可直接输出为文件
  - name: collectContext
    description: 整理上下文、缺失信息和澄清问题
  - name: planStructure
    description: 规划章节结构、章节目的和推荐起草顺序
  - name: brainstormSection
    description: 针对某个章节输出澄清问题和候选要点
  - name: draftSection
    description: 根据选定要点起草某一章节
  - name: reviseSection
    description: 根据用户反馈对章节做定向精修
  - name: review
    description: 对文档内容进行审阅，指出空话、重复和改写建议
  - name: readerTest
    description: 从陌生读者视角测试文档是否可理解、可检索、可回答问题
  - name: mergeRevisions
    description: 合并多个版本的文档修订内容
---

建议流程：
1. `createScaffold` 先搭文档骨架
2. `collectContext` 整理背景、缺失信息和澄清问题
3. `planStructure` 确定章节结构和起草顺序
4. 对难写章节使用 `brainstormSection`
5. 用 `draftSection` 起草单节
6. 收到反馈后用 `reviseSection` 做外科式修改
7. 初稿出来后用 `review` 找问题
8. 完整文档再跑 `readerTest`
9. 多个版本冲突时用 `mergeRevisions`

能力特点：
- 更像“协作写作流程编排”，不是一次性大段生成
- 适合 PRD、技术方案、RFC、设计文档、决策记录、复盘总结
- `createScaffold` 可在没有 OpenAI 的情况下直接工作
- 其余动作需要 OpenAI 实例
