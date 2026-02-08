/**
 * Modular Crawler Skills - AI 爬虫助手技能
 */

import { SkillDefinition, SkillContext, SkillResult } from '../registry';
import axios from 'axios';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { crawlerService } from './service';

// 获取绝对路径工具
const getAbsPath = (...args: string[]) => path.join(process.cwd(), ...args);

console.log('[35m[CRAWLER] DEBUG: src/agent/skills/crawler/index.ts has been loaded successfully! [0m');

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
        console.log('=== [ModularCrawler] START EXECUTION ===');
        console.log('Params:', JSON.stringify(params, null, 2));
        // console.log('Context:', context ? 'Present' : 'Missing');

        const { url, templateId, description } = params;
        const { userId, openai, model } = context;

        console.log(`[ModularCrawler] [DEBUG] 立即抓取触发: ${url} (模板: ${templateId})`);

        try {
            // 使用本地 service
            const service = crawlerService;

            let selectors: any;
            let usedTemplate: any = null;

            if (templateId) {
                usedTemplate = await service.getTemplate(templateId);
                if (usedTemplate) {
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

            // 注意：这里仍然引用模块里的 Python 脚本，以保持一致性
            const enginePath = getAbsPath('modules', 'ai-crawler-assistant', 'backend', 'skills', 'engine.py');
            const dynamicEnginePath = getAbsPath('modules', 'ai-crawler-assistant', 'backend', 'skills', 'dynamic_engine');

            const paginationConfig = {
                enabled: usedTemplate?.paginationEnabled ?? (templateId ? false : true),
                next_selector: usedTemplate?.paginationNextSelector,
                max_pages: usedTemplate?.paginationMaxPages ?? 5,
                // url_pattern: usedTemplate?.paginationUrlPattern
            };

            console.log(`[ModularCrawler] 执行参数: URL=${url}, Pagination=${paginationConfig.enabled}, MaxPages=${paginationConfig.max_pages}`);
            console.log(`[ModularCrawler] 使用选择器: ${JSON.stringify(selectors)}`);

            // --- 动态渲染 ---
            let sourceArg = url;
            let baseUrlArg = '';
            let tempFilePath = '';

            const isDynamic = url.includes('.gov.cn') || usedTemplate?.pageType === 'dynamic';
            if (isDynamic) {
                try {
                    console.log(`[ModularCrawler] 启动 Puppeteer 渲染...`);
                    // 动态 import 避免 TS 编译错误 (如果路径不可达)
                    // const { DynamicEngine } = require(dynamicEnginePath);
                    // 暂时简化处理，不强求 dynamic engine
                    // const html = await DynamicEngine.fetchHtml(url, { waitSelector: selectors.container });
                    // tempFilePath = path.join(os.tmpdir(), `mod_crawler_${Date.now()}.html`);
                    // fs.writeFileSync(tempFilePath, html);
                    // sourceArg = tempFilePath;
                    // baseUrlArg = url;
                    console.warn('[ModularCrawler] 动态渲染暂未在这个路径下启用');
                } catch (e: any) {
                    console.error(`[ModularCrawler] 动态渲染失败 fallback: ${e.message}`);
                }
            }

            // --- 执行 Python ---
            // 确保使用 UTF-8
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
            // 只要 userId 存在，尝试保存结果（支持保存 0 条数据的记录）
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

/**
 * 智能爬虫分析 (用于生成模板)
 */
const analyzeCrawler: SkillDefinition = {
    name: 'crawler.analyze',
    category: 'crawler',
    displayName: '智能爬虫分析',
    description: '分析网页结构并建议选择器',
    parameters: [{ name: 'url', type: 'string', description: '网址', required: true }],
    execute: async (params, context): Promise<SkillResult> => {
        // 简化的分析逻辑，暂时返回空
        return { success: true, data: {} };
    }
};

export const crawlerSkills: SkillDefinition[] = [
    analyzeCrawler,
    extractWebData
];
