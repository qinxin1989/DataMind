/**
 * Crawler Skills - 爬虫与数据抓取技能
 */

import { SkillDefinition, SkillContext, SkillResult } from '../registry';
import axios from 'axios';
import { exec, spawn } from 'child_process';
import * as path from 'path';
import { crawlerService } from './service';
import { TemplateAnalyzer, AnalyzedTemplate } from './TemplateAnalyzer';
import { CrawlerTemplate, CrawlerTemplateData } from './CrawlerTemplate';

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

            console.log(`[Crawler] Fetching content using DynamicEngine...`);
            let sourceArg = url;
            let baseUrlArg = '';
            let tempFilePath = '';

            try {
                // 尝试使用动态引擎抓取
                const { DynamicEngine } = require('./dynamic_engine');
                const htmlContent = await DynamicEngine.fetchHtml(url);

                // 将 HTML 保存到临时文件
                const fs = require('fs');
                const os = require('os');
                const tempDir = os.tmpdir();
                tempFilePath = path.join(tempDir, `crawler_${Date.now()}.html`);
                fs.writeFileSync(tempFilePath, htmlContent);

                sourceArg = tempFilePath;
                baseUrlArg = url; // 传递原始 URL 用于解析相对链接
                console.log(`[Crawler] Dynamic content saved to: ${tempFilePath}`);

            } catch (err: any) {
                console.warn(`[Crawler] Dynamic fetch failed (${err.message}), falling back to static crawl.`);
                // Keep sourceArg as url to let python engine do the static fetch
            }

            console.log(`[Crawler] Starting Python engine...`);

            const result: any = await new Promise((resolve) => {
                // 使用 spawn 代替 exec，避免路径问题
                const args = [enginePath, sourceArg, JSON.stringify(selectors), baseUrlArg];
                const pythonProcess = spawn(pythonPath, args, {
                    cwd: process.cwd(),
                    windowsHide: true
                });

                let stdout = '';
                let stderr = '';

                pythonProcess.stdout.on('data', (data) => {
                    stdout += data.toString();
                });

                pythonProcess.stderr.on('data', (data) => {
                    stderr += data.toString();
                });

                pythonProcess.on('close', (code) => {
                    // 清理临时文件
                    if (tempFilePath && require('fs').existsSync(tempFilePath)) {
                        try { require('fs').unlinkSync(tempFilePath); } catch (e) { }
                    }

                    if (code !== 0) {
                        console.error('[Crawler] Python stderr:', stderr);
                        resolve({ success: false, message: `引擎执行失败 (exit code ${code}): ${stderr}` });
                        return;
                    }

                    try {
                        resolve(JSON.parse(stdout));
                    } catch (e) {
                        console.error('[Crawler] Engine output:', stdout);
                        resolve({ success: false, message: '解析引擎输出失败' });
                    }
                });

                pythonProcess.on('error', (error) => {
                    // 清理临时文件
                    if (tempFilePath && require('fs').existsSync(tempFilePath)) {
                        try { require('fs').unlinkSync(tempFilePath); } catch (e) { }
                    }
                    resolve({ success: false, message: `启动 Python 失败: ${error.message}` });
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

// 智能爬虫分析技能
const analyzeCrawler: SkillDefinition = {
    name: 'crawler.analyze',
    category: 'crawler',
    displayName: '智能爬虫分析',
    description: '分析网址并自动生成爬虫模板选择器',
    parameters: [
        { name: 'url', type: 'string', description: '目标网页地址', required: true },
        { name: 'description', type: 'string', description: '需要提取的内容描述（可选）', required: false }
    ],
    execute: async (params, context): Promise<SkillResult> => {
        const { url, description } = params;

        if (!url || !url.startsWith('http')) {
            return { success: false, message: '无效的网址，请确保以 http 或 https 开头' };
        }

        try {
            // 使用 TemplateAnalyzer 分析网页
            const analyzed = await TemplateAnalyzer.analyze(url, description);

            // 验证模板
            const validation = await TemplateAnalyzer.validateTemplate(analyzed);

            return {
                success: true,
                data: {
                    template: analyzed,
                    validation,
                    recommendation: {
                        canSave: validation.valid,
                        suggestedName: analyzed.name,
                        fields: analyzed.fields.map(f => `${f.name}: ${f.selector}`).join('\n')
                    }
                },
                message: `分析完成！置信度: ${analyzed.confidence}%\n` +
                    `页面类型: ${analyzed.pageType}\n` +
                    `容器选择器: ${analyzed.containerSelector}\n` +
                    `字段数量: ${analyzed.fields.length}\n` +
                    (validation.issues.length > 0 ? `\n注意事项:\n${validation.issues.join('\n')}` : '')
            };
        } catch (error: any) {
            console.error(`[Crawler.Analyze] Error: ${error.message}`);
            return { success: false, message: `分析失败: ${error.message}` };
        }
    }
};

// 使用模板提取数据技能
const extractWithTemplate: SkillDefinition = {
    name: 'crawler.extract',
    category: 'crawler',
    displayName: '爬虫数据提取',
    description: '使用模板从网址提取数据（如果没有模板会自动分析）',
    parameters: [
        { name: 'url', type: 'string', description: '目标网页地址', required: true },
        { name: 'templateId', type: 'string', description: '模板ID（可选，不提供则自动分析）', required: false },
        { name: 'saveTemplate', type: 'boolean', description: '是否将自动分析的模板保存', required: false },
        { name: 'templateName', type: 'string', description: '保存模板的名称（如果saveTemplate为true）', required: false }
    ],
    execute: async (params, context): Promise<SkillResult> => {
        const { url, templateId, saveTemplate, templateName } = params;
        const { userId } = context;

        if (!url || !url.startsWith('http')) {
            return { success: false, message: '无效的网址' };
        }

        try {
            let selectors: any;
            let usedTemplate: CrawlerTemplateData | null = null;

            // 1. 加载或创建模板
            if (templateId) {
                // 使用已有模板
                const template = await crawlerService.getTemplate(templateId);
                if (template) {
                    selectors = {
                        container: template.containerSelector || '',
                        fields: template.fields.reduce((acc: any, f) => ({ ...acc, [f.name]: f.selector }), {})
                    };
                    usedTemplate = {
                        ...template,
                        containerSelector: template.containerSelector || ''
                    };
                    console.log(`[Crawler] Using template: ${templateId}`);
                } else {
                    return { success: false, message: `未找到模板: ${templateId}` };
                }
            } else {
                // 自动分析并生成模板
                const analyzed = await TemplateAnalyzer.analyze(url);

                selectors = {
                    container: analyzed.containerSelector,
                    fields: analyzed.fields.reduce((acc: any, f) => ({ ...acc, [f.name]: f.selector }), {})
                };

                // 保存模板（如果需要）
                if (saveTemplate && userId) {
                    const templateData: CrawlerTemplateData = {
                        userId,
                        name: templateName || analyzed.name,
                        url,
                        pageType: analyzed.pageType,
                        containerSelector: analyzed.containerSelector,
                        fields: analyzed.fields,
                        autoGenerated: true,
                        tags: analyzed.metadata.suggestedTags,
                        confidence: analyzed.confidence
                    };

                    const newTemplateId = await crawlerService.saveTemplate(templateData);
                    console.log(`[Crawler] Saved auto-generated template: ${newTemplateId}`);
                }
            }

            // 2. 执行爬取
            const pythonPath = process.env.PYTHON_PATH || path.join(process.cwd(), '.venv', 'Scripts', 'python');
            const enginePath = path.join(__dirname, 'engine.py');
            const safeSelectors = JSON.stringify(selectors).replace(/"/g, '\\"');

            console.log(`[Crawler] Extracting data from: ${url}`);

            // 判断是否需要动态渲染
            const needDynamic = usedTemplate?.pageType === 'dynamic' ||
                (!templateId && url.includes('.gov.cn'));

            let sourceArg = url;
            let baseUrlArg = '';
            let tempFilePath = '';

            if (needDynamic) {
                try {
                    const { DynamicEngine } = require('./dynamic_engine');
                    const { getProvinceConfigByUrl } = require('./provinces.config');
                    const config = getProvinceConfigByUrl(url);

                    const htmlContent = await DynamicEngine.fetchHtml(url, {
                        cookies: config?.cookies,
                        headers: config?.headers,
                        waitSelector: config?.waitSelector
                    });

                    const fs = require('fs');
                    const os = require('os');
                    const tempDir = os.tmpdir();
                    tempFilePath = path.join(tempDir, `crawler_${Date.now()}.html`);
                    fs.writeFileSync(tempFilePath, htmlContent);

                    sourceArg = tempFilePath;
                    baseUrlArg = url;
                    console.log(`[Crawler] Using dynamic engine`);
                } catch (err: any) {
                    console.warn(`[Crawler] Dynamic fetch failed: ${err.message}, using static`);
                }
            }

            const result: any = await new Promise((resolve) => {
                // 准备分页配置 - 默认启用全页采集
                const paginationConfig = {
                    enabled: true,
                    next_selector: usedTemplate?.paginationNextSelector || undefined,
                    max_pages: usedTemplate?.paginationMaxPages || 50  // 默认最多50页
                };

                console.log(`[Crawler] Running with pagination: enabled, max_pages: ${paginationConfig.max_pages}`);

                // 使用 spawn 代替 exec
                const args = [
                    enginePath,
                    sourceArg,
                    JSON.stringify(selectors),
                    baseUrlArg,
                    JSON.stringify(paginationConfig)
                ];

                const pythonProcess = spawn(pythonPath, args, {
                    cwd: process.cwd(),
                    windowsHide: true
                });

                let stdout = '';
                let stderr = '';

                pythonProcess.stdout.on('data', (data) => {
                    stdout += data.toString();
                });

                pythonProcess.stderr.on('data', (data) => {
                    stderr += data.toString();
                });

                pythonProcess.on('close', (code) => {
                    if (tempFilePath && require('fs').existsSync(tempFilePath)) {
                        try { require('fs').unlinkSync(tempFilePath); } catch (e) { }
                    }

                    if (code !== 0) {
                        console.error('[Crawler] Python stderr:', stderr);
                        resolve({ success: false, error: `执行失败 (exit code ${code}): ${stderr}` });
                        return;
                    }

                    try {
                        resolve(JSON.parse(stdout));
                    } catch (e) {
                        console.error('[Crawler] Engine output:', stdout);
                        resolve({ success: false, error: '解析失败' });
                    }
                });

                pythonProcess.on('error', (error) => {
                    if (tempFilePath && require('fs').existsSync(tempFilePath)) {
                        try { require('fs').unlinkSync(tempFilePath); } catch (e) { }
                    }
                    resolve({ success: false, error: `启动 Python 失败: ${error.message}` });
                });
            });

            if (!result.success) {
                return { success: false, message: `抓取失败: ${result.error || '未知错误'}` };
            }

            // 3. AI智能分类（如果有OpenAI）
            const { openai, model } = context;
            if (openai && result.data.length > 0) {
                console.log(`[Crawler] AI categorizing ${result.data.length} items...`);

                try {
                    const itemsToCategorize = result.data.map((item: any, index: number) => ({
                        index,
                        title: item['标题'] || item['title'] || '无标题'
                    }));

                    const aiResponse = await openai.chat.completions.create({
                        model: model || 'gpt-4o',
                        messages: [
                            {
                                role: 'system',
                                content: `你是一个内容分类专家。请将标题分类为"政策"、"解读"、"新闻"、"通知"之一。

政策类：通知、公告、意见、办法、规定、印发、发布、决定、命令、规划、方案
解读类：解读、解析、回答、专家谈、访谈、图解、问答、说明
新闻类：新闻、动态、资讯、报道
通知类：公示、公告、通告

返回JSON: {"categories": ["类型1", "类型2", ...]}`
                            },
                            {
                                role: 'user',
                                content: `标题列表：\n${itemsToCategorize.map((it: any) => `${it.index + 1}. ${it.title}`).join('\n')}`
                            }
                        ],
                        temperature: 0.1,
                        response_format: { type: 'json_object' }
                    });

                    const categories = JSON.parse(aiResponse.choices[0].message.content || '{}').categories;
                    if (Array.isArray(categories)) {
                        result.data.forEach((item: any, index: number) => {
                            if (categories[index]) {
                                item['类型'] = categories[index];
                            }
                        });
                    }
                } catch (catError) {
                    console.error('[Crawler] AI categorization failed:', catError);
                }
            }

            // 4. 保存结果
            if (userId && result.data.length > 0) {
                const resultId = await crawlerService.saveResults(
                    userId,
                    templateId || 'auto_extraction',
                    result.data
                );
                console.log(`[Crawler] Results saved: ${resultId}`);
            }

            // 5. 返回结果
            const fields = Object.keys(result.data[0] || {});
            const htmlOutput = crawlerService.renderHtml(fields, result.data);

            return {
                success: true,
                data: result.data,
                message: `成功抓取 ${result.count} 条数据`,
                visualization: {
                    type: 'html',
                    content: htmlOutput
                }
            };

        } catch (error: any) {
            console.error(`[Crawler.Extract] Error: ${error.message}`);
            return { success: false, message: `抓取失败: ${error.message}` };
        }
    }
};

// 智能标签选择技能 - 根据需求判断应该选择哪个标签
const selectTagByRequirement: SkillDefinition = {
    name: 'crawler.selectTag',
    category: 'crawler',
    displayName: '智能标签选择',
    description: '根据用户需求自动判断应该选择哪个标签来提取数据',
    parameters: [
        { name: 'requirement', type: 'string', description: '用户的数据需求描述', required: true },
        { name: 'availableTags', type: 'array', description: '网页上可用的标签列表', required: true },
        { name: 'tagDescriptions', type: 'object', description: '（可选）标签的详细描述，帮助AI理解', required: false }
    ],
    execute: async (params, context): Promise<SkillResult> => {
        const { requirement, availableTags, tagDescriptions } = params;
        const { openai, model } = context;

        if (!requirement || !Array.isArray(availableTags) || availableTags.length === 0) {
            return { success: false, message: '缺少必要参数：requirement 和 availableTags' };
        }

        if (!openai) {
            return { success: false, message: '此功能需要 AI 服务支持' };
        }

        try {
            console.log(`[Crawler.SelectTag] Analyzing requirement: "${requirement}"`);
            console.log(`[Crawler.SelectTag] Available tags: ${availableTags.join(', ')}`);

            // 构建标签描述信息
            let tagInfo = availableTags.map(tag => {
                const desc = tagDescriptions?.[tag];
                return desc ? `- ${tag}: ${desc}` : `- ${tag}`;
            }).join('\n');

            const prompt = `你是一个网页内容分析专家。根据用户的数据需求，判断应该选择哪个标签来提取数据。

用户需求：${requirement}

可用的标签：
${tagInfo}

请分析用户的需求，判断应该选择哪个标签。返回 JSON 格式：
{
  "selectedTag": "选中的标签名称",
  "confidence": 0-100,
  "reasoning": "选择这个标签的原因",
  "alternativeTags": ["其他可能的标签"],
  "extractionHints": "提取数据时的建议"
}

规则：
1. 必须从可用标签中选择一个
2. 如果有多个标签都可能，选择最相关的一个
3. confidence 表示选择的置信度（0-100）
4. 如果置信度低于 50，请在 reasoning 中说明`;

            const response = await openai.chat.completions.create({
                model: model || 'gpt-4o',
                messages: [
                    {
                        role: 'system',
                        content: '你是一个网页内容分析专家。请根据用户需求选择最合适的标签。'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3,
                response_format: { type: 'json_object' }
            });

            const result = JSON.parse(response.choices[0].message.content || '{}');

            // 验证返回的标签是否在可用标签中
            if (!availableTags.includes(result.selectedTag)) {
                console.warn(`[Crawler.SelectTag] AI selected invalid tag: ${result.selectedTag}, falling back to first available`);
                result.selectedTag = availableTags[0];
                result.confidence = 30;
                result.reasoning = '无法准确判断，使用默认标签';
            }

            return {
                success: true,
                data: result,
                message: `已选择标签: ${result.selectedTag} (置信度: ${result.confidence}%)`
            };

        } catch (error: any) {
            console.error(`[Crawler.SelectTag] Error: ${error.message}`);
            return { success: false, message: `标签选择失败: ${error.message}` };
        }
    }
};

export const crawlerSkills: SkillDefinition[] = [
    analyzeCrawler,
    extractWithTemplate,
    selectTagByRequirement
];
