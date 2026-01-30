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

class CrawlerAssistantService {
  /**
   * 分析网页结构并生成选择器（AI 核心功能）
   * 返回选择器和预览数据
   */
  async analyzeWebpage(url: string, description: string): Promise<{
    selectors: any;
    department?: string;
    preview?: any[];
  }> {
    // 1. 获取网页 HTML
    const htmlContent = await this.fetchWebpageHtml(url);

    // 2. 清理 HTML
    const cleanedHtml = this.cleanHtml(htmlContent);

    // 3. 使用 AI 分析生成选择器（获取启用中优先级最高的配置）
    const configs = await aiConfigService.getActiveConfigsByPriority();
    if (!configs || configs.length === 0) {
      throw new Error('未配置 AI 服务，无法分析网页结构。请在"AI模型配置"中添加启用中的AI配置。');
    }

    const aiConfig = configs[0]; // 取优先级最高的
    const result = await this.identifySelectorsWithAI(
      url,
      description,
      cleanedHtml,
      aiConfig
    );

    const { selectors, department } = result;

    // 4. 可选：预览抓取效果（调用 Python 引擎）
    let preview: any[] | undefined;
    try {
      preview = await this.previewExtraction(url, selectors);
    } catch (error) {
      console.error('Preview failed:', error);
    }

    return { selectors, department, preview };
  }

  /**
   * 获取网页 HTML
   */
  private async fetchWebpageHtml(url: string): Promise<string> {
    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': getRandomUA() },
        timeout: 15000,
        maxRedirects: 5
      });

      if (typeof response.data !== 'string') {
        throw new Error('无法解析网页内容');
      }

      return response.data;
    } catch (error: any) {
      throw new Error(`获取网页失败: ${error.message}`);
    }
  }

  /**
   * 清理 HTML（移除 script 和 style）
   */
  private cleanHtml(html: string): string {
    let cleaned = html;
    cleaned = cleaned.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, '');
    cleaned = cleaned.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, '');
    if (cleaned.length > 30000) {
      cleaned = cleaned.substring(0, 30000);
    }
    return cleaned;
  }

  /**
   * 获取网页代理 HTML（注入 <base> 标签）
   */
  async getProxyHtml(url: string): Promise<string> {
    const html = await this.fetchWebpageHtml(url);

    // 注入 <base> 标签以解决相对路径资源问题
    const baseTag = `<base href="${url}">`;
    if (html.includes('<head>')) {
      return html.replace('<head>', `<head>${baseTag}`);
    } else if (html.includes('<HEAD>')) {
      return html.replace('<HEAD>', `<HEAD>${baseTag}`);
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

      const prompt = `你是一个网页结构分析专家。请分析以下 HTML，提取用户需要的数据对应的 CSS 选择器。

目标网址: ${url}
需求描述: ${description}

HTML 片段:
${html}

请返回 JSON 格式：
{
  "selectors": {
    "container": "列表容器的选择器。必须是通用的，能够匹配页面中**所有**重复的列表项。严禁使用 :nth-child(1) 或特定的 ID 等仅能匹配到单个元素的路径。例如：使用 '.news-item' 而不是 '.news-item:nth-child(1)'",
    "fields": {
      "标题": "相对于容器的选择器",
      "链接": "a::attr(href)",
      "发布日期": "...",
      "类型": "如果要处理'政策'或'解读'等标签，请提取其对应的选择器，若无则忽略"
    }
  },
  "department": "识别出的网页归属部门名称（例如：XX省工业和信息化厅），若无法确定则为 null"
}

注意：
1. 提取内容必须直接，对于链接必须使用 a::attr(href) 格式。
2. 尽量提取纯文本（标题、日期、类型名），避免残留 HTML 标签。
3. 如果页面中有明显的类别标识（如“解读”、“政策”、“通知”），请务必作为一个“类型”字段提取。
4. 归属部门通常在页脚（footer）、Meta 标签或顶部 Logo 旁边的文字中。
5. **极其重要**：\`container\` 选择器必须是能够匹配到一个列表中**多个**元素的通用选择器。如果 AI 返回了只能匹配到一个元素的过于具体的选择器，将导致采集失败。
6. 尽量使用稳定的类名选择器（如 .class-name）。
7. 如果页面结构在不同行之间有差异（如有的行带标签装饰，有的没有），切记不要使用 nth-child 等绝对结构路径。
8. **兜底建议**：如果字段（如标题、链接）所在的位置没有唯一的类名，请直接返回基础标签名（如 "a" 或 "span"）作为选择器，我的引擎会自动从中提取信息。
9. 对于“发布日期”，优先寻找包含日期文本的元素。
10. 归属部门通常在页脚（footer）、Meta 标签或顶部 Logo 旁边的文字中。`;

      const response = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: '你是一个网页结构分析专家，擅长识别 CSS 选择器。只返回 JSON 格式的结果，不要有其他内容。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
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
   * 预览抓取效果（使用 Python 引擎）
   */
  public async previewExtraction(url: string, selectors: any): Promise<any[]> {
    const { exec } = require('child_process');
    const path = require('path');

    return new Promise((resolve) => {
      const pythonPath = process.env.PYTHON_PATH || path.join(process.cwd(), '.venv', 'Scripts', 'python');
      const enginePath = path.join(__dirname, '../../../agent/skills/crawler/engine.py');
      const safeSelectors = JSON.stringify(selectors).replace(/"/g, '\\"');

      exec(`"${pythonPath}" "${enginePath}" "${url}" "${safeSelectors}"`, (error: any, stdout: string) => {
        if (error) {
          console.error('[CrawlerAssistant] Python engine error:', error);
          resolve([]);
          return;
        }

        try {
          // 清理 stdout 杂质（如果有终端输出干扰）
          const jsonStart = stdout.indexOf('{"success":');
          if (jsonStart === -1) throw new Error('Invalid JSON output');
          const jsonStr = stdout.substring(jsonStart);

          const result = JSON.parse(jsonStr);
          if (result.success) {
            resolve(result.data || []);
          } else {
            console.error('[CrawlerAssistant] Crawler engine error:', result.error);
            resolve([]);
          }
        } catch (e) {
          console.error('[CrawlerAssistant] Parse result failed:', e, stdout);
          resolve([]);
        }
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
