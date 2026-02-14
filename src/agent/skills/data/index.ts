/**
 * Data Skills - 数据处理技能
 * 包含数据查询、分析、清洗、关联等功能
 */

import { SkillDefinition, SkillContext, SkillResult } from '../registry';
import { advancedDataQuery } from './advanced_query';

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
      const limitTables = depth === 'quick' ? 5 : 10;

      for (const schema of schemas.slice(0, limitTables)) {
        // 1. 获取行数
        const countResult = await context.dataSource.executeQuery(
          `SELECT COUNT(*) as total FROM ${schema.tableName}`
        );
        const rowCount = countResult.data?.[0]?.total || 0;

        // 2. 获取少量样本数据 (辅助理解数据内容)
        let samples: any[] = [];
        if (depth !== 'quick') {
          try {
            const sampleResult = await context.dataSource.executeQuery(
              `SELECT * FROM ${schema.tableName} LIMIT 3`
            );
            samples = sampleResult.data || [];
          } catch (e) {
            console.warn(`Failed to get samples for ${schema.tableName}`);
          }
        }

        // 3. 提取关键字段信息 (用于辅助分析)
        const columns = schema.columns.map(c => `${c.name}(${c.type})`).join(', ');

        analysis.push({
          table: schema.tableName,
          rowCount,
          columnCount: schema.columns.length,
          columns,
          samples: samples.length > 0 ? samples : undefined
        });
      }

      return {
        success: true,
        data: {
          title: `${topic} 分析报告`,
          tables: analysis,
          // 收集所有执行的 SQL，供前端展示引用
          references: schemas.slice(0, limitTables).map((s, i) => ({
            id: i + 1,
            source: `${s.tableName} 表统计数据`,
            sql: `SELECT COUNT(*) FROM ${s.tableName}; SELECT * FROM ${s.tableName} LIMIT 3;`
          })),
          conclusion: `共分析 ${analysis.length} 个表，总计 ${analysis.reduce((s, t) => s + t.rowCount, 0)} 条数据。请作为一位资深数据分析师，基于上述表结构、字段含义和样本数据，生成一份深度的分析报告。

**报告必须包含以下章节**：

### 1. 📊 数据概览
- 简述数据集的核心业务场景（例如：电商交易、用户行为、财务报表等）。
- 评估数据的规模与体量。

### 2. 🧐 深度业务洞察 & 假设
- **字段语义推断**：基于列名和样本值，推测关键字段（如状态码、金额、时间戳）的业务含义。
- **潜在关联**：指出不同表之间可能存在的外键关联或业务逻辑联系。
- **异常/特征发现**：如果样本中存在空值、特殊格式或极端值，请予以指出并分析可能原因。

### 3. 💡 价值挖掘方向（必填）
请推荐 3-5 个高价值的分析维度，每个维度需包含：
- **分析目标**：想解决什么业务问题？
- **所需字段**：需要用到哪些核心指标？
- **预期价值**：分析结果能带来什么决策支持？

### 4. 📝 推荐 SQL 查询
基于上述分析方向，提供 3 个可直接执行的 SQL 查询示例（使用 Markdown 代码块），并简要说明查询意图。

**分析要求**：
- 语气专业、客观，避免空泛的描述。
- 必须结合提供的样本数据进行具体论证，不要只谈理论。
- 使用引用编号（如[^1]）来标注数据来源。`
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
      for (const col of schema.columns.slice(0, 1000)) {
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

// ========== 迁移的技能 ==========

// 数据统计技能
const dataStatistics: SkillDefinition = {
  name: 'data.statistics',
  category: 'data',
  displayName: '数据统计',
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

    if (!ctx.dataSource) {
      return { success: false, message: '数据源未配置' };
    }

    let sql: string;

    if (field && groupBy) {
      // 分组统计 - 只返回聚合结果
      sql = `SELECT ${groupBy}, COUNT(*) as count, SUM(${field}) as total FROM ${table} GROUP BY ${groupBy} ORDER BY count DESC LIMIT 15`;
    } else if (groupBy) {
      // 只有分组，按分组计数
      sql = `SELECT ${groupBy}, COUNT(*) as count FROM ${table} GROUP BY ${groupBy} ORDER BY count DESC LIMIT 15`;
    } else if (field) {
      // 单字段统计
      sql = `SELECT COUNT(*) as count, SUM(${field}) as total, AVG(${field}) as avg, MAX(${field}) as max, MIN(${field}) as min FROM ${table}`;
    } else {
      // 只统计总数
      sql = `SELECT COUNT(*) as total_rows FROM ${table}`;
    }

    try {
      const result = await ctx.dataSource.executeQuery(sql);

      // 构建可视化数据
      let visualization: any | undefined;
      if (result.data && groupBy && result.data.length > 1) {
        visualization = {
          type: 'bar',
          title: `${table} 按 ${groupBy} 统计`,
          xField: groupBy,
          yField: 'count',
          data: result.data.slice(0, 15)
        };
      }

      return {
        success: result.success,
        data: result.data,
        message: result.success ? '统计完成' : result.error,
        visualization
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
};

// 趋势分析技能
const trendAnalysis: SkillDefinition = {
  name: 'data.trend',
  category: 'data',
  displayName: '趋势分析',
  description: '分析数据随时间的变化趋势',
  parameters: [
    { name: 'table', type: 'string', description: '表名', required: true },
    { name: 'dateField', type: 'string', description: '日期字段', required: true },
    { name: 'valueField', type: 'string', description: '数值字段', required: true },
    { name: 'aggregation', type: 'string', description: '聚合方式: sum/count/avg', required: false },
  ],
  execute: async (params, ctx) => {
    const { table, dateField, valueField, aggregation = 'sum' } = params;

    if (!ctx.dataSource) {
      return { success: false, message: '数据源未配置' };
    }

    const aggFunc = aggregation === 'count' ? 'COUNT(*)' : `${aggregation.toUpperCase()}(${valueField})`;

    const sql = ctx.dbType === 'mysql'
      ? `SELECT DATE(${dateField}) as date, ${aggFunc} as value FROM ${table} GROUP BY DATE(${dateField}) ORDER BY date`
      : `SELECT DATE(${dateField}) as date, ${aggFunc} as value FROM ${table} GROUP BY DATE(${dateField}) ORDER BY date`;

    try {
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
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
};

// Top N 排名技能
const topRanking: SkillDefinition = {
  name: 'data.ranking',
  category: 'data',
  displayName: 'Top排名',
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

    if (!ctx.dataSource) {
      return { success: false, message: '数据源未配置' };
    }

    // 确保字段只有一个
    if (rankField && rankField.includes(',')) {
      rankField = rankField.split(',')[0].trim();
    }
    if (labelField && labelField.includes(',')) {
      labelField = labelField.split(',')[0].trim();
    }

    const sql = `SELECT ${labelField}, ${rankField} as value FROM ${table} WHERE ${rankField} IS NOT NULL ORDER BY ${rankField} ${order.toUpperCase()} LIMIT ${limit}`;

    try {
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
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
};

// 数据对比技能
const dataComparison: SkillDefinition = {
  name: 'data.comparison',
  category: 'data',
  displayName: '数据对比',
  description: '对比不同维度或时间段的数据',
  parameters: [
    { name: 'table', type: 'string', description: '表名', required: true },
    { name: 'compareField', type: 'string', description: '对比维度字段', required: true },
    { name: 'valueField', type: 'string', description: '数值字段（单个）', required: true },
  ],
  execute: async (params, context): Promise<SkillResult> => {
    let { table, compareField, valueField } = params;

    if (!context.dataSource) {
      return { success: false, message: '数据源未配置' };
    }

    // 确保字段只有一个
    if (valueField && valueField.includes(',')) {
      valueField = valueField.split(',')[0].trim();
    }
    if (compareField && compareField.includes(',')) {
      compareField = compareField.split(',')[0].trim();
    }

    // 尝试获取字段注释里的字典映射 (例如: "01:小学;02:初中")
    let valueMap: Record<string, string> | null = null;
    let fieldLabel = compareField;

    try {
      const schemas = await context.dataSource.getSchema();
      const schema = schemas.find(s => s.tableName === table);
      const col = schema?.columns.find(c => c.name === compareField);

      if (col && col.comment) {
        // 尝试提取中文名称作为标题
        const nameMatch = col.comment.match(/^([^:;(\s]+)/);
        if (nameMatch) {
          fieldLabel = nameMatch[1];
        }

        // 尝试解析映射关系
        if (col.comment.includes(':') || col.comment.includes('=')) {
          valueMap = {};
          const pairs = col.comment.split(/[;,\s]\s*/);
          for (const pair of pairs) {
            const [k, v] = pair.split(/[:=]/).map(s => s.trim());
            if (k && v) {
              valueMap[k] = v;
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to parse schema for label mapping', e);
    }

    // 如果 valueField 是 COUNT(*)，使用计数
    let sql: string;
    if (valueField === 'COUNT(*)' || !valueField) {
      sql = `SELECT ${compareField}, COUNT(*) as value FROM ${table} WHERE ${compareField} IS NOT NULL GROUP BY ${compareField} ORDER BY value DESC LIMIT 15`;
    } else {
      sql = `SELECT ${compareField}, SUM(${valueField}) as value, COUNT(*) as count FROM ${table} WHERE ${compareField} IS NOT NULL GROUP BY ${compareField} ORDER BY value DESC LIMIT 15`;
    }

    try {
      const result = await context.dataSource.executeQuery(sql);

      // 应用映射
      let chartData = result.data || [];
      if (valueMap && chartData.length > 0) {
        chartData = chartData.map((item: any) => {
          const key = item[compareField];
          const label = valueMap![key] || key; // 使用映射值或原值
          return {
            ...item,
            [compareField]: label, // 更新数据字段
            _origin_key: key
          };
        });
      }

      return {
        success: result.success,
        data: chartData,
        visualization: result.data ? {
          type: 'pie',
          title: `${fieldLabel} 分布对比`,
          xField: compareField,
          yField: 'value',
          data: chartData.slice(0, 1000)
        } : undefined
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
};

// 异常检测技能
const anomalyDetection: SkillDefinition = {
  name: 'data.anomaly',
  category: 'data',
  displayName: '异常检测',
  description: '检测数据中的异常值',
  parameters: [
    { name: 'table', type: 'string', description: '表名', required: true },
    { name: 'field', type: 'string', description: '检测字段', required: true },
    { name: 'threshold', type: 'number', description: '标准差倍数阈值', required: false },
  ],
  execute: async (params, ctx) => {
    const { table, field, threshold = 2 } = params;

    if (!ctx.dataSource) {
      return { success: false, message: '数据源未配置' };
    }

    try {
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
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
};

// 数据导出技能
const dataExport: SkillDefinition = {
  name: 'data.export',
  category: 'data',
  displayName: '数据导出',
  description: '导出查询结果为指定格式',
  parameters: [
    { name: 'sql', type: 'string', description: 'SQL查询语句', required: true },
    { name: 'format', type: 'string', description: '导出格式: json/csv', required: false },
  ],
  execute: async (params, ctx) => {
    const { sql, format = 'json' } = params;

    if (!ctx.dataSource) {
      return { success: false, message: '数据源未配置' };
    }

    if (!sql.toLowerCase().trim().startsWith('select')) {
      return { success: false, message: '只支持SELECT查询' };
    }

    try {
      const result = await ctx.dataSource.executeQuery(sql);
      if (!result.success) {
        return { success: false, message: result.error };
      }

      let exportData: string;
      if (format === 'csv' && result.data?.length) {
        const headers = Object.keys(result.data[0]).join(',');
        const rows = result.data.map((row: any) => Object.values(row).join(','));
        exportData = [headers, ...rows].join('\n');
      } else {
        exportData = JSON.stringify(result.data, null, 2);
      }

      return {
        success: true,
        data: { content: exportData, format, rowCount: result.rowCount },
        message: `已导出 ${result.rowCount} 条数据`
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
};

// 综合分析技能
const comprehensiveAnalysis: SkillDefinition = {
  name: 'data.comprehensive_analysis',
  category: 'data',
  displayName: '综合分析',
  description: '综合分析问题，建立方法论，基于多个指标进行分析',
  parameters: [
    { name: 'table', type: 'string', description: '主表名', required: true },
    { name: 'topic', type: 'string', description: '分析主题', required: true },
    { name: 'metrics', type: 'array', description: '分析指标列表', required: true },
    { name: 'labelField', type: 'string', description: '标签字段（如国家名）', required: true },
  ],
  execute: async (params, ctx) => {
    const { table, topic, metrics, labelField } = params;

    if (!ctx.dataSource) {
      return { success: false, message: '数据源未配置' };
    }

    // 确保 metrics 是数组
    let metricList: string[] = [];
    if (Array.isArray(metrics)) {
      metricList = metrics.slice(0, 5); // 最多5个指标
    } else if (typeof metrics === 'string') {
      metricList = (metrics as string).split(',').map(s => s.trim()).slice(0, 5);
    }

    if (metricList.length === 0) {
      metricList = ['Population']; // 默认指标
    }

    const results: any = {
      topic,
      methodology: `分析"${topic}"需要综合考虑以下指标：${metricList.join('、')}`,
      dimensions: []
    };

    for (const metric of metricList) {
      const sql = `SELECT ${labelField}, ${metric} as value FROM ${table} WHERE ${metric} IS NOT NULL ORDER BY ${metric} DESC LIMIT 10`;

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
};

// 多对象对比技能
const compareEntities: SkillDefinition = {
  name: 'data.compare_entities',
  category: 'data',
  displayName: '多对象对比',
  description: '对比特定对象（如中国和美国）的多个指标',
  parameters: [
    { name: 'table', type: 'string', description: '表名', required: true },
    { name: 'labelField', type: 'string', description: '标签字段', required: true },
    { name: 'entities', type: 'array', description: '要对比的对象列表', required: true },
    { name: 'metrics', type: 'array', description: '对比指标列表', required: true },
  ],
  execute: async (params, ctx) => {
    let { table, labelField, entities, metrics } = params;

    if (!ctx.dataSource) {
      return { success: false, message: '数据源未配置' };
    }

    // 处理 entities
    let entityList: string[] = [];
    if (Array.isArray(entities)) {
      entityList = entities;
    } else if (typeof entities === 'string') {
      entityList = (entities as string).split(',').map(s => s.trim());
    }

    // 处理 metrics
    let metricList: string[] = [];
    if (Array.isArray(metrics)) {
      metricList = metrics;
    } else if (typeof metrics === 'string') {
      metricList = (metrics as string).split(',').map(s => s.trim());
    }

    if (entityList.length === 0 || metricList.length === 0) {
      return { success: false, message: '请指定要对比的对象和指标' };
    }

    // 构建 SQL 查询这些对象的数据
    const entityConditions = entityList.map(e => `${labelField} = '${e}' OR Code = '${e}'`).join(' OR ');
    const selectFields = [labelField, ...metricList].join(', ');
    const sql = `SELECT ${selectFields} FROM ${table} WHERE ${entityConditions}`;

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
      return { success: false, message: e.message };
    }
  }
};

// 导出所有数据技能

export const dataSkills: SkillDefinition[] = [
  dataQuery,
  dataAnalyze,
  dataClean,
  dataSummarize,
  dataJoin,
  dataStatistics,
  trendAnalysis,
  topRanking,
  dataComparison,
  anomalyDetection,
  dataExport,
  comprehensiveAnalysis,
  compareEntities,
  advancedDataQuery
];
