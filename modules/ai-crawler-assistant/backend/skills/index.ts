/**
 * Modular Crawler Skills - AI 爬虫助手技能
 */

import { SkillDefinition, SkillContext, SkillResult } from '../../../../src/agent/skills/registry';
import axios from 'axios';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { crawlerService } from '../../../../src/agent/skills/crawler/service';

// 获取绝对路径工具
const getAbsPath = (...args: string[]) => path.join(process.cwd(), ...args);

console.log(' [35m[MODULE] DEBUG: modules/ai-crawler-assistant/backend/skills/index.ts has been loaded!  [0m');

/**
 * 结构化提取 CSS 选择器 (AI 辅助)
 */
async function identifySelectors(url: string, description: string, openai: any, model: string): Promise<any> {
    console.log(`[ModularCrawler] Identifying selectors for: ${url}`);
    try {
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
            timeout: 10000
        });

        let htmlSample = response.data;
        if (typeof htmlSample === 'string') {
            htmlSample = htmlSample.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, '')
                .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, '')
                .substring(0, 15000);
        }

        const aiResponse = await openai.chat.completions.create({
            model: model || 'gpt-4o',
            messages: [
                { role: 'system', content: '网页结构分析专家，识别 CSS 选择器并返回 JSON：{"container": "...", "fields": {"字段名": "选择器"}}' },
                { role: 'user', content: `URL: ${url}\n需求: ${description}\nHTML样品:\n${htmlSample}` }
            ],
            temperature: 0.1,
            response_format: { type: 'json_object' }
        });

        return JSON.parse(aiResponse.choices[0].message.content || '{}');
    } catch (e: any) {
        console.error(`[ModularCrawler] AI 分析失败: ${e.message}`);
        return null;
    }
}

/**
 * 核心数据提取技能
 */
const extractWebData: SkillDefinition = {
    name: 'crawler.extract',
    category: 'crawler',
    displayName: '网页数据抓取',
    description: '使用模板或 AI 自动抓取网页结构化数据',
    parameters: [
        { name: 'url', type: 'string', description: '目标网址', required: true },
        { name: 'templateId', type: 'string', description: '模板ID', required: false },
        { name: 'description', type: 'string', description: '需求描述（无模板时使用）', required: false }
    ],
    execute: async (params, context): Promise<SkillResult> => {
        console.log('=== [ModularCrawler-Module] START EXECUTION ===');
        console.log('Params:', JSON.stringify(params, null, 2));

        const { url, templateId, description } = params;
        const { userId, openai, model } = context;

        console.log(`[ModularCrawler] [DEBUG] 立即抓取触发: ${url} (模板: ${templateId})`);

        try {
            // 使用模块本地 service (别名为了兼容代码)
            const service = crawlerService;

            let selectors: any;
            let usedTemplate: any = null;

            if (templateId) {
                // service.getTemplate 可能是异步的
                const tpl = await service.getTemplate(templateId);
                // 注意：crawlerService 返回的结构可能和 src 下的不完全一样，主要看 getTemplate 实现
                // 假设这边的 service 也是兼容的 CrawlerService
                if (tpl) {
                    usedTemplate = tpl;
                    console.log(`[ModularCrawler] Found template: ${usedTemplate.name}`);
                    selectors = {
                        container: usedTemplate.containerSelector,
                        fields: usedTemplate.fields.reduce((acc: any, f: any) => ({ ...acc, [f.name]: f.selector }), {})
                    };
                } else {
                    console.warn(`[ModularCrawler] Template not found: ${templateId}`);
                }
            }

            if (!selectors) {
                if (!openai) return { success: false, message: '未配置 AI，无法自动分析' };
                selectors = await identifySelectors(url, description || '提取列表数据', openai, model || 'gpt-4o');
            }

            if (!selectors || !selectors.container) {
                return { success: false, message: '选择器无效' };
            }

            // --- 环境与引擎路径 ---
            let pythonPath = process.env.PYTHON_PATH || path.join(process.cwd(), '.venv', 'Scripts', 'python');
            if (process.platform === 'win32' && !pythonPath.endsWith('.exe')) {
                const exePath = pythonPath + '.exe';
                if (fs.existsSync(exePath)) pythonPath = exePath;
            }

            // 路径指向相同
            const enginePath = getAbsPath('modules', 'ai-crawler-assistant', 'backend', 'skills', 'engine.py');

            const paginationConfig = {
                enabled: usedTemplate?.paginationEnabled ?? (templateId ? false : true),
                next_selector: usedTemplate?.paginationNextSelector,
                max_pages: usedTemplate?.paginationMaxPages ?? 5,
            };

            console.log(`[ModularCrawler] 执行参数: URL=${url}, Pagination=${paginationConfig.enabled}, MaxPages=${paginationConfig.max_pages}`);
            console.log(`[ModularCrawler] 使用选择器: ${JSON.stringify(selectors)}`);

            // --- 执行 Python ---
            let sourceArg = url;
            let baseUrlArg = '';
            let tempFilePath = '';

            // 动态渲染逻辑暂略，保持简单稳定

            const result: any = await new Promise((resolve) => {
                const args = [enginePath, sourceArg, JSON.stringify(selectors), baseUrlArg, JSON.stringify(paginationConfig)];
                console.log(`[ModularCrawler] Spawn Python Engine: ${pythonPath} ${enginePath}`);

                const child = spawn(pythonPath, args, {
                    env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
                });
                let stdout = '';
                let stderr = '';
                child.stdout.on('data', d => stdout += d.toString());
                child.stderr.on('data', d => {
                    const msg = d.toString();
                    if (!msg.includes('DeprecationWarning')) console.error(`[ModularCrawler-Python]: ${msg.trim()}`);
                    stderr += msg;
                });
                child.on('close', code => {
                    if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
                    if (code !== 0) resolve({ success: false, error: stderr });
                    else {
                        try { resolve(JSON.parse(stdout)); }
                        catch (e) { resolve({ success: false, error: 'JSON Parse Error: ' + stdout }); }
                    }
                });
            });

            if (!result.success) return { success: false, message: `抓取失败: ${result.error || '未知错误'}` };

            // --- 保存结果 ---
            // 注入归属部门和数据类型 (如果使用模板)
            if (usedTemplate && result.data && Array.isArray(result.data)) {
                const extraData: any = {};
                if (usedTemplate.department) extraData["归属部门"] = usedTemplate.department;
                if (usedTemplate.data_type) extraData["数据类型"] = usedTemplate.data_type;

                if (Object.keys(extraData).length > 0) {
                    console.log(`[ModularCrawler] 注入额外信息: ${JSON.stringify(extraData)}`);
                    result.data = result.data.map((item: any) => ({
                        ...extraData,
                        ...item
                    }));
                }
            }

            if (userId && result.data !== undefined) {
                const resultId = await service.saveResults(userId, templateId || 'task', result.data);
                console.log(`[ModularCrawler] SUCCESS: 结果已入库 (ResultID: ${resultId}, Items: ${result.data?.length || 0})`);
            } else {
                console.log(`[ModularCrawler] No userId or invalid data. Items: ${result.data?.length || 0}`);
            }

            return {
                success: true,
                data: result.data || [],
                message: `采集成功，获取 ${result.data.length} 条数据`,
                visualization: {
                    type: 'html',
                    content: service.renderHtml(Object.keys(result.data[0] || {}), result.data)
                }
            };

        } catch (error: any) {
            console.error(`[ModularCrawler] 运行异常: ${error.message}`);
            return { success: false, message: error.message };
        }
    }
};

export const crawlerSkills: SkillDefinition[] = [
    extractWebData
];
