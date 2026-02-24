---
name: datamind-qa-rules
description: DataMind AI 问答回答质量规则。在修改 src/agent/index.ts 中 answerWithContext、generateChineseAnswer、explainResultWithContext、generateQuickAnswer、planAction 等问答相关方法时激活。确保 AI 回答准确、不答非所问。
---

# DataMind AI 问答质量规则

## 核心原则
**准确性第一，速度第二。** 宁可多花一次 LLM 调用，也不能给出答非所问的模板回答。

## 问答入口流程
`service.ask()` → `aiAgent.answerWithContext()` 是唯一的生产问答入口。

### answerWithContext 流程
1. **报告检测** → `detectReportIntent()` → 走报告生成
2. **闲聊检测** → `isChitChatQuestion()` → 走固定回复（不耗 token）
3. **质量检测** → 关键词匹配 → 走 `inspectQuality()`
4. **综合分析** → 关键词匹配 → 委托 `answer()` 方法
5. **意图识别** → `isClearDataQuery()` 快判 + `planAction()` AI 路由
   - 明确数据查询关键词（多少/排名/统计/分布/查询等）→ 跳过意图识别，直接走 SQL
   - 模糊问题 → 调用 `planAction()` AI 意图识别
   - `chitchat` → `handleChitChat()`
   - `skill` / `mcp` → 委托 `answer()` 处理
   - `sql` → 继续 SQL 流程
6. **SQL 生成** → `generateSQLWithContext()` → 带缓存
7. **SQL 执行** → 强制 LIMIT 100 防超量
8. **结果验证** → `validateResult()` → 不合理则 `regenerateSQL()` 纠正
9. **AI 回答** → `generateChineseAnswer()` → 传入 SQL + schema 上下文

## 回答生成规则

### 何时用模板（generateQuickAnswer）
必须同时满足两个条件：
1. 数据简单：单行少列(≤3) 或 少量行(≤10)+少量列(≤2)
2. **非分析性问题**：问题不含 趋势/增长/下降/变化/对比/比较/原因/为什么/是否/如何/分析/建议/预测/评价/总结 等关键词
- AI 完全不可用时的最终兖底

### 何时用 AI
- **分析性问题**：即使数据只有 3行2列，问“是否增长”“对比如何”也必须走 AI
- 多行(>10行) 或 多列(>2列) 的复杂结果
- AI 失败 catch 时，对复杂数据先重试简化 AI 调用（15秒硬超时，仅重试1次），失败才退回模板

### 禁止
- ❌ 用行数阈值（如 ≤50 行）跳过 AI 直接走模板
- ❌ `generateQuickAnswer` 处理多行复杂数据
- ❌ AI 回答中说"无法分析""数据不足"（有数据就给结论）
- ❌ `answerWithContext` 跳过意图识别把所有问题当 SQL

## SQL 验证规则
`validateResult()` 检查查询合理性（如世界人口应 60-80 亿），不合理时：
1. 调用 `regenerateSQL()` 带上错误原因
2. 重新执行修正后的 SQL
3. 成功则替换结果，失败则保留原结果

## generateChineseAnswer 上下文传递
必须传入 `executedSql` 和 `schemaContext`，让 AI 理解查询意图和数据含义。

## explainResultWithContext（answer() 路径）
与 `generateChineseAnswer` 保持一致策略：仅单行简单结果用模板，其余全走 AI。
