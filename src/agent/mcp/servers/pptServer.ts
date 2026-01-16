/**
 * PPT Generator MCP Server - PPT 演示文稿生成工具
 */

import { MCPServer } from '../registry';
import { pptGenerator, PPTConfig, SlideContent } from '../../skills/report/pptGenerator';
import * as fs from 'fs';
import * as path from 'path';

// 文本自动转幻灯片
function textToSlides(title: string, content: string): SlideContent[] {
  const slides: SlideContent[] = [];
  
  // 封面
  slides.push({
    type: 'title',
    title: title,
    subtitle: new Date().toLocaleDateString('zh-CN')
  });
  
  // 解析内容
  const sections = content.split(/(?=#{1,3}\s)|(?=\n\n)/g).filter(s => s.trim());
  
  let currentBullets: string[] = [];
  let currentTitle = '内容';
  
  for (const section of sections) {
    const trimmed = section.trim();
    
    // 检测标题
    const titleMatch = trimmed.match(/^#{1,3}\s*(.+)/);
    if (titleMatch) {
      if (currentBullets.length > 0) {
        slides.push({
          type: 'bullets',
          title: currentTitle,
          bullets: currentBullets
        });
        currentBullets = [];
      }
      currentTitle = titleMatch[1].replace(/[#*]/g, '').trim();
      continue;
    }
    
    // 检测列表项
    const listItems = trimmed.match(/(?:^|\n)[-•●\d.]\s*([^\n]+)/g);
    if (listItems) {
      listItems.forEach(item => {
        const text = item.replace(/^[\n\-•●\d.\s]+/, '').trim();
        if (text) currentBullets.push(text);
      });
      
      if (currentBullets.length >= 5) {
        slides.push({
          type: 'bullets',
          title: currentTitle,
          bullets: currentBullets.slice(0, 5)
        });
        currentBullets = currentBullets.slice(5);
      }
      continue;
    }
    
    // 普通段落
    if (trimmed.length > 20) {
      if (currentBullets.length > 0) {
        slides.push({
          type: 'bullets',
          title: currentTitle,
          bullets: currentBullets
        });
        currentBullets = [];
      }
      
      slides.push({
        type: 'content',
        title: currentTitle,
        content: trimmed.slice(0, 500)
      });
    } else if (trimmed.length > 5) {
      currentBullets.push(trimmed);
    }
  }
  
  // 保存剩余要点
  if (currentBullets.length > 0) {
    slides.push({
      type: 'bullets',
      title: currentTitle,
      bullets: currentBullets
    });
  }
  
  // 结束页
  slides.push({
    type: 'title',
    title: '谢谢',
    subtitle: ''
  });
  
  return slides;
}

export const pptServer: MCPServer = {
  name: 'ppt_generator',
  description: 'PPT演示文稿生成工具',
  tools: [
    {
      name: 'create_ppt',
      description: '根据内容生成PPT文件，返回文件路径',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'PPT标题' },
          theme: { type: 'string', description: '主题风格: default/dark/corporate/minimal' },
          slides: { type: 'string', description: 'JSON格式的幻灯片数组' },
          outputPath: { type: 'string', description: '输出文件路径（可选）' }
        },
        required: ['title', 'slides']
      },
      handler: async (input) => {
        try {
          const slides: SlideContent[] = typeof input.slides === 'string' 
            ? JSON.parse(input.slides) 
            : input.slides;
          
          const config: PPTConfig = {
            title: input.title,
            theme: input.theme || 'default',
            slides
          };
          
          const buffer = await pptGenerator.generate(config);
          
          const outputDir = path.join(process.cwd(), 'public', 'downloads');
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }
          
          const filename = input.outputPath || `report_${Date.now()}.pptx`;
          const filepath = path.join(outputDir, filename);
          fs.writeFileSync(filepath, buffer);
          
          return { 
            content: [{ 
              type: 'text', 
              text: `PPT已生成: /downloads/${filename}\n可通过 http://localhost:3000/downloads/${filename} 下载` 
            }] 
          };
        } catch (error: any) {
          return { content: [{ type: 'text', text: `生成失败: ${error.message}` }], isError: true };
        }
      }
    },
    {
      name: 'create_ppt_from_text',
      description: '从文本内容自动生成PPT（自动拆分幻灯片）',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'PPT标题' },
          content: { type: 'string', description: '要转换的文本内容' },
          theme: { type: 'string', description: '主题风格' }
        },
        required: ['title', 'content']
      },
      handler: async (input) => {
        try {
          const slides = textToSlides(input.title, input.content);
          
          const config: PPTConfig = {
            title: input.title,
            theme: input.theme || 'default',
            slides
          };
          
          const buffer = await pptGenerator.generate(config);
          
          const outputDir = path.join(process.cwd(), 'public', 'downloads');
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }
          
          const filename = `report_${Date.now()}.pptx`;
          const filepath = path.join(outputDir, filename);
          fs.writeFileSync(filepath, buffer);
          
          return { 
            content: [{ 
              type: 'text', 
              text: `PPT已生成（共${slides.length}页）: /downloads/${filename}\n下载地址: http://localhost:3000/downloads/${filename}` 
            }] 
          };
        } catch (error: any) {
          return { content: [{ type: 'text', text: `生成失败: ${error.message}` }], isError: true };
        }
      }
    },
    {
      name: 'create_data_report_ppt',
      description: '根据数据分析结果生成数据报告PPT',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '报告标题' },
          summary: { type: 'string', description: '摘要/结论' },
          insights: { type: 'string', description: 'JSON数组格式的关键发现' },
          tableData: { type: 'string', description: 'JSON二维数组格式的表格数据' },
          chartData: { type: 'string', description: 'JSON格式的图表数据 {type, labels, values}' },
          recommendations: { type: 'string', description: 'JSON数组格式的建议' },
          theme: { type: 'string', description: '主题风格' }
        },
        required: ['title']
      },
      handler: async (input) => {
        try {
          const slides: SlideContent[] = [];
          
          // 封面
          slides.push({
            type: 'title',
            title: input.title,
            subtitle: new Date().toLocaleDateString('zh-CN') + ' 数据分析报告'
          });
          
          // 摘要页
          if (input.summary) {
            slides.push({
              type: 'content',
              title: '报告摘要',
              content: input.summary
            });
          }
          
          // 关键发现
          if (input.insights) {
            const insights = JSON.parse(input.insights);
            slides.push({
              type: 'bullets',
              title: '关键发现',
              bullets: insights
            });
          }
          
          // 数据表格
          if (input.tableData) {
            const tableData = JSON.parse(input.tableData);
            slides.push({
              type: 'table',
              title: '数据详情',
              tableData
            });
          }
          
          // 图表
          if (input.chartData) {
            const chartData = JSON.parse(input.chartData);
            slides.push({
              type: 'chart',
              title: '数据可视化',
              chartData
            });
          }
          
          // 建议
          if (input.recommendations) {
            const recommendations = JSON.parse(input.recommendations);
            slides.push({
              type: 'bullets',
              title: '建议与行动',
              bullets: recommendations
            });
          }
          
          // 结束页
          slides.push({
            type: 'title',
            title: '谢谢',
            subtitle: 'AI Data Platform 自动生成'
          });
          
          const config: PPTConfig = {
            title: input.title,
            theme: input.theme || 'corporate',
            slides
          };
          
          const buffer = await pptGenerator.generate(config);
          
          const outputDir = path.join(process.cwd(), 'public', 'downloads');
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }
          
          const filename = `data_report_${Date.now()}.pptx`;
          const filepath = path.join(outputDir, filename);
          fs.writeFileSync(filepath, buffer);
          
          return { 
            content: [{ 
              type: 'text', 
              text: `数据报告PPT已生成（共${slides.length}页）\n下载: http://localhost:3000/downloads/${filename}` 
            }] 
          };
        } catch (error: any) {
          return { content: [{ type: 'text', text: `生成失败: ${error.message}` }], isError: true };
        }
      }
    }
  ]
};
