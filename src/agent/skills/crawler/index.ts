/**
 * Crawler Skills - 爬虫与数据抓取技能
 */

import { SkillDefinition, SkillContext, SkillResult } from '../registry';
import axios from 'axios';
import { exec } from 'child_process';
import * as path from 'path';
import { crawlerService } from './service';

// 常见的 User-Agent 列表
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

// 获取随机 User-Agent
function getRandomUA() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// 结构化提取 CSS 选择器
async function identifySelectors(url: string, description: string, openai: any, model: string): Promise<any> {
    console.log(`[Crawler] Identifying selectors for: ${url}`);

    const response = await axios.get(url, {
        headers: { 'User-Agent': getRandomUA() },
        timeout: 10000
    });

    let htmlSample = response.data;
    if (typeof htmlSample === 'string') {
        htmlSample = htmlSample.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, '');
        htmlSample = htmlSample.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, '');
        htmlSample = htmlSample.substring(0, 20000);
    }

    const aiResponse = await openai.chat.completions.create({
        model: model || 'gpt-4o',
        messages: [
            {
                role: 'system',
                content: `你是一个网页结构分析专家。请根据提供的 HTML 片段，识别用户想要的数据对应的 CSS 选择器。
返回 JSON 格式：
{
  "container": "列表容器的选择器（如果是抓取单条数据则为 null）",
  "fields": {
    "字段名1": "相对于容器的选择器（或顶级选择器）",
    "字段名2": "..."
  }
}

注意：
1. 尽量使用稳定且简洁的选择器（如类名）。
2. 如果是列表，请务必找到包裹每个列表项的共同容器选择器。`
            },
            {
                role: 'user',
                content: `目标网址: ${url}\n需求描述: ${description}\n\nHTML 片段:\n${htmlSample}`
            }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
    });

    return JSON.parse(aiResponse.choices[0].message.content || '{}');
}

// 网页数据提取技能
const extractWebData: SkillDefinition = {
    name: 'crawler.extract',
    category: 'data',
    displayName: '网页数据抓取',
    description: '从指定网址提取结构化数据（支持模板化与持久化存储）',
    parameters: [
        { name: 'url', type: 'string', description: '目标网页地址', required: true },
        { name: 'description', type: 'string', description: '需要提取的内容描述', required: true },
        { name: 'templateId', type: 'string', description: '（可选）已保存的模板 ID', required: false },
        { name: 'templateName', type: 'string', description: '（可选）保存为新模板时的名称', required: false }
    ],
    execute: async (params, context): Promise<SkillResult> => {
        const { url, description, templateId, templateName } = params;
        const { openai, model, userId } = context;

        if (!url.startsWith('http')) {
            return { success: false, message: '无效的网址，请确保以 http 或 https 开头' };
        }

        try {
            let selectors: any;
            let finalTemplateId = templateId;

            // 第一阶段：获取选择器 (从模板加载或 AI 识别)
            if (templateId) {
                const template = await crawlerService.getTemplate(templateId);
                if (template) {
                    selectors = {
                        container: template.containerSelector,
                        fields: template.fields.reduce((acc: any, f) => ({ ...acc, [f.name]: f.selector }), {})
                    };
                    console.log(`[Crawler] Loaded selectors from template: ${templateId}`);
                }
            }

            if (!selectors) {
                if (!openai) {
                    return { success: false, message: '此任务需要 AI 服务识别结构，但当前未配置' };
                }
                selectors = await identifySelectors(url, description, openai, model || 'gpt-4o');

                // 如果用户提供了模板名称，保存为新模板
                if (templateName && userId) {
                    finalTemplateId = await crawlerService.saveTemplate({
                        userId,
                        name: templateName,
                        url,
                        containerSelector: selectors.container,
                        fields: Object.entries(selectors.fields).map(([name, selector]: any) => ({ name, selector }))
                    });
                    console.log(`[Crawler] Saved new template: ${finalTemplateId}`);
                }
            }

            // 第二阶段：执行 Python 引擎
            const pythonPath = process.env.PYTHON_PATH || path.join(process.cwd(), '.venv', 'Scripts', 'python');
            const enginePath = path.join(__dirname, 'engine.py');
            const safeSelectors = JSON.stringify(selectors).replace(/"/g, '\\"');

            console.log(`[Crawler] Starting Python engine...`);

            const result: any = await new Promise((resolve) => {
                exec(`"${pythonPath}" "${enginePath}" "${url}" "${safeSelectors}"`, (error, stdout) => {
                    if (error) {
                        resolve({ success: false, message: `引擎执行失败: ${error.message}` });
                        return;
                    }
                    try {
                        resolve(JSON.parse(stdout));
                    } catch (e) {
                        resolve({ success: false, message: '解析引擎输出失败' });
                    }
                });
            });

            if (!result.success) {
                return { success: false, message: `抓取失败: ${result.error}` };
            }

            // --- 新增：AI 智能分类逻辑 ---
            if (openai && result.data.length > 0) {
                console.log(`[Crawler] Categorizing ${result.data.length} items by AI...`);
                const itemsToCategorize = result.data.map((item: any, index: number) => ({
                    index,
                    title: item['标题'] || item['title'] || '无标题'
                }));

                try {
                    const aiCategoryResponse = await openai.chat.completions.create({
                        model: model || 'gpt-4o',
                        messages: [
                            {
                                role: 'system',
                                content: `你是一个政务数据分类专家。请将提供的网页标题分类为"解读"或"政策"。

分类标准：
【解读类】包含以下关键词之一：
- 解读、解析、回答、专家谈、访谈、图解、问答、说明
- 简明回答、政策问答、一图读懂、图文解读

【政策类】包含以下关键词之一：
- 通知、公告、意见、办法、规定、印发、发布、决定、命令
- 规划、纲要、方案、实施细则、管理办法、暂行规定

特殊规则：
1. 如果标题难以判断，优先归类为"政策"
2. 如果标题同时包含解读和政策关键词，归类为"解读"
3. 每个标题必须且只能归类为"解读"或"政策"之一

只需返回如下格式的 JSON：
{
  "categories": ["类型1", "类型2", ...]
}`
                            },
                            {
                                role: 'user',
                                content: `标题列表：\n${itemsToCategorize.map((it: any) => `${it.index + 1}. ${it.title}`).join('\n')}`
                            }
                        ],
                        temperature: 0.1,
                        response_format: { type: 'json_object' }
                    });

                    const categories = JSON.parse(aiCategoryResponse.choices[0].message.content || '{}').categories;
                    if (Array.isArray(categories)) {
                        result.data.forEach((item: any, index: number) => {
                            if (categories[index]) {
                                // 确保分类结果只能是"解读"或"政策"
                                const category = categories[index];
                                if (category === '解读' || category === '政策') {
                                    item['类型'] = category;
                                } else {
                                    // 如果 AI 返回了其他类型，强制设为"政策"
                                    console.warn(`[Crawler] Invalid category "${category}", defaulting to "政策"`);
                                    item['类型'] = '政策';
                                }
                            }
                        });
                    }
                } catch (catError) {
                    console.error('[Crawler] AI categorization failed:', catError);
                    // 失败了也不影响主流程，保持原样
                }
            }

            // 第三阶段：持久化结果 (如果已知用户或根据任务)
            if (userId && result.data.length > 0) {
                const idToStore = finalTemplateId || 'temp_extraction';
                await crawlerService.saveResults(userId, idToStore, result.data);
            }

            // 第四阶段：可视化与返回
            const fields = Object.keys(result.data[0] || {});
            const htmlOutput = crawlerService.renderHtml(fields, result.data);

            return {
                success: true,
                data: result.data,
                message: `成功抓取 ${result.count} 条记录${finalTemplateId ? '（已保存至模板/结果库）' : ''}`,
                visualization: {
                    type: 'html',
                    content: htmlOutput
                }
            };

        } catch (error: any) {
            console.error(`[Crawler] Error: ${error.message}`);
            return { success: false, message: `抓取任务异常: ${error.message}` };
        }
    }
};

export const crawlerSkills: SkillDefinition[] = [
    extractWebData
];
