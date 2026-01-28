import OpenAI from 'openai';
import { TableSchema } from '../types';
import { BaseDataSource } from '../datasource';

// 图表配置
export interface ChartConfig {
  id: string;
  type: 'bar' | 'line' | 'pie' | 'area' | 'scatter' | 'gauge' | 'card' | 'table' | 'radar';
  title: string;
  description?: string;
  sql: string;
  data?: any[];
  config: {
    xField?: string;
    yField?: string;
    seriesField?: string;
    colorField?: string;
    valueField?: string;
    labelField?: string;
    // 卡片指标专用
    value?: number | string;
    prefix?: string;
    suffix?: string;
    trend?: 'up' | 'down' | 'flat';
    trendValue?: string;
  };
  style?: {
    width: number;   // 栅格宽度 1-12
    height: number;  // 高度 px
  };
}

// 大屏布局
export interface DashboardLayout {
  id: string;
  title: string;
  description: string;
  theme: 'light' | 'dark' | 'tech';
  gridCols: number;
  charts: Array<ChartConfig & {
    gridPosition: { x: number; y: number; w: number; h: number };
  }>;
  refreshInterval?: number; // 秒
}

// 大屏生成结果
export interface DashboardResult {
  dashboard: DashboardLayout;
  previewHtml: string;  // 可直接渲染的HTML
}

export class DashboardGenerator {
  private openai: OpenAI;
  private model: string;

  constructor(apiKey: string, baseURL?: string, model: string = 'gpt-4o') {
    this.openai = new OpenAI({ apiKey, baseURL });
    this.model = model;
  }

  private formatSchema(schemas: TableSchema[]): string {
    return schemas.map(table => {
      const cols = table.columns.map(c =>
        `  - ${c.name} (${c.type}${c.comment ? `, ${c.comment}` : ''})`
      ).join('\n');
      return `表: ${table.tableName}\n${cols}`;
    }).join('\n\n');
  }

  // AI 规划大屏布局和图表
  private async planDashboard(
    topic: string,
    schemas: TableSchema[],
    dbType: string
  ): Promise<{ title: string; description: string; charts: Array<Omit<ChartConfig, 'id' | 'data'> & { gridPosition: { x: number; y: number; w: number; h: number } }> }> {
    const schemaDesc = this.formatSchema(schemas);

    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `你是一个BI大屏设计专家。根据用户需求和数据结构，设计一个专业的数据大屏。

数据库类型: ${dbType}
数据库结构:
${schemaDesc}

设计要求：
1. 大屏采用12列栅格布局
2. 图表数量控制在4-8个
3. 布局要美观、有层次感
4. 顶部放核心指标卡片，中间放主图表，底部放辅助图表
5. SQL必须是有效的${dbType}语法，只能SELECT

可用图表类型：
- card: 指标卡片（单个数值展示）
- bar: 柱状图（分类对比）
- line: 折线图（趋势变化）
- pie: 饼图（占比分布）
- area: 面积图（趋势+累计）
- gauge: 仪表盘（完成率/占比）
- table: 数据表格（明细数据）
- radar: 雷达图（多维对比）

返回JSON：
{
  "title": "大屏标题",
  "description": "大屏说明",
  "charts": [
    {
      "type": "card",
      "title": "图表标题",
      "description": "图表说明",
      "sql": "SELECT COUNT(*) as value FROM ...",
      "config": {
        "valueField": "value",
        "suffix": "人",
        "trend": "up",
        "trendValue": "+12%"
      },
      "gridPosition": { "x": 0, "y": 0, "w": 3, "h": 1 }
    },
    {
      "type": "bar",
      "title": "部门人数分布",
      "sql": "SELECT department, COUNT(*) as count FROM ...",
      "config": {
        "xField": "department",
        "yField": "count"
      },
      "gridPosition": { "x": 0, "y": 1, "w": 6, "h": 2 }
    }
  ]
}

gridPosition说明：
- x: 列起始位置 (0-11)
- y: 行起始位置 (0开始)
- w: 占用列数 (1-12)
- h: 占用行数 (1=150px)`
        },
        { role: 'user', content: `请为我设计一个大屏：${topic}` }
      ],
      temperature: 0.3,
    });

    const content = response.choices[0].message.content || '{}';
    try {
      const jsonStr = content.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
      return JSON.parse(jsonStr);
    } catch {
      return { title: '数据大屏', description: topic, charts: [] };
    }
  }

  // 执行图表SQL并填充数据
  private async executeChartQueries(
    charts: Array<Omit<ChartConfig, 'id' | 'data'> & { gridPosition: any }>,
    dataSource: BaseDataSource
  ): Promise<Array<ChartConfig & { gridPosition: any }>> {
    const results: Array<ChartConfig & { gridPosition: any }> = [];

    for (let i = 0; i < charts.length; i++) {
      const chart = charts[i];
      const id = `chart_${i + 1}`;

      try {
        const result = await dataSource.executeQuery(chart.sql);

        if (result.success && result.data) {
          // 对于卡片类型，提取单个值
          if (chart.type === 'card' && result.data[0]) {
            const valueField = chart.config.valueField || 'value';
            chart.config.value = result.data[0][valueField];
          }

          results.push({
            ...chart,
            id,
            data: result.data
          });
        } else {
          results.push({
            ...chart,
            id,
            data: [],
            description: `查询失败: ${result.error}`
          });
        }
      } catch (error: any) {
        results.push({
          ...chart,
          id,
          data: [],
          description: `执行出错: ${error.message}`
        });
      }
    }

    return results;
  }

  // 生成大屏预览HTML
  private generatePreviewHtml(dashboard: DashboardLayout): string {
    const chartHtmls = dashboard.charts.map(chart => {
      const { gridPosition, type, title, data, config } = chart;
      const style = `grid-column: ${gridPosition.x + 1} / span ${gridPosition.w}; grid-row: ${gridPosition.y + 1} / span ${gridPosition.h};`;

      let content = '';

      if (type === 'card') {
        const value = config.value ?? '-';
        const trend = config.trend === 'up' ? '↑' : config.trend === 'down' ? '↓' : '';
        const trendClass = config.trend === 'up' ? 'trend-up' : config.trend === 'down' ? 'trend-down' : '';
        content = `
          <div class="card-value">${config.prefix || ''}${value}${config.suffix || ''}</div>
          <div class="card-trend ${trendClass}">${trend} ${config.trendValue || ''}</div>
        `;
      } else {
        // 其他图表用 ECharts 占位
        content = `<div class="chart-container" id="${chart.id}"></div>`;
      }

      return `
        <div class="dashboard-item ${type}" style="${style}">
          <div class="item-title">${title}</div>
          <div class="item-content">${content}</div>
        </div>
      `;
    }).join('\n');

    // 生成 ECharts 初始化代码
    const chartScripts = dashboard.charts
      .filter(c => c.type !== 'card')
      .map(chart => this.generateEChartsOption(chart))
      .join('\n');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${dashboard.title}</title>
  <script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: ${dashboard.theme === 'dark' ? '#0d1b2a' : dashboard.theme === 'tech' ? '#001529' : '#f0f2f5'};
      color: ${dashboard.theme === 'light' ? '#333' : '#fff'};
      min-height: 100vh;
      padding: 20px;
    }
    .dashboard-header {
      text-align: center;
      padding: 20px 0 30px;
    }
    .dashboard-header h1 {
      font-size: 28px;
      background: linear-gradient(90deg, #00d4ff, #7b2ff7);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 8px;
    }
    .dashboard-header p {
      opacity: 0.7;
      font-size: 14px;
    }
    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(12, 1fr);
      grid-auto-rows: 150px;
      gap: 16px;
      max-width: 1600px;
      margin: 0 auto;
    }
    .dashboard-item {
      background: ${dashboard.theme === 'light' ? '#fff' : 'rgba(255,255,255,0.05)'};
      border-radius: 12px;
      padding: 16px;
      border: 1px solid ${dashboard.theme === 'light' ? '#e8e8e8' : 'rgba(255,255,255,0.1)'};
      display: flex;
      flex-direction: column;
    }
    .item-title {
      font-size: 14px;
      font-weight: 500;
      opacity: 0.8;
      margin-bottom: 12px;
    }
    .item-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .card .card-value {
      font-size: 36px;
      font-weight: 700;
      background: linear-gradient(90deg, #00d4ff, #7b2ff7);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .card .card-trend {
      font-size: 14px;
      margin-top: 8px;
      opacity: 0.7;
    }
    .trend-up { color: #52c41a; }
    .trend-down { color: #ff4d4f; }
    .chart-container {
      width: 100%;
      height: 100%;
      min-height: 120px;
    }
  </style>
</head>
<body>
  <div class="dashboard-header">
    <h1>${dashboard.title}</h1>
    <p>${dashboard.description}</p>
  </div>
  <div class="dashboard-grid">
    ${chartHtmls}
  </div>
  <script>
    const isDark = ${dashboard.theme !== 'light'};
    ${chartScripts}
  </script>
</body>
</html>`;
  }

  // 生成 ECharts 配置
  private generateEChartsOption(chart: ChartConfig & { gridPosition: any }): string {
    const { id, type, data, config } = chart;

    if (!data || data.length === 0) {
      return `// ${id}: 无数据`;
    }

    let option = '';

    switch (type) {
      case 'bar':
        option = `{
          tooltip: { trigger: 'axis' },
          xAxis: { type: 'category', data: ${JSON.stringify(data.map(d => d[config.xField!]))}, axisLabel: { color: isDark ? '#fff' : '#333' } },
          yAxis: { type: 'value', axisLabel: { color: isDark ? '#fff' : '#333' } },
          series: [{ type: 'bar', data: ${JSON.stringify(data.map(d => d[config.yField!]))}, itemStyle: { color: '#00d4ff' } }]
        }`;
        break;
      case 'line':
      case 'area':
        option = `{
          tooltip: { trigger: 'axis' },
          xAxis: { type: 'category', data: ${JSON.stringify(data.map(d => d[config.xField!]))}, axisLabel: { color: isDark ? '#fff' : '#333' } },
          yAxis: { type: 'value', axisLabel: { color: isDark ? '#fff' : '#333' } },
          series: [{ type: 'line', data: ${JSON.stringify(data.map(d => d[config.yField!]))}, ${type === 'area' ? 'areaStyle: {},' : ''} smooth: true, itemStyle: { color: '#7b2ff7' } }]
        }`;
        break;
      case 'pie':
        option = `{
          tooltip: { trigger: 'item' },
          series: [{
            type: 'pie',
            radius: ['40%', '70%'],
            data: ${JSON.stringify(data.map(d => ({ name: d[config.labelField || config.xField!], value: d[config.valueField || config.yField!] })))},
            label: { color: isDark ? '#fff' : '#333' }
          }]
        }`;
        break;
      case 'gauge':
        const gaugeValue = data[0]?.[config.valueField!] || 0;
        option = `{
          series: [{
            type: 'gauge',
            progress: { show: true },
            detail: { formatter: '{value}%', color: isDark ? '#fff' : '#333' },
            data: [{ value: ${gaugeValue} }]
          }]
        }`;
        break;
      case 'table':
        // 表格用简单HTML渲染
        return `
          (function() {
            var container = document.getElementById('${id}');
            var data = ${JSON.stringify(data.slice(0, 1000))};
            if (!data.length) return;
            var keys = Object.keys(data[0]);
            var html = '<table style="width:100%;font-size:12px;border-collapse:collapse;">';
            html += '<tr>' + keys.map(k => '<th style="padding:8px;border-bottom:1px solid rgba(255,255,255,0.1);text-align:left;">' + k + '</th>').join('') + '</tr>';
            data.forEach(row => {
              html += '<tr>' + keys.map(k => '<td style="padding:6px;border-bottom:1px solid rgba(255,255,255,0.05);">' + (row[k] ?? '') + '</td>').join('') + '</tr>';
            });
            html += '</table>';
            container.innerHTML = html;
          })();
        `;
      default:
        return `// ${id}: 不支持的图表类型 ${type}`;
    }

    return `
      (function() {
        var chart = echarts.init(document.getElementById('${id}'), isDark ? 'dark' : null);
        chart.setOption(${option});
        window.addEventListener('resize', () => chart.resize());
      })();
    `;
  }

  // 主入口：生成大屏
  async generate(
    topic: string,
    dataSource: BaseDataSource,
    dbType: string,
    theme: 'light' | 'dark' | 'tech' = 'dark'
  ): Promise<DashboardResult> {
    const schemas = await dataSource.getSchema();

    // 1. AI 规划大屏
    const plan = await this.planDashboard(topic, schemas, dbType);

    // 2. 执行查询填充数据
    const chartsWithData = await this.executeChartQueries(plan.charts, dataSource);

    // 3. 构建大屏配置
    const dashboard: DashboardLayout = {
      id: `dashboard_${Date.now()}`,
      title: plan.title,
      description: plan.description,
      theme,
      gridCols: 12,
      charts: chartsWithData,
      refreshInterval: 60
    };

    // 4. 生成预览HTML
    const previewHtml = this.generatePreviewHtml(dashboard);

    return { dashboard, previewHtml };
  }
}
