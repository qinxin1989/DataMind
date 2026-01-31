/**
 * AI 爬虫助手服务（精简版 - 仅负责 AI 分析）
 * 与现有的 crawlerService 配合使用
 */

import { aiConfigService } from './aiConfigService';
import axios from 'axios';
import { crawlerService } from '../../../agent/skills/crawler/service';

// 获取随机 User-Agent
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

function getRandomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'ai';
  content: string;
}

interface AnalysisResult {
  url: string;
  selectors: any;
  department?: string;
  preview?: any[];
  error?: string;
}

class CrawlerAssistantService {
  /**
   * 核心对话处理方法
   */
  async processChat(messages: ChatMessage[], userId: string, onProgress?: (data: { type: 'text' | 'result' | 'error', content: any }) => void): Promise<{
    text: string;
    results: AnalysisResult[];
  }> {
    const lastMessage = messages[messages.length - 1].content;

    // 1. 提取 URL
    const urls = this.extractUrls(lastMessage);

    // 2. 获取 AI 配置
    const configs = await aiConfigService.getActiveConfigsByPriority();
    if (!configs || configs.length === 0) {
      const err = '未配置 AI 服务';
      onProgress?.({ type: 'error', content: err });
      throw new Error(err);
    }
    const aiConfig = configs[0];
    const OpenAI = require('openai').default;
    const openai = new OpenAI({
      apiKey: aiConfig.apiKey,
      baseURL: aiConfig.baseUrl || undefined
    });

    // 3. 逻辑分发
    if (urls.length > 0) {
      // 模式 A：发现新网址，执行并发可控的分析（引入 3 并发限流，兼顾速度与稳定性）
      console.log(`[CrawlerAssistant] Found ${urls.length} URLs, starting limited concurrency analysis (max 3)...`);

      const welcomeText = `我已为您分析了 ${urls.length} 个网址，并生成了初步的爬虫模板。您可以在下方查看详情并预览效果。`;
      onProgress?.({ type: 'text', content: welcomeText });

      const results: AnalysisResult[] = [];
      const MAX_CONCURRENCY = 3;
      const queue = [...urls];
      const activeTasks: Promise<void>[] = [];

      // 并发执行器
      const runTask = async (url: string) => {
        try {
          const res = await this.analyzeWebpage(url, lastMessage);
          const result = { ...res, url };
          results.push(result);
          onProgress?.({ type: 'result', content: result });
        } catch (e: any) {
          const result = { url, selectors: {}, error: e.message };
          results.push(result);
          onProgress?.({ type: 'result', content: result });
        }
      };

      // 填充并发池
      while (queue.length > 0 || activeTasks.length > 0) {
        while (activeTasks.length < MAX_CONCURRENCY && queue.length > 0) {
          const url = queue.shift()!;
          const task = runTask(url).then(() => {
            activeTasks.splice(activeTasks.indexOf(task), 1);
          });
          activeTasks.push(task);
        }
        if (activeTasks.length > 0) {
          await Promise.race(activeTasks);
        }
      }

      return {
        text: welcomeText,
        results
      };
    } else {
      // 模式 B：无网址，视为反馈或指令，进行上下文对话
      console.log(`[CrawlerAssistant] No URL found, performing contextual refinement...`);

      const systemPrompt = `你是一个精通网页结构和 CSS 选择器的【爬虫专家】。
你的任务是协助用户编写、修正爬虫规则。

能力范围：
1. 解释选择器原理。
2. 根据用户的反馈（如“没抓到数据”、“日期格式不对”）修正之前的选择器配置。
3. 如果用户提供了 HTML 片段，请基于片段精准定位。

对话规则：
- 说话要专业且友好。
- 当你给出修正后的选择器时，必须以 JSON 格式包裹在代码块中，格式如下：
\`\`\`json
{
  "selectors": {
    "container": "...",
    "fields": { "标题": "...", "链接": "...", "日期": "..." }
  }
}
\`\`\`
- 即使没有新网址，也要根据上下文（之前的 URL 和 HTML 采样）来思考。`;

      const response = await openai.chat.completions.create({
        model: aiConfig.model || 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map(m => ({
            role: m.role === 'ai' ? 'assistant' : m.role,
            content: m.content
          }))
        ],
        temperature: 0.7
      });

      const aiText = response.choices[0]?.message?.content || '抱歉，我未能理解您的指令。';
      onProgress?.({ type: 'text', content: aiText });

      // 尝试从 AI 回复中提取 JSON
      const jsonMatch = aiText.match(/```json\s*([\s\S]*?)\s*```/);
      let refinedResult: AnalysisResult[] = [];

      if (jsonMatch) {
        try {
          const config = JSON.parse(jsonMatch[1]);
          if (config.selectors) {
            // 尝试找回最近的一个 URL 进行预览验证
            const prevUrlMatch = [...messages].reverse().find(m => this.extractUrls(m.content).length > 0);
            const url = prevUrlMatch ? this.extractUrls(prevUrlMatch.content)[0] : '';

            const result = {
              url,
              selectors: config.selectors,
              department: config.department
            };
            refinedResult.push(result);
            onProgress?.({ type: 'result', content: result });
          }
        } catch (e) {
          console.warn('[CrawlerAssistant] Failed to parse AI refined JSON');
        }
      }

      return {
        text: aiText,
        results: refinedResult
      };
    }
  }

  /**
   * 提取字符串中的 URL
   */
  private extractUrls(text: string): string[] {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = text.match(urlRegex) || [];
    return [...new Set(matches)]; // 去重
  }

  async analyzeWebpage(url: string, description: string): Promise<AnalysisResult> {
    const startTime = Date.now();
    console.log(`[CrawlerAssistant] >>> Start analysis for: ${url}`);

    // 1. 获取网页 HTML
    const fetchStart = Date.now();
    const htmlContent = await this.fetchWebpageHtml(url);
    console.log(`[CrawlerAssistant] 1. HTML fetched in ${Date.now() - fetchStart}ms (${htmlContent.length} chars)`);

    // 2. 清理 HTML
    const cleanStart = Date.now();
    const cleanedHtml = this.cleanHtml(htmlContent);
    console.log(`[CrawlerAssistant] 2. HTML cleaned in ${Date.now() - cleanStart}ms (${cleanedHtml.length} chars)`);

    // 3. 使用 AI 分析生成选择器
    const configs = await aiConfigService.getActiveConfigsByPriority();
    if (!configs || configs.length === 0) {
      throw new Error('未配置 AI 服务，无法分析网页结构。请在"AI模型配置"中添加启用中的AI配置。');
    }

    const aiConfig = configs[0];
    console.log(`[CrawlerAssistant] 3. Using AI config: ${aiConfig.name} (${aiConfig.model})`);

    const aiStart = Date.now();
    const result = await this.identifySelectorsWithAI(
      url,
      description,
      cleanedHtml,
      aiConfig
    );
    console.log(`[CrawlerAssistant] 4. AI analysis completed in ${Date.now() - aiStart}ms`);

    const { selectors, department } = result;

    // 4. 预览抓取效果
    let preview: any[] | undefined;
    try {
      console.log(`[CrawlerAssistant] 5. Starting preview extraction...`);
      const previewStart = Date.now();
      preview = await this.previewExtraction(url, selectors);
      console.log(`[CrawlerAssistant] 6. Preview extraction completed in ${Date.now() - previewStart}ms (${preview?.length || 0} rows)`);
    } catch (error) {
      console.error('[CrawlerAssistant] Preview failed:', error);
    }

    console.log(`[CrawlerAssistant] <<< Total execution time: ${Date.now() - startTime}ms`);
    return { url, selectors, department, preview };
  }

  /**
   * 获取网页 HTML (优先使用动态引擎)
   */
  private async fetchWebpageHtml(url: string): Promise<string> {
    try {
      // 尝试使用动态引擎抓取（针对 JS 渲染页面）
      const { DynamicEngine } = require('../../../agent/skills/crawler/dynamic_engine');
      console.log(`[CrawlerAssistant] >>> Using DynamicEngine for: ${url}`);
      return await DynamicEngine.fetchHtml(url);
    } catch (dynamicError: any) {
      console.error(`[CrawlerAssistant] !!! Dynamic fetch failed: ${dynamicError.message}`);

      // 降级到静态抓取
      try {
        console.log(`[CrawlerAssistant] >>> Falling back to static fetch for: ${url}`);
        const response = await axios.get(url, {
          headers: { 'User-Agent': getRandomUA() },
          timeout: 30000,
          maxRedirects: 5
        });

        if (typeof response.data !== 'string') {
          throw new Error('无法解析网页内容');
        }

        return response.data;
      } catch (staticError: any) {
        throw new Error(`获取网页失败: ${staticError.message}`);
      }
    }
  }

  /**
   * 极简清理 HTML（仅保留核心结构与关键属性）
   */
  private cleanHtml(html: string): string {
    let cleaned = html;
    // 1. 移除无关紧要的块级标签及其内容
    cleaned = cleaned.replace(/<(script|style|svg|path|iframe|noscript|nav|header|footer|form|input|button|label)\b[^>]*>([\s\S]*?)<\/\1>/gim, '');

    // 2. 移除所有 HTML 注释
    cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

    // 3. 极速降噪：保留核心 tag 和关键属性 (id, class, href)，移除其他所有属性 (如 title, data-*, aria-*, style等)
    // 这一步能减少约 50%-70% 的 Token，让 AI 聚焦于结构
    cleaned = cleaned.replace(/<([a-z1-6]+)\s+[^>]*>/gi, (match, tag) => {
      const id = match.match(/id\s*=\s*["']([^"']*)["']/i);
      const cls = match.match(/class\s*=\s*["']([^"']*)["']/i);
      const href = match.match(/href\s*=\s*["']([^"']*)["']/i);

      let attrs = '';
      if (id) attrs += ` ${id[0]}`;
      if (cls) attrs += ` ${cls[0]}`;
      if (href) attrs += ` ${href[0]}`;

      return `<${tag}${attrs}>`;
    });

    // 4. 内容采样策略：如果依然过长，优先截取 HTML 的中间部分（通常包含列表，头部和尾部多为元数据和全局链接）
    const limit = 40000;
    if (cleaned.length > limit) {
      const start = Math.floor((cleaned.length - limit) / 2);
      cleaned = cleaned.substring(start, start + limit);
    }

    return cleaned;
  }

  /**
   * 获取网页代理 HTML（注入 <base> 标签）
   */
  async getProxyHtml(url: string): Promise<string> {
    const html = await this.fetchWebpageHtml(url);

    // 注入 <base> 标签以解决相对路径资源问题
    const baseTag = `< base href = "${url}" > `;
    if (html.includes('<head>')) {
      return html.replace('<head>', `< head > ${baseTag} `);
    } else if (html.includes('<HEAD>')) {
      return html.replace('<HEAD>', `< HEAD > ${baseTag} `);
    } else {
      return baseTag + html;
    }
  }

  /**
   * 使用 AI 识别选择器
   */
  private async identifySelectorsWithAI(
    url: string,
    description: string,
    html: string,
    aiConfig: any
  ): Promise<any> {
    try {
      const OpenAI = require('openai').default;
      const openai = new OpenAI({
        apiKey: aiConfig.apiKey,
        baseURL: aiConfig.baseUrl || undefined
      });
      const model = aiConfig.model || 'gpt-4o';

      const prompt = `分析 HTML 并返回核心数据的 CSS 选择器 JSON。

目标: ${url}
需求: ${description}

HTML (已极简):
${html}

JSON 格式:
{
  "selectors": {
    "container": "重复行的容器选择器（如 'tr' 或 'li'）",
    "fields": {
      "标题": "相对容器的选择器，如 'a' 或 'td:nth-child(2)'",
      "链接": "a::attr(href)",
      "发布日期": "相对容器的选择器，如 'td:nth-child(3)' 或 '.date'"
    }
  },
  "department": "网站归属部门或组织名称（从页面标题、页眉或URL中提取）"
}

规则:
1. 必须优先选中心主要内容的 TABLE (tr) 或 UL (li)。
2. 若列无类名，必须使用 td:nth-child(n)。
3. 不要包含导航栏。
4. 必须提取并返回department字段，从网页title、面包屑导航或URL路径中识别。`;

      // 处理 Gemini 角色限制: 部分模型不接受 system 角色，将其合并到 user
      const useSystemRole = !aiConfig.model?.includes('gemini');

      const messages = [];
      if (useSystemRole) {
        messages.push({
          role: 'system',
          content: '你是一个网页结构专家。只返回 JSON。'
        });
        messages.push({
          role: 'user',
          content: prompt
        });
      } else {
        messages.push({
          role: 'user',
          content: `【指令】你是一个网页结构专家。请分析 HTML 并只返回 JSON。\n\n${prompt}`
        });
      }

      const response = await openai.chat.completions.create({
        model,
        messages,
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('AI 未返回有效内容');
      }

      const result = JSON.parse(content);
      return result;
    } catch (error: any) {
      console.error('AI analysis failed:', error);
      throw new Error(`AI 分析失败: ${error.message}`);
    }
  }

  /**
   * 预览抓取效果（使用 Python 引擎，支持动态渲染）
   */
  public async previewExtraction(url: string, selectors: any): Promise<any[]> {
    const { exec } = require('child_process');
    const path = require('path');
    const fs = require('fs');
    const os = require('os');

    return new Promise(async (resolve) => {
      // 1. 自动检测 python 路径 (支持 Windows .exe 补全)
      let pythonPath = process.env.PYTHON_PATH || path.join(process.cwd(), '.venv', 'Scripts', 'python');
      if (process.platform === 'win32' && !pythonPath.endsWith('.exe')) {
        const exePath = pythonPath + '.exe';
        if (fs.existsSync(exePath)) pythonPath = exePath;
      }

      const enginePath = path.join(__dirname, '../../../agent/skills/crawler/engine.py');
      const safeSelectors = JSON.stringify(selectors).replace(/"/g, '\\"');

      console.log(`[CrawlerAssistant] Preparing preview for: ${url}`);

      let sourceArg = url;
      let baseUrlArg = '';
      let tempFilePath = '';

      // 2. 尝试使用动态引擎获取内容（解决预览为空的问题）
      try {
        const { DynamicEngine } = require('../../../agent/skills/crawler/dynamic_engine');
        console.log(`[CrawlerAssistant] Fetching dynamic HTML for preview...`);
        const htmlContent = await DynamicEngine.fetchHtml(url);

        const tempDir = os.tmpdir();
        tempFilePath = path.join(tempDir, `preview_${Date.now()}.html`);
        fs.writeFileSync(tempFilePath, htmlContent);

        sourceArg = tempFilePath;
        baseUrlArg = url;
        console.log(`[CrawlerAssistant] Dynamic preview source saved to: ${tempFilePath}`);
      } catch (err: any) {
        console.warn(`[CrawlerAssistant] Preview dynamic fetch failed (${err.message}), using static URL.`);
      }

      // 3. 使用 spawn 替代 exec，能更好地处理 Windows 路径和引号
      const { spawn } = require('child_process');

      // 预览时不启用分页，只抓取第一页
      const paginationConfig = { enabled: false, max_pages: 1 };
      const args = [enginePath, sourceArg, JSON.stringify(selectors), baseUrlArg, JSON.stringify(paginationConfig)];

      console.log(`[CrawlerAssistant] Spawning: ${pythonPath} ${args.map(a => a.length > 100 ? a.substring(0, 100) + '...' : a).join(' ')}`);

      const child = spawn(pythonPath, args, { timeout: 60000 });
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: any) => { stdout += data; });
      child.stderr.on('data', (data: any) => { stderr += data; });

      child.on('close', (code: number) => {
        // 清理临时文件
        if (tempFilePath && fs.existsSync(tempFilePath)) {
          try { fs.unlinkSync(tempFilePath); } catch (e) { }
        }

        if (code !== 0) {
          console.error(`[CrawlerAssistant] Python engine exited with code ${code}. Stderr: ${stderr}`);
          resolve([]);
          return;
        }

        try {
          const jsonStart = stdout.indexOf('{"success":');
          if (jsonStart === -1) {
            console.error('[CrawlerAssistant] No valid JSON in engine output. Stdout:', stdout);
            resolve([]);
            return;
          }
          const jsonStr = stdout.substring(jsonStart);
          const result = JSON.parse(jsonStr);

          if (result.success) {
            resolve(result.data || []);
          } else {
            console.error('[CrawlerAssistant] Crawler engine reported error:', result.error);
            resolve([]);
          }
        } catch (e) {
          console.error('[CrawlerAssistant] Failed to parse engine result:', e, stdout);
          resolve([]);
        }
      });

      child.on('error', (err: any) => {
        if (tempFilePath && fs.existsSync(tempFilePath)) {
          try { fs.unlinkSync(tempFilePath); } catch (e) { }
        }
        console.error('[CrawlerAssistant] Failed to start Python process:', err);
        resolve([]);
      });
    });
  }

  /**
   * 保存爬虫模板（直接调用 crawlerService）
   */
  async saveTemplate(data: {
    name: string;
    description: string;
    url: string;
    department?: string;
    data_type?: string;
    selectors: any;
    userId?: string;
  }): Promise<string> {
    // 转换为 crawlerService 需要的格式
    const fields = Object.entries(data.selectors.fields || {}).map(([name, selector]) => ({
      name,
      selector: String(selector)
    }));

    const template = {
      userId: data.userId || 'admin',
      name: data.name,
      url: data.url,
      department: data.department || '',
      data_type: data.data_type || '', // 增加数据类型支持
      containerSelector: data.selectors.container ? String(data.selectors.container) : undefined,
      fields
    };

    return await crawlerService.saveTemplate(template);
  }

  /**
   * 获取用户模板列表（直接调用 crawlerService）
   */
  async getUserTemplates(userId: string): Promise<any[]> {
    return await crawlerService.getAllTemplates(userId);
  }

  /**
   * 获取单个模板（直接调用 crawlerService）
   */
  async getTemplateById(id: string, userId: string): Promise<any | null> {
    // crawlerService.getTemplate 不检查 userId，这里我们自己检查
    const template = await crawlerService.getTemplate(id);
    if (!template) return null;

    // 简单的权限检查
    if (template.userId !== userId) {
      return null;
    }

    return template;
  }

  /**
   * 删除模板（需要扩展 crawlerService）
   */
  async deleteTemplate(id: string, userId: string): Promise<void> {
    const { pool } = require('../../core/database');

    // 验证权限
    const [templates]: any = await pool.execute(
      'SELECT user_id FROM crawler_templates WHERE id = ?',
      [id]
    );

    if (templates.length === 0) {
      throw new Error('模板不存在');
    }

    if (templates[0].user_id !== userId) {
      throw new Error('无权删除此模板');
    }

    // 先删除字段
    await pool.execute('DELETE FROM crawler_template_fields WHERE template_id = ?', [id]);
    // 再删除模板
    await pool.execute('DELETE FROM crawler_templates WHERE id = ?', [id]);
  }

  /**
   * 更新模板（需要扩展 crawlerService）
   */
  async updateTemplate(id: string, userId: string, data: {
    name?: string;
    description?: string;
    department?: string;
    selectors?: any;
  }): Promise<void> {
    const { pool } = require('../../core/database');
    const { name, description, selectors } = data;

    // 验证权限
    const [templates]: any = await pool.execute(
      'SELECT user_id FROM crawler_templates WHERE id = ?',
      [id]
    );

    if (templates.length === 0) {
      throw new Error('模板不存在');
    }

    if (templates[0].user_id !== userId) {
      throw new Error('无权更新此模板');
    }

    // 更新基本信息
    if (name || description || data.department !== undefined) {
      await pool.execute(
        'UPDATE crawler_templates SET name = COALESCE(?, name), department = COALESCE(?, department) WHERE id = ?',
        [name || null, data.department || null, id]
      );
    }

    // 更新选择器
    if (selectors) {
      // 更新容器选择器
      await pool.execute(
        'UPDATE crawler_templates SET container_selector = ? WHERE id = ?',
        [selectors.container || null, id]
      );

      // 重建字段
      await pool.execute('DELETE FROM crawler_template_fields WHERE template_id = ?', [id]);

      if (selectors.fields) {
        const { v4: uuidv4 } = require('uuid');
        for (const [fieldName, fieldSelector] of Object.entries(selectors.fields)) {
          await pool.execute(
            'INSERT INTO crawler_template_fields (id, template_id, field_name, field_selector) VALUES (?, ?, ?, ?)',
            [uuidv4(), id, fieldName, fieldSelector]
          );
        }
      }
    }
  }
}

export const crawlerAssistantService = new CrawlerAssistantService();
