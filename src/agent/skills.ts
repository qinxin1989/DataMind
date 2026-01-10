import { QueryResult, TableSchema } from '../types';
import { BaseDataSource } from '../datasource';

// 技能定义
export interface Skill {
  name: string;
  description: string;
  parameters: SkillParameter[];
  execute: (params: Record<string, any>, context: SkillContext) => Promise<SkillResult>;
}

export interface SkillParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  description: string;
  required: boolean;
}

export interface SkillContext {
  dataSource: BaseDataSource;
  schemas: TableSchema[];
  dbType: string;
}

export interface SkillResult {
  success: boolean;
  data?: any;
  message?: string;
  visualization?: VisualizationConfig;
}

export interface VisualizationConfig {
  type: 'table' | 'bar' | 'line' | 'pie' | 'scatter';
  title?: string;
  xField?: string;
  yField?: string;
  data: any[];
}

// 内置技能集合
export class SkillRegistry {
  private skills = new Map<string, Skill>();

  constructor() {
    this.registerBuiltinSkills();
  }

  private registerBuiltinSkills() {
    // 数据统计技能
    this.register({
      name: 'data_statistics',
      description: '对指定表或字段进行统计分析，包括计数、求和、平均值、最大最小值等',
      parameters: [
        { name: 'table', type: 'string', description: '表名', required: true },
        { name: 'field', type: 'string', description: '统计字段（单个字段名）', required: false },
        { name: 'groupBy', type: 'string', description: '分组字段', required: false },
      ],
      execute: async (params, ctx) => {
        let { table, field, groupBy } = params;
        
        // 确保 field 只有一个字段
        if (field && field.includes(',')) {
          field = field.split(',')[0].trim();
        }
        
        let sql: string;
        
        if (field && groupBy) {
          sql = `SELECT ${groupBy}, COUNT(*) as count, SUM(${field}) as total, AVG(${field}) as avg FROM ${table} GROUP BY ${groupBy} ORDER BY count DESC LIMIT 20`;
        } else if (field) {
          sql = `SELECT COUNT(*) as count, SUM(${field}) as total, AVG(${field}) as avg, MAX(${field}) as max, MIN(${field}) as min FROM ${table}`;
        } else {
          sql = `SELECT COUNT(*) as total_rows FROM ${table}`;
        }
        
        console.log('data_statistics SQL:', sql);
        const result = await ctx.dataSource.executeQuery(sql);
        return {
          success: result.success,
          data: result.data,
          message: result.success ? '统计完成' : result.error,
          visualization: result.data && groupBy ? {
            type: 'bar',
            title: `${table} 按 ${groupBy} 统计`,
            xField: groupBy,
            yField: 'count',
            data: result.data
          } : undefined
        };
      }
    });

    // 趋势分析技能
    this.register({
      name: 'trend_analysis',
      description: '分析数据随时间的变化趋势',
      parameters: [
        { name: 'table', type: 'string', description: '表名', required: true },
        { name: 'dateField', type: 'string', description: '日期字段', required: true },
        { name: 'valueField', type: 'string', description: '数值字段', required: true },
        { name: 'aggregation', type: 'string', description: '聚合方式: sum/count/avg', required: false },
      ],
      execute: async (params, ctx) => {
        const { table, dateField, valueField, aggregation = 'sum' } = params;
        const aggFunc = aggregation === 'count' ? 'COUNT(*)' : `${aggregation.toUpperCase()}(${valueField})`;
        
        const sql = ctx.dbType === 'mysql' 
          ? `SELECT DATE(${dateField}) as date, ${aggFunc} as value FROM ${table} GROUP BY DATE(${dateField}) ORDER BY date`
          : `SELECT DATE(${dateField}) as date, ${aggFunc} as value FROM ${table} GROUP BY DATE(${dateField}) ORDER BY date`;
        
        const result = await ctx.dataSource.executeQuery(sql);
        return {
          success: result.success,
          data: result.data,
          visualization: result.data ? {
            type: 'line',
            title: `${valueField} 趋势分析`,
            xField: 'date',
            yField: 'value',
            data: result.data
          } : undefined
        };
      }
    });

    // Top N 排名技能
    this.register({
      name: 'top_ranking',
      description: '获取某个维度的Top N排名',
      parameters: [
        { name: 'table', type: 'string', description: '表名', required: true },
        { name: 'rankField', type: 'string', description: '排名依据字段（单个数值字段）', required: true },
        { name: 'labelField', type: 'string', description: '标签字段', required: true },
        { name: 'limit', type: 'number', description: '返回数量', required: false },
        { name: 'order', type: 'string', description: '排序: desc/asc', required: false },
      ],
      execute: async (params, ctx) => {
        let { table, rankField, labelField, limit = 10, order = 'desc' } = params;
        
        // 确保字段只有一个
        if (rankField && rankField.includes(',')) {
          rankField = rankField.split(',')[0].trim();
        }
        if (labelField && labelField.includes(',')) {
          labelField = labelField.split(',')[0].trim();
        }
        
        const sql = `SELECT ${labelField}, ${rankField} as value FROM ${table} WHERE ${rankField} IS NOT NULL ORDER BY ${rankField} ${order.toUpperCase()} LIMIT ${limit}`;
        
        console.log('top_ranking SQL:', sql);
        const result = await ctx.dataSource.executeQuery(sql);
        return {
          success: result.success,
          data: result.data,
          visualization: result.data ? {
            type: 'bar',
            title: `${labelField} Top ${limit}`,
            xField: labelField,
            yField: 'value',
            data: result.data
          } : undefined
        };
      }
    });

    // 数据对比技能
    this.register({
      name: 'data_comparison',
      description: '对比不同维度或时间段的数据',
      parameters: [
        { name: 'table', type: 'string', description: '表名', required: true },
        { name: 'compareField', type: 'string', description: '对比维度字段', required: true },
        { name: 'valueField', type: 'string', description: '数值字段（单个）', required: true },
      ],
      execute: async (params, ctx) => {
        let { table, compareField, valueField } = params;
        
        // 确保字段只有一个
        if (valueField && valueField.includes(',')) {
          valueField = valueField.split(',')[0].trim();
        }
        if (compareField && compareField.includes(',')) {
          compareField = compareField.split(',')[0].trim();
        }
        
        const sql = `SELECT ${compareField}, SUM(${valueField}) as value, COUNT(*) as count FROM ${table} WHERE ${valueField} IS NOT NULL GROUP BY ${compareField} ORDER BY value DESC LIMIT 20`;
        
        console.log('data_comparison SQL:', sql);
        const result = await ctx.dataSource.executeQuery(sql);
        return {
          success: result.success,
          data: result.data,
          visualization: result.data ? {
            type: 'pie',
            title: `${compareField} 分布对比`,
            xField: compareField,
            yField: 'value',
            data: result.data
          } : undefined
        };
      }
    });

    // 异常检测技能
    this.register({
      name: 'anomaly_detection',
      description: '检测数据中的异常值',
      parameters: [
        { name: 'table', type: 'string', description: '表名', required: true },
        { name: 'field', type: 'string', description: '检测字段', required: true },
        { name: 'threshold', type: 'number', description: '标准差倍数阈值', required: false },
      ],
      execute: async (params, ctx) => {
        const { table, field, threshold = 2 } = params;
        
        // 先获取统计信息
        const statsSQL = `SELECT AVG(${field}) as avg_val, STDDEV(${field}) as std_val FROM ${table}`;
        const statsResult = await ctx.dataSource.executeQuery(statsSQL);
        
        if (!statsResult.success || !statsResult.data?.[0]) {
          return { success: false, message: '无法计算统计信息' };
        }
        
        const { avg_val, std_val } = statsResult.data[0];
        const lowerBound = avg_val - threshold * std_val;
        const upperBound = avg_val + threshold * std_val;
        
        // 查找异常值
        const anomalySQL = `SELECT * FROM ${table} WHERE ${field} < ${lowerBound} OR ${field} > ${upperBound} LIMIT 100`;
        const result = await ctx.dataSource.executeQuery(anomalySQL);
        
        return {
          success: true,
          data: {
            statistics: { avg: avg_val, std: std_val, lowerBound, upperBound },
            anomalies: result.data,
            anomalyCount: result.rowCount
          },
          message: `发现 ${result.rowCount} 条异常数据（超出 ${threshold} 倍标准差）`
        };
      }
    });

    // 数据导出技能
    this.register({
      name: 'data_export',
      description: '导出查询结果为指定格式',
      parameters: [
        { name: 'sql', type: 'string', description: 'SQL查询语句', required: true },
        { name: 'format', type: 'string', description: '导出格式: json/csv', required: false },
      ],
      execute: async (params, ctx) => {
        const { sql, format = 'json' } = params;
        
        if (!sql.toLowerCase().trim().startsWith('select')) {
          return { success: false, message: '只支持SELECT查询' };
        }
        
        const result = await ctx.dataSource.executeQuery(sql);
        if (!result.success) {
          return { success: false, message: result.error };
        }
        
        let exportData: string;
        if (format === 'csv' && result.data?.length) {
          const headers = Object.keys(result.data[0]).join(',');
          const rows = result.data.map(row => Object.values(row).join(','));
          exportData = [headers, ...rows].join('\n');
        } else {
          exportData = JSON.stringify(result.data, null, 2);
        }
        
        return {
          success: true,
          data: { content: exportData, format, rowCount: result.rowCount },
          message: `已导出 ${result.rowCount} 条数据`
        };
      }
    });

    // 综合分析技能 - 处理复杂分析问题
    this.register({
      name: 'comprehensive_analysis',
      description: '综合分析问题，建立方法论，基于多个指标进行分析',
      parameters: [
        { name: 'table', type: 'string', description: '主表名', required: true },
        { name: 'topic', type: 'string', description: '分析主题', required: true },
        { name: 'metrics', type: 'array', description: '分析指标列表', required: true },
        { name: 'labelField', type: 'string', description: '标签字段（如国家名）', required: true },
      ],
      execute: async (params, ctx) => {
        const { table, topic, metrics, labelField } = params;
        
        // 确保 metrics 是数组
        let metricList: string[] = [];
        if (Array.isArray(metrics)) {
          metricList = metrics.slice(0, 5); // 最多5个指标
        } else if (typeof metrics === 'string') {
          metricList = metrics.split(',').map(s => s.trim()).slice(0, 5);
        }
        
        if (metricList.length === 0) {
          metricList = ['Population']; // 默认指标
        }
        
        // 构建查询：获取各指标的 Top 10
        const results: any = {
          topic,
          methodology: `分析"${topic}"需要综合考虑以下指标：${metricList.join('、')}`,
          dimensions: []
        };
        
        for (const metric of metricList) {
          const sql = `SELECT ${labelField}, ${metric} as value FROM ${table} WHERE ${metric} IS NOT NULL ORDER BY ${metric} DESC LIMIT 10`;
          console.log('comprehensive_analysis SQL:', sql);
          
          try {
            const result = await ctx.dataSource.executeQuery(sql);
            if (result.success && result.data) {
              results.dimensions.push({
                metric,
                title: `${metric} 排名`,
                data: result.data
              });
            }
          } catch (e) {
            console.error('Query failed for metric:', metric, e);
          }
        }
        
        // 返回第一个维度的数据用于图表
        const firstDim = results.dimensions[0];
        
        return {
          success: true,
          data: results,
          message: `基于 ${metricList.length} 个维度完成分析`,
          visualization: firstDim ? {
            type: 'bar',
            title: firstDim.title,
            xField: labelField,
            yField: 'value',
            data: firstDim.data
          } : undefined
        };
      }
    });

    // 多对象对比技能 - 对比特定对象的多个指标
    this.register({
      name: 'compare_entities',
      description: '对比特定对象（如中国和美国）的多个指标',
      parameters: [
        { name: 'table', type: 'string', description: '表名', required: true },
        { name: 'labelField', type: 'string', description: '标签字段', required: true },
        { name: 'entities', type: 'array', description: '要对比的对象列表', required: true },
        { name: 'metrics', type: 'array', description: '对比指标列表', required: true },
      ],
      execute: async (params, ctx) => {
        let { table, labelField, entities, metrics } = params;
        
        // 处理 entities
        let entityList: string[] = [];
        if (Array.isArray(entities)) {
          entityList = entities;
        } else if (typeof entities === 'string') {
          entityList = entities.split(',').map(s => s.trim());
        }
        
        // 处理 metrics
        let metricList: string[] = [];
        if (Array.isArray(metrics)) {
          metricList = metrics;
        } else if (typeof metrics === 'string') {
          metricList = metrics.split(',').map(s => s.trim());
        }
        
        if (entityList.length === 0 || metricList.length === 0) {
          return { success: false, message: '请指定要对比的对象和指标' };
        }
        
        // 构建 SQL 查询这些对象的数据
        const entityConditions = entityList.map(e => `${labelField} = '${e}' OR Code = '${e}'`).join(' OR ');
        const selectFields = [labelField, ...metricList].join(', ');
        const sql = `SELECT ${selectFields} FROM ${table} WHERE ${entityConditions}`;
        
        console.log('compare_entities SQL:', sql);
        
        try {
          const result = await ctx.dataSource.executeQuery(sql);
          
          if (!result.success || !result.data || result.data.length === 0) {
            return { success: false, message: '未找到指定的对象数据' };
          }
          
          // 转换为图表数据格式：每个指标一组数据
          const chartData: any[] = [];
          for (const metric of metricList) {
            for (const row of result.data) {
              chartData.push({
                entity: row[labelField] || row['Name'],
                metric: metric,
                value: row[metric] || 0
              });
            }
          }
          
          return {
            success: true,
            data: result.data,
            message: `对比了 ${entityList.join('、')} 的 ${metricList.length} 个指标`,
            visualization: {
              type: 'bar',
              title: `${entityList.join(' vs ')} 对比`,
              xField: 'metric',
              yField: 'value',
              data: chartData
            }
          };
        } catch (e: any) {
          console.error('compare_entities error:', e);
          return { success: false, message: e.message };
        }
      }
    });
  }

  register(skill: Skill) {
    this.skills.set(skill.name, skill);
  }

  get(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  getAll(): Skill[] {
    return Array.from(this.skills.values());
  }

  // 获取技能描述（供AI选择）
  getSkillDescriptions(): string {
    return this.getAll().map(s => {
      const params = s.parameters.map(p => `${p.name}(${p.type}${p.required ? ',必填' : ''}): ${p.description}`).join('; ');
      return `- ${s.name}: ${s.description}\n  参数: ${params}`;
    }).join('\n');
  }
}

export const skillRegistry = new SkillRegistry();
