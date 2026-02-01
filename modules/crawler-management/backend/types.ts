/**
 * 爬虫管理模块类型定义
 */

/**
 * 爬虫模板
 */
export interface CrawlerTemplate {
  id: string;
  userId: string;
  name: string;
  url: string;
  containerSelector?: string;
  fields: CrawlerTemplateField[];
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * 模板字段
 */
export interface CrawlerTemplateField {
  name: string;
  selector: string;
}

/**
 * 爬虫任务
 */
export interface CrawlerTask {
  id: string;
  userId: string;
  templateId: string;
  templateName?: string;
  name: string;
  frequency: 'minutely' | 'hourly' | 'daily';
  status: 'active' | 'paused';
  nextRunAt?: Date;
  lastRunAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * 采集结果批次
 */
export interface CrawlerResult {
  id: string;
  userId: string;
  templateId: string;
  templateName?: string;
  createdAt?: Date;
}

/**
 * 采集结果行
 */
export interface CrawlerResultRow {
  id: string;
  resultId: string;
  data: Record<string, any>;
  createdAt?: Date;
}

/**
 * 保存模板请求
 */
export interface SaveTemplateRequest {
  name: string;
  description?: string;
  url: string;
  selectors: {
    container?: string;
    fields: Record<string, string>;
  };
}

/**
 * 执行技能请求
 */
export interface ExecuteSkillRequest {
  skill: string;
  params: {
    url: string;
    description?: string;
    templateId?: string;
  };
}
