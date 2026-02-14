
import { SkillDefinition, SkillResult } from '../registry';

/**
 * 综合分析报告技能
 * 生成包含多维度分析、图表和业务洞察的完整报告
 */
export const comprehensiveReport: SkillDefinition = {
    name: 'report.comprehensive',
    category: 'report',
    displayName: '综合分析报告',
    description: '生成某一主题的深度分析报告，包含图表和业务洞察',
    parameters: [
        { name: 'topic', type: 'string', description: '分析主题', required: true },
        { name: 'datasourceId', type: 'string', description: '数据源ID', required: false, default: 'current' },
        { name: 'aspects', type: 'array', description: '分析维度列表', required: false }
    ],
    execute: async (params, context): Promise<SkillResult> => {
        const { topic, aspects } = params;

        if (!context.dataSource) {
            return { success: false, message: '数据源未配置' };
        }

        try {
            const schemas = await context.dataSource.getSchema();
            const schemaContext = schemas.map(t => `${t.tableName} (${t.columns.map(c => c.name).join(',')})`).join('\n');

            // 1. 规划分析维度
            const prompt = `作为高级数据分析师，请针对主题"${topic}"规划分析报告的章节结构。
数据表结构:
${schemaContext}
${aspects ? `\n关注维度: ${aspects.join(', ')}` : ''}

请返回 JSON:
{
  "title": "报告标题",
  "summary": "报告摘要",
  "sections": [
    {
      "title": "章节标题",
      "description": "分析内容描述",
      "sql": "查询该章节所需数据的SQL (可选，如果纯文字分析则不需要)",
      "chartType": "bar/line/pie/none",
      "chartConfig": { "xField": "...", "yField": "..." }
    }
  ]
}`;

            if (!context.openai || !context.model) {
                return { success: false, message: 'AI 模型未配置' };
            }

            const response = await context.openai.chat.completions.create({
                model: context.model,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1,
                response_format: { type: 'json_object' }
            });

            const plan = JSON.parse(response.choices[0].message.content || '{}');
            if (!plan.sections) {
                return { success: false, message: '报告规划失败' };
            }

            // 2. 执行每个章节的查询并生成内容
            const finalSections = [];
            const charts = [];

            for (const section of plan.sections) {
                let content = section.description;
                let chartData = undefined;

                if (section.sql) {
                    try {
                        const queryRes = await context.dataSource.executeQuery(section.sql);
                        if (queryRes.success && queryRes.data && queryRes.data.length > 0) {
                            // 简单格式化数据为表格文本
                            const rows = queryRes.data.slice(0, 5);
                            content += `\n\n**相关数据**:\n` + JSON.stringify(rows, null, 2);

                            if (section.chartType && section.chartType !== 'none') {
                                chartData = {
                                    type: section.chartType,
                                    title: section.title,
                                    data: queryRes.data,
                                    config: section.chartConfig
                                };
                                charts.push(chartData);
                            }
                        }
                    } catch (e) {
                        console.warn(`Query failed for section ${section.title}:`, e);
                    }
                }

                finalSections.push({
                    title: section.title,
                    content: content,
                    chart: chartData
                });
            }

            // 3. 生成最终 Markdown
            let markdown = `# ${plan.title}\n\n> ${plan.summary}\n\n`;
            for (const section of finalSections) {
                markdown += `## ${section.title}\n\n${section.content}\n\n`;
            }

            return {
                success: true,
                data: markdown,
                message: '报告生成成功',
                visualization: charts.length > 0 ? charts[0] : undefined // 目前只支持返回一个主要可视化，或者让前端支持多个
            };

        } catch (error: any) {
            return { success: false, message: `报告生成失败: ${error.message}` };
        }
    }
};
