/**
 * Data Skills - 数据处理技能
 * 包含数据查询、分析、清洗、关联等功能
 */

import { SkillDefinition, SkillContext, SkillResult } from '../registry';

// 数据查询技能
const dataQuery: SkillDefinition = {
  name: 'data.query',
  category: 'data',
  displayName: '数据查询',
  description: '根据自然语言问题查询数据源',
  parameters: [
    { name: 'datasourceId', type: 'string', description: '数据源ID', required: true },
    { name: 'question', type: 'string', description: '自然语言问题', required: true },
    { name: 'limit', type: 'number', description: '返回行数限制', required: false, default: 20 }
  ],
  execute: async (params, context): Promise<SkillResult> => {
    const { datasourceId, question, limit = 20 } = params;
    
    if (!context.dataSource) {
      return { success: false, message: '数据源未配置' };
    }

    try {
      // 这里需要调用 AI 生成 SQL
      // 简化实现：直接返回表结构信息
      const schemas = await context.dataSource.getSchema();
      
      return {
        success: true,
        data: schemas,
        message: `数据源包含 ${schemas.length} 个表`
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
};

// 数据分析技能
const dataAnalyze: SkillDefinition = {
  name: 'data.analyze',
  category: 'data',
  displayName: '数据分析',
  description: '对数据源进行综合分析，生成分析报告',
  parameters: [
    { name: 'datasourceId', type: 'string', description: '数据源ID', required: true },
    { name: 'topic', type: 'string', description: '分析主题', required: true },
    { name: 'depth', type: 'string', description: '分析深度 (quick/normal/deep)', required: false, default: 'normal' }
  ],
  execute: async (params, context): Promise<SkillResult> => {
    const { datasourceId, topic, depth = 'normal' } = params;
    
    if (!context.dataSource) {
      return { success: false, message: '数据源未配置' };
    }

    try {
      const schemas = await context.dataSource.getSchema();
      
      // 分析各表的基本统计
      const analysis: any[] = [];
      
      for (const schema of schemas.slice(0, 5)) {
        const countResult = await context.dataSource.executeQuery(
          `SELECT COUNT(*) as total FROM ${schema.tableName}`
        );
        
        analysis.push({
          table: schema.tableName,
          rowCount: countResult.data?.[0]?.total || 0,
          columnCount: schema.columns.length
        });
      }
      
      return {
        success: true,
        data: {
          title: `${topic} 分析报告`,
          tables: analysis,
          conclusion: `共分析 ${analysis.length} 个表，总计 ${analysis.reduce((s, t) => s + t.rowCount, 0)} 条数据`
        },
        message: '分析完成'
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
};

// 数据摘要技能
const dataSummarize: SkillDefinition = {
  name: 'data.summarize',
  category: 'data',
  displayName: '数据摘要',
  description: '生成数据源的概要信息',
  parameters: [
    { name: 'datasourceId', type: 'string', description: '数据源ID', required: true },
    { name: 'tables', type: 'array', description: '指定表名，默认全部', required: false }
  ],
  execute: async (params, context): Promise<SkillResult> => {
    if (!context.dataSource) {
      return { success: false, message: '数据源未配置' };
    }

    try {
      const schemas = await context.dataSource.getSchema();
      const targetTables = params.tables || schemas.map(s => s.tableName);
      
      const summary: any[] = [];
      let totalRows = 0;
      
      for (const schema of schemas) {
        if (!targetTables.includes(schema.tableName)) continue;
        
        const countResult = await context.dataSource.executeQuery(
          `SELECT COUNT(*) as total FROM ${schema.tableName}`
        );
        const rowCount = countResult.data?.[0]?.total || 0;
        totalRows += rowCount;
        
        summary.push({
          name: schema.tableName,
          rowCount,
          columns: schema.columns.length
        });
      }
      
      return {
        success: true,
        data: {
          tables: summary,
          totalRows,
          summary: `数据源包含 ${summary.length} 个表，共 ${totalRows} 条记录`
        }
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
};

// 关联查询技能
const dataJoin: SkillDefinition = {
  name: 'data.join',
  category: 'data',
  displayName: '关联查询',
  description: '跨多个表进行关联查询',
  parameters: [
    { name: 'datasourceId', type: 'string', description: '数据源ID', required: true },
    { name: 'tables', type: 'array', description: '要关联的表名', required: true },
    { name: 'joinFields', type: 'object', description: '关联字段映射', required: true },
    { name: 'selectFields', type: 'array', description: '选择的字段', required: false }
  ],
  execute: async (params, context): Promise<SkillResult> => {
    const { tables, joinFields, selectFields } = params;
    
    if (!context.dataSource) {
      return { success: false, message: '数据源未配置' };
    }

    if (!tables || tables.length < 2) {
      return { success: false, message: '至少需要两个表进行关联' };
    }

    try {
      // 构建 JOIN SQL
      const mainTable = tables[0];
      const select = selectFields?.join(', ') || '*';
      
      let sql = `SELECT ${select} FROM ${mainTable}`;
      
      for (let i = 1; i < tables.length; i++) {
        const joinTable = tables[i];
        const joinField = joinFields[joinTable] || joinFields[`${mainTable}_${joinTable}`];
        
        if (joinField) {
          sql += ` JOIN ${joinTable} ON ${mainTable}.${joinField} = ${joinTable}.${joinField}`;
        }
      }
      
      sql += ' LIMIT 100';
      
      const result = await context.dataSource.executeQuery(sql);
      
      return {
        success: result.success,
        data: result.data,
        message: result.success ? `关联查询返回 ${result.rowCount} 条数据` : result.error
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
};

// 数据清洗技能
const dataClean: SkillDefinition = {
  name: 'data.clean',
  category: 'data',
  displayName: '数据清洗',
  description: '检测并清洗数据质量问题',
  parameters: [
    { name: 'datasourceId', type: 'string', description: '数据源ID', required: true },
    { name: 'table', type: 'string', description: '表名', required: true },
    { name: 'rules', type: 'array', description: '清洗规则', required: false }
  ],
  execute: async (params, context): Promise<SkillResult> => {
    const { table } = params;
    
    if (!context.dataSource) {
      return { success: false, message: '数据源未配置' };
    }

    try {
      const schemas = await context.dataSource.getSchema();
      const schema = schemas.find(s => s.tableName === table);
      
      if (!schema) {
        return { success: false, message: `表 ${table} 不存在` };
      }

      const issues: any[] = [];
      
      // 检测空值
      for (const col of schema.columns.slice(0, 10)) {
        const nullResult = await context.dataSource.executeQuery(
          `SELECT COUNT(*) as cnt FROM ${table} WHERE ${col.name} IS NULL`
        );
        const nullCount = nullResult.data?.[0]?.cnt || 0;
        
        if (nullCount > 0) {
          issues.push({
            type: 'null_value',
            field: col.name,
            count: nullCount
          });
        }
      }
      
      // 检测重复
      const dupResult = await context.dataSource.executeQuery(
        `SELECT COUNT(*) - COUNT(DISTINCT *) as dup_count FROM ${table}`
      );
      const dupCount = dupResult.data?.[0]?.dup_count || 0;
      
      if (dupCount > 0) {
        issues.push({
          type: 'duplicate',
          count: dupCount
        });
      }
      
      return {
        success: true,
        data: {
          issues,
          suggestions: issues.length > 0 
            ? ['建议处理空值', '建议去除重复数据']
            : ['数据质量良好']
        },
        message: `发现 ${issues.length} 个数据质量问题`
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
};

// 导出所有数据技能
export const dataSkills: SkillDefinition[] = [
  dataQuery,
  dataAnalyze,
  dataSummarize,
  dataJoin,
  dataClean
];
