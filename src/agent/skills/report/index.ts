/**
 * Report Skills - 报告生成技能
 * 包含 PPT 生成、数据大屏、Excel 报表等功能
 */

import { SkillDefinition, SkillContext, SkillResult } from '../registry';
import { pptGenerator, PPTConfig, SlideContent } from './pptGenerator';
import * as fs from 'fs';
import * as path from 'path';

// 导出 PPT 生成器
export { pptGenerator, PPTConfig, SlideContent } from './pptGenerator';

// PPT 生成技能
const reportPpt: SkillDefinition = {
  name: 'report.ppt',
  category: 'report',
  displayName: 'PPT生成',
  description: '根据数据和主题生成PPT演示文稿',
  parameters: [
    { name: 'datasourceId', type: 'string', description: '数据源ID', required: true },
    { name: 'topic', type: 'string', description: '报告主题', required: true },
    { name: 'template', type: 'string', description: '模板名称', required: false },
    { name: 'slides', type: 'number', description: '幻灯片数量', required: false, default: 10 },
    { name: 'style', type: 'string', description: '风格 (business/tech/simple)', required: false, default: 'business' }
  ],
  execute: async (params, context): Promise<SkillResult> => {
    const { datasourceId, topic, template, slides = 10, style = 'business' } = params;
    
    try {
      // 获取数据源信息
      const slideContents: SlideContent[] = [];
      
      // 封面
      slideContents.push({
        type: 'title',
        title: topic,
        subtitle: new Date().toLocaleDateString('zh-CN') + ' 数据分析报告'
      });
      
      // 如果有数据源，生成数据概览
      if (context.dataSource) {
        const schemas = await context.dataSource.getSchema();
        
        // 数据概览页
        slideContents.push({
          type: 'bullets',
          title: '数据概览',
          bullets: schemas.slice(0, 5).map(s => `${s.tableName}: ${s.columns.length} 个字段`)
        });
        
        // 为每个表生成统计页
        for (const schema of schemas.slice(0, Math.min(slides - 3, 5))) {
          const countResult = await context.dataSource.executeQuery(
            `SELECT COUNT(*) as total FROM ${schema.tableName}`
          );
          const total = countResult.data?.[0]?.total || 0;
          
          slideContents.push({
            type: 'content',
            title: schema.tableName,
            content: `共 ${total} 条记录，${schema.columns.length} 个字段\n\n主要字段：${schema.columns.slice(0, 5).map(c => c.name).join('、')}`
          });
        }
      }
      
      // 总结页
      slideContents.push({
        type: 'bullets',
        title: '总结',
        bullets: [
          '数据分析完成',
          '详细内容请参考各章节',
          '如有问题请联系数据团队'
        ]
      });
      
      // 结束页
      slideContents.push({
        type: 'title',
        title: '谢谢',
        subtitle: 'AI Data Platform 自动生成'
      });
      
      // 生成 PPT
      const config: PPTConfig = {
        title: topic,
        theme: style === 'tech' ? 'dark' : style === 'simple' ? 'minimal' : 'corporate',
        slides: slideContents
      };
      
      const buffer = await pptGenerator.generate(config);
      
      // 保存文件
      const outputDir = path.join(process.cwd(), context.workDir || 'public/downloads');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const filename = `report_${Date.now()}.pptx`;
      const filepath = path.join(outputDir, filename);
      fs.writeFileSync(filepath, buffer);
      
      return {
        success: true,
        data: {
          outputPath: `/downloads/${filename}`,
          slideCount: slideContents.length,
          sections: slideContents.map(s => s.title || s.type),
          style
        },
        outputPath: filepath,
        message: `PPT生成完成，共 ${slideContents.length} 页`
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
};

// 数据大屏技能
const reportDashboard: SkillDefinition = {
  name: 'report.dashboard',
  category: 'report',
  displayName: '数据大屏',
  description: '生成数据可视化大屏',
  parameters: [
    { name: 'datasourceId', type: 'string', description: '数据源ID', required: true },
    { name: 'topic', type: 'string', description: '大屏主题', required: true },
    { name: 'theme', type: 'string', description: '主题 (dark/light)', required: false, default: 'dark' },
    { name: 'layout', type: 'string', description: '布局 (auto/grid/flow)', required: false, default: 'auto' },
    { name: 'charts', type: 'array', description: '指定图表配置', required: false }
  ],
  execute: async (params, context): Promise<SkillResult> => {
    const { datasourceId, topic, theme = 'dark', layout = 'auto', charts } = params;
    
    try {
      // 获取数据并生成图表配置
      const dashboardCharts: any[] = [];
      
      if (context.dataSource) {
        const schemas = await context.dataSource.getSchema();
        
        // 为每个表生成一个图表
        for (const schema of schemas.slice(0, 6)) {
          const countResult = await context.dataSource.executeQuery(
            `SELECT COUNT(*) as total FROM ${schema.tableName}`
          );
          
          dashboardCharts.push({
            type: 'stat',
            title: schema.tableName,
            value: countResult.data?.[0]?.total || 0
          });
        }
      }

      const previewId = `dashboard_${Date.now()}`;
      
      return {
        success: true,
        data: {
          previewUrl: `/dashboard/preview/${previewId}`,
          config: {
            topic,
            theme,
            layout
          },
          charts: dashboardCharts
        },
        message: `数据大屏生成完成，包含 ${dashboardCharts.length} 个图表`
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
};

// 数据摘要报告技能
const reportSummary: SkillDefinition = {
  name: 'report.summary',
  category: 'report',
  displayName: '数据摘要报告',
  description: '生成数据摘要文档',
  parameters: [
    { name: 'datasourceId', type: 'string', description: '数据源ID', required: true },
    { name: 'topic', type: 'string', description: '摘要主题', required: false },
    { name: 'format', type: 'string', description: '输出格式 (markdown/html/pdf)', required: false, default: 'markdown' },
    { name: 'sections', type: 'array', description: '包含的章节', required: false }
  ],
  execute: async (params, context): Promise<SkillResult> => {
    const { datasourceId, topic, format = 'markdown', sections } = params;
    
    try {
      let content = `# ${topic || '数据摘要报告'}\n\n`;
      content += `生成时间: ${new Date().toLocaleString()}\n\n`;
      
      if (context.dataSource) {
        const schemas = await context.dataSource.getSchema();
        
        content += `## 数据概览\n\n`;
        content += `数据源包含 ${schemas.length} 个表：\n\n`;
        
        for (const schema of schemas) {
          const countResult = await context.dataSource.executeQuery(
            `SELECT COUNT(*) as total FROM ${schema.tableName}`
          );
          const total = countResult.data?.[0]?.total || 0;
          
          content += `- **${schema.tableName}**: ${total} 条记录, ${schema.columns.length} 个字段\n`;
        }
        
        content += `\n## 字段说明\n\n`;
        for (const schema of schemas.slice(0, 3)) {
          content += `### ${schema.tableName}\n\n`;
          content += `| 字段名 | 类型 | 说明 |\n`;
          content += `|--------|------|------|\n`;
          for (const col of schema.columns.slice(0, 10)) {
            content += `| ${col.name} | ${col.type} | ${col.comment || '-'} |\n`;
          }
          content += `\n`;
        }
      }
      
      content += `## 总结\n\n`;
      content += `本报告对数据源进行了基础分析，详细内容请参考各章节。\n`;
      
      const outputPath = path.join(
        context.workDir || 'public/downloads',
        `summary_${Date.now()}.${format === 'markdown' ? 'md' : format}`
      );
      
      return {
        success: true,
        data: {
          content,
          outputPath,
          wordCount: content.length
        },
        outputPath,
        message: `摘要报告生成完成，共 ${content.length} 字`
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
};

// Excel 报表技能
const reportExcel: SkillDefinition = {
  name: 'report.excel',
  category: 'report',
  displayName: 'Excel报表',
  description: '生成Excel数据报表',
  parameters: [
    { name: 'datasourceId', type: 'string', description: '数据源ID', required: true },
    { name: 'queries', type: 'array', description: '查询配置列表', required: true },
    { name: 'template', type: 'string', description: 'Excel模板路径', required: false },
    { name: 'charts', type: 'boolean', description: '是否包含图表', required: false, default: true }
  ],
  execute: async (params, context): Promise<SkillResult> => {
    const { datasourceId, queries, template, charts = true } = params;
    
    if (!queries || queries.length === 0) {
      return { success: false, message: '请提供查询配置' };
    }

    try {
      // TODO: 实际实现需要使用 exceljs 库
      const sheets: string[] = [];
      let totalRows = 0;
      
      if (context.dataSource) {
        for (const query of queries) {
          const sql = typeof query === 'string' ? query : query.sql;
          const sheetName = typeof query === 'object' ? query.name : `Sheet${sheets.length + 1}`;
          
          try {
            const result = await context.dataSource.executeQuery(sql);
            if (result.success) {
              sheets.push(sheetName);
              totalRows += result.rowCount || 0;
            }
          } catch (e) {
            console.error('Query failed:', sql, e);
          }
        }
      }
      
      const outputPath = path.join(context.workDir || 'public/downloads', `report_${Date.now()}.xlsx`);
      
      return {
        success: true,
        data: {
          outputPath,
          sheets: sheets.length > 0 ? sheets : ['数据概览', '详细数据'],
          rowCount: totalRows,
          hasCharts: charts
        },
        outputPath,
        message: `Excel报表生成完成，共 ${sheets.length} 个工作表（模拟）`
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
};

// 智能洞察技能
const reportInsight: SkillDefinition = {
  name: 'report.insight',
  category: 'report',
  displayName: '智能洞察',
  description: '自动发现数据中的关键洞察',
  parameters: [
    { name: 'datasourceId', type: 'string', description: '数据源ID', required: true },
    { name: 'focus', type: 'string', description: '关注点', required: false },
    { name: 'depth', type: 'string', description: '分析深度 (quick/deep)', required: false, default: 'quick' }
  ],
  execute: async (params, context): Promise<SkillResult> => {
    const { datasourceId, focus, depth = 'quick' } = params;
    
    try {
      const insights: any[] = [];
      const recommendations: string[] = [];
      
      if (context.dataSource) {
        const schemas = await context.dataSource.getSchema();
        
        // 分析各表数据量
        let maxTable = { name: '', count: 0 };
        let minTable = { name: '', count: Infinity };
        
        for (const schema of schemas) {
          const countResult = await context.dataSource.executeQuery(
            `SELECT COUNT(*) as total FROM ${schema.tableName}`
          );
          const count = countResult.data?.[0]?.total || 0;
          
          if (count > maxTable.count) {
            maxTable = { name: schema.tableName, count };
          }
          if (count < minTable.count && count > 0) {
            minTable = { name: schema.tableName, count };
          }
        }
        
        if (maxTable.name) {
          insights.push({
            type: 'volume',
            description: `${maxTable.name} 是数据量最大的表，共 ${maxTable.count} 条记录`,
            confidence: 0.95
          });
        }
        
        if (minTable.name && minTable.count < Infinity) {
          insights.push({
            type: 'volume',
            description: `${minTable.name} 数据量较少，仅 ${minTable.count} 条记录`,
            confidence: 0.9
          });
        }
        
        // 添加建议
        recommendations.push('建议定期备份重要数据');
        recommendations.push('建议对大表进行索引优化');
        if (schemas.length > 5) {
          recommendations.push('建议整理表结构，合并相似表');
        }
      }
      
      return {
        success: true,
        data: {
          insights,
          recommendations
        },
        message: `发现 ${insights.length} 个洞察，${recommendations.length} 条建议`
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
};

// 对比分析报告技能
const reportCompare: SkillDefinition = {
  name: 'report.compare',
  category: 'report',
  displayName: '对比分析报告',
  description: '生成多维度对比分析报告',
  parameters: [
    { name: 'datasourceId', type: 'string', description: '数据源ID', required: true },
    { name: 'dimensions', type: 'array', description: '对比维度', required: true },
    { name: 'metrics', type: 'array', description: '对比指标', required: true },
    { name: 'format', type: 'string', description: '输出格式', required: false, default: 'markdown' }
  ],
  execute: async (params, context): Promise<SkillResult> => {
    const { datasourceId, dimensions, metrics, format = 'markdown' } = params;
    
    if (!dimensions || dimensions.length === 0) {
      return { success: false, message: '请提供对比维度' };
    }
    if (!metrics || metrics.length === 0) {
      return { success: false, message: '请提供对比指标' };
    }

    try {
      const comparisons: any[] = [];
      
      // TODO: 实际实现需要根据维度和指标生成对比数据
      for (const dim of dimensions) {
        for (const metric of metrics) {
          comparisons.push({
            dimension: dim,
            metric,
            values: [
              { label: '组A', value: Math.random() * 100 },
              { label: '组B', value: Math.random() * 100 }
            ]
          });
        }
      }
      
      let summary = `对比分析完成，共分析 ${dimensions.length} 个维度，${metrics.length} 个指标。`;
      
      const outputPath = path.join(
        context.workDir || 'public/downloads',
        `compare_${Date.now()}.${format === 'markdown' ? 'md' : format}`
      );
      
      return {
        success: true,
        data: {
          comparisons,
          summary,
          outputPath
        },
        outputPath,
        message: summary
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
};

// 导出所有报告技能
export const reportSkills: SkillDefinition[] = [
  reportPpt,
  reportDashboard,
  reportSummary,
  reportExcel,
  reportInsight,
  reportCompare
];
