/**
 * 公文写作服务
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  DocType,
  DocStyle,
  DocGenerationRequest,
  DocGenerationResponse,
  OfficialDocTemplate,
  DocGenerationHistory,
  TemplateQueryParams,
  TemplateQueryResult,
  HistoryQueryParams,
  HistoryQueryResult,
  OfficialDocConfig
} from './types';

export class OfficialDocService {
  private db: any;
  private config: OfficialDocConfig;
  private aiConfigService: any;

  constructor(db: any, config?: Partial<OfficialDocConfig>) {
    this.db = db;
    this.config = {
      enableAI: true,
      maxPointsLength: 5000,
      maxHistoryDays: 90,
      enableExport: true,
      enableTemplates: true,
      ...config
    };
  }

  /**
   * 设置 AI 配置服务
   */
  setAIConfigService(aiConfigService: any) {
    this.aiConfigService = aiConfigService;
  }

  /**
   * 生成公文
   */
  async generateDoc(request: DocGenerationRequest, userId: string): Promise<DocGenerationResponse> {
    const { type, style, points, templateId } = request;

    // 验证输入
    if (!points || points.trim().length === 0) {
      return {
        success: false,
        error: '请输入核心要点'
      };
    }

    if (points.length > this.config.maxPointsLength) {
      return {
        success: false,
        error: `核心要点过长，最大支持 ${this.config.maxPointsLength} 字符`
      };
    }

    const historyId = uuidv4();

    // 创建历史记录
    await this.createHistory({
      id: historyId,
      userId,
      templateId,
      type,
      style,
      points,
      result: '',
      status: 'processing',
      createdAt: Date.now()
    });

    try {
      let content: string;

      if (this.config.enableAI && this.aiConfigService) {
        // 使用 AI 生成
        content = await this.generateWithAI(type, style, points, templateId);
      } else {
        // 使用模板生成
        content = await this.generateWithTemplate(type, style, points, templateId);
      }

      // 更新历史记录
      await this.updateHistory(historyId, {
        result: content,
        status: 'success'
      });

      return {
        success: true,
        content,
        historyId
      };
    } catch (error: any) {
      console.error('公文生成错误:', error);

      // 更新历史记录为失败
      await this.updateHistory(historyId, {
        status: 'failed',
        errorMessage: error.message
      });

      return {
        success: false,
        error: error.message || '公文生成失败'
      };
    }
  }

  /**
   * 使用 AI 生成公文
   */
  private async generateWithAI(
    type: DocType,
    style: DocStyle,
    points: string,
    templateId?: string
  ): Promise<string> {
    // 构建提示词
    const typeNames: Record<DocType, string> = {
      report: '工作报告',
      notice: '通知公告',
      summary: '会议纪要',
      plan: '计划方案'
    };

    const styleDescriptions: Record<DocStyle, string> = {
      formal: '严谨正式、用词规范',
      concise: '简明扼要、重点突出',
      enthusiastic: '热情洋溢、积极向上'
    };

    let prompt = `请根据以下要求生成一份${typeNames[type]}：\n\n`;
    prompt += `文风要求：${styleDescriptions[style]}\n\n`;
    prompt += `核心要点：\n${points}\n\n`;
    prompt += `请生成完整的公文内容，包括标题、正文、落款等必要部分。`;

    // 如果有模板，加载模板内容
    if (templateId) {
      const template = await this.getTemplate(templateId);
      if (template) {
        prompt += `\n\n参考模板：\n${template.content}`;
      }
    }

    try {
      // 调用 AI 配置服务
      if (!this.aiConfigService) {
        throw new Error('AI 服务未配置');
      }

      // 这里需要根据实际的 AI 配置服务接口调用
      // 假设 aiConfigService 有一个 generate 方法
      const response = await this.aiConfigService.generate({
        prompt,
        maxTokens: 2000,
        temperature: 0.7
      });

      return response.content || response.text || '';
    } catch (error: any) {
      console.error('AI 生成失败:', error);
      // 降级到模板生成
      return await this.generateWithTemplate(type, style, points, templateId);
    }
  }

  /**
   * 使用模板生成公文
   */
  private async generateWithTemplate(
    type: DocType,
    style: DocStyle,
    points: string,
    templateId?: string
  ): Promise<string> {
    const date = new Date().toLocaleDateString('zh-CN');
    const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

    // 如果指定了模板，使用自定义模板
    if (templateId) {
      const template = await this.getTemplate(templateId);
      if (template) {
        return this.fillTemplate(template.content, { points, date, time });
      }
    }

    // 使用默认模板
    const templates: Record<DocType, string> = {
      report: this.getReportTemplate(style, points, date),
      notice: this.getNoticeTemplate(style, points, date),
      summary: this.getSummaryTemplate(style, points, date, time),
      plan: this.getPlanTemplate(style, points, date)
    };

    return templates[type];
  }

  /**
   * 工作报告模板
   */
  private getReportTemplate(style: DocStyle, points: string, date: string): string {
    const title = '工作报告';
    let content = `${title}\n\n`;
    content += `日期：${date}\n\n`;
    content += `一、核心进展\n\n${points}\n\n`;
    content += `二、存在问题及建议\n\n`;

    if (style === 'formal') {
      content += `针对上述工作进展，经分析研究，现提出以下建议：\n`;
      content += `1. 加强跨部门协作，提升工作效率\n`;
      content += `2. 完善工作流程，确保质量标准\n`;
      content += `3. 强化监督检查，及时发现问题\n\n`;
    } else if (style === 'concise') {
      content += `建议：加强协作、完善流程、强化监督。\n\n`;
    } else {
      content += `我们将以更加饱满的热情投入工作，不断创新进取，力争取得更大成绩！\n\n`;
    }

    content += `三、下一步计划\n\n`;
    content += `继续跟踪重点指标，确保各项目标按期达成。`;

    return content;
  }

  /**
   * 通知公告模板
   */
  private getNoticeTemplate(style: DocStyle, points: string, date: string): string {
    let content = `通知公告\n\n`;
    content += `各部门：\n\n`;
    content += `    关于${points}的通知要求如下：\n\n`;

    if (style === 'formal') {
      content += `    一、请各部门高度重视，认真组织落实。\n`;
      content += `    二、严格按照要求执行，确保工作质量。\n`;
      content += `    三、如有问题，请及时向上级部门反馈。\n\n`;
    } else if (style === 'concise') {
      content += `    请各部门认真落实，确保执行到位。\n\n`;
    } else {
      content += `    让我们携手并进，共同推动各项工作取得新突破！\n\n`;
    }

    content += `    特此通知。\n\n`;
    content += `管理委员会\n`;
    content += `${date}`;

    return content;
  }

  /**
   * 会议纪要模板
   */
  private getSummaryTemplate(style: DocStyle, points: string, date: string, time: string): string {
    let content = `会议纪要\n\n`;
    content += `时间：${date} ${time}\n`;
    content += `主题：关于${points}的讨论\n\n`;
    content += `主要内容：\n\n`;
    content += `${points}\n\n`;
    content += `会议共识：\n\n`;

    if (style === 'formal') {
      content += `1. 明确了工作目标和任务分工\n`;
      content += `2. 确定了时间节点和责任主体\n`;
      content += `3. 建立了跟踪反馈机制\n\n`;
    } else if (style === 'concise') {
      content += `明确目标、确定分工、建立机制。\n\n`;
    } else {
      content += `大家一致表示将全力以赴，确保各项任务圆满完成！\n\n`;
    }

    content += `记录人：[待填写]\n`;
    content += `审核人：[待填写]`;

    return content;
  }

  /**
   * 计划方案模板
   */
  private getPlanTemplate(style: DocStyle, points: string, date: string): string {
    let content = `工作计划方案\n\n`;
    content += `制定日期：${date}\n\n`;
    content += `一、工作目标\n\n${points}\n\n`;
    content += `二、实施步骤\n\n`;

    if (style === 'formal') {
      content += `（一）准备阶段\n`;
      content += `    完成前期调研和方案设计工作。\n\n`;
      content += `（二）实施阶段\n`;
      content += `    按照既定方案有序推进各项工作。\n\n`;
      content += `（三）总结阶段\n`;
      content += `    及时总结经验，完善工作机制。\n\n`;
    } else if (style === 'concise') {
      content += `1. 准备：调研设计\n`;
      content += `2. 实施：有序推进\n`;
      content += `3. 总结：完善机制\n\n`;
    } else {
      content += `我们将以饱满的热情和昂扬的斗志，全力推进各项工作，确保圆满完成任务！\n\n`;
    }

    content += `三、保障措施\n\n`;
    content += `加强组织领导，明确责任分工，确保各项措施落实到位。`;

    return content;
  }

  /**
   * 填充模板变量
   */
  private fillTemplate(template: string, variables: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, value);
    }
    return result;
  }

  /**
   * 创建模板
   */
  async createTemplate(template: Omit<OfficialDocTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<OfficialDocTemplate> {
    if (!this.config.enableTemplates) {
      throw new Error('模板功能未启用');
    }

    const id = uuidv4();
    const now = Date.now();
    const newTemplate: OfficialDocTemplate = {
      ...template,
      id,
      createdAt: now,
      updatedAt: now
    };

    const query = `
      INSERT INTO official_doc_templates 
      (id, user_id, name, type, content, style, is_system, is_public, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db.execute(query, [
      newTemplate.id,
      newTemplate.userId || null,
      newTemplate.name,
      newTemplate.type,
      newTemplate.content,
      newTemplate.style,
      newTemplate.isSystem ? 1 : 0,
      newTemplate.isPublic ? 1 : 0,
      newTemplate.description || null,
      new Date(newTemplate.createdAt),
      new Date(newTemplate.updatedAt)
    ]);

    return newTemplate;
  }

  /**
   * 更新模板
   */
  async updateTemplate(id: string, updates: Partial<OfficialDocTemplate>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.content) {
      fields.push('content = ?');
      values.push(updates.content);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (updates.isPublic !== undefined) {
      fields.push('is_public = ?');
      values.push(updates.isPublic ? 1 : 0);
    }

    fields.push('updated_at = ?');
    values.push(Date.now());

    values.push(id);

    const query = `UPDATE official_doc_templates SET ${fields.join(', ')} WHERE id = ?`;
    await this.db.execute(query, values);
  }

  /**
   * 删除模板
   */
  async deleteTemplate(id: string): Promise<void> {
    const query = 'DELETE FROM official_doc_templates WHERE id = ? AND is_system = 0';
    await this.db.execute(query, [id]);
  }

  /**
   * 获取模板
   */
  async getTemplate(id: string): Promise<OfficialDocTemplate | null> {
    const query = 'SELECT * FROM official_doc_templates WHERE id = ?';
    const [rows]: any = await this.db.execute(query, [id]);
    if (!rows || rows.length === 0) return null;
    return this.mapTemplateRow(rows[0]);
  }

  /**
   * 查询模板
   */
  async queryTemplates(params: TemplateQueryParams): Promise<TemplateQueryResult> {
    const { userId, type, isSystem, isPublic, keyword, page = 1, pageSize = 20 } = params;

    let whereClause = 'WHERE 1=1';
    const queryParams: any[] = [];

    if (userId) {
      whereClause += ' AND (user_id = ? OR is_public = 1 OR is_system = 1)';
      queryParams.push(userId);
    }
    if (type) {
      whereClause += ' AND type = ?';
      queryParams.push(type);
    }
    if (isSystem !== undefined) {
      whereClause += ' AND is_system = ?';
      queryParams.push(isSystem ? 1 : 0);
    }
    if (isPublic !== undefined) {
      whereClause += ' AND is_public = ?';
      queryParams.push(isPublic ? 1 : 0);
    }
    if (keyword) {
      whereClause += ' AND (name LIKE ? OR description LIKE ?)';
      queryParams.push(`%${keyword}%`, `%${keyword}%`);
    }

    // 获取总数
    const countQuery = `SELECT COUNT(*) as total FROM official_doc_templates ${whereClause}`;
    const [countRows]: any = await this.db.execute(countQuery, queryParams);
    const total = countRows[0].total;

    // 获取数据
    const offset = (page - 1) * pageSize;
    const dataQuery = `
      SELECT * FROM official_doc_templates 
      ${whereClause}
      ORDER BY is_system DESC, created_at DESC
      LIMIT ? OFFSET ?
    `;
    const [rows]: any = await this.db.execute(dataQuery, [...queryParams, pageSize, offset]);

    const items = rows.map((row: any) => this.mapTemplateRow(row));

    return {
      total,
      page,
      pageSize,
      items
    };
  }

  /**
   * 创建历史记录
   */
  private async createHistory(history: DocGenerationHistory): Promise<void> {
    const query = `
      INSERT INTO official_doc_history 
      (id, user_id, template_id, type, style, points, result, status, error_message, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db.execute(query, [
      history.id,
      history.userId,
      history.templateId || null,
      history.type,
      history.style,
      history.points,
      history.result,
      history.status,
      history.errorMessage || null,
      new Date(history.createdAt)
    ]);
  }

  /**
   * 更新历史记录
   */
  private async updateHistory(id: string, updates: Partial<DocGenerationHistory>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.result !== undefined) {
      fields.push('result = ?');
      values.push(updates.result);
    }
    if (updates.status) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.errorMessage !== undefined) {
      fields.push('error_message = ?');
      values.push(updates.errorMessage);
    }

    if (fields.length === 0) return;

    values.push(id);
    const query = `UPDATE official_doc_history SET ${fields.join(', ')} WHERE id = ?`;
    await this.db.execute(query, values);
  }

  /**
   * 获取历史记录
   */
  async getHistory(params: HistoryQueryParams): Promise<HistoryQueryResult> {
    const { userId, type, status, startDate, endDate, page = 1, pageSize = 20 } = params;

    let whereClause = 'WHERE user_id = ?';
    const queryParams: any[] = [userId];

    if (type) {
      whereClause += ' AND type = ?';
      queryParams.push(type);
    }
    if (status) {
      whereClause += ' AND status = ?';
      queryParams.push(status);
    }
    if (startDate) {
      whereClause += ' AND created_at >= ?';
      queryParams.push(startDate);
    }
    if (endDate) {
      whereClause += ' AND created_at <= ?';
      queryParams.push(endDate);
    }

    // 获取总数
    const countQuery = `SELECT COUNT(*) as total FROM official_doc_history ${whereClause}`;
    const [countRows]: any = await this.db.execute(countQuery, queryParams);
    const total = countRows[0].total;

    // 获取数据
    const offset = (page - 1) * pageSize;
    const dataQuery = `
      SELECT * FROM official_doc_history 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    const [rows]: any = await this.db.execute(dataQuery, [...queryParams, pageSize, offset]);

    const items = rows.map((row: any) => this.mapHistoryRow(row));

    return {
      total,
      page,
      pageSize,
      items
    };
  }

  /**
   * 删除历史记录
   */
  async deleteHistory(id: string, userId: string): Promise<void> {
    const query = 'DELETE FROM official_doc_history WHERE id = ? AND user_id = ?';
    await this.db.run(query, [id, userId]);
  }

  /**
   * 清理过期历史
   */
  async cleanupExpiredHistory(): Promise<number> {
    const expiryTime = Date.now() - (this.config.maxHistoryDays * 24 * 60 * 60 * 1000);

    const countQuery = 'SELECT COUNT(*) as total FROM official_doc_history WHERE created_at < ?';
    const [countRows]: any = await this.db.execute(countQuery, [new Date(expiryTime)]);
    const count = countRows[0].total;

    const deleteQuery = 'DELETE FROM official_doc_history WHERE created_at < ?';
    await this.db.execute(deleteQuery, [new Date(expiryTime)]);

    return count;
  }

  /**
   * 映射模板行
   */
  private mapTemplateRow(row: any): OfficialDocTemplate {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      type: row.type,
      content: row.content,
      style: row.style,
      isSystem: Boolean(row.is_system),
      isPublic: Boolean(row.is_public),
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * 映射历史行
   */
  private mapHistoryRow(row: any): DocGenerationHistory {
    return {
      id: row.id,
      userId: row.user_id,
      templateId: row.template_id,
      type: row.type,
      style: row.style,
      points: row.points,
      result: row.result,
      status: row.status,
      errorMessage: row.error_message,
      createdAt: row.created_at
    };
  }
}
