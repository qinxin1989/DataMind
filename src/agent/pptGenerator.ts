import PptxGenJS from 'pptxgenjs';

// PPT 幻灯片定义
export interface SlideContent {
  type: 'title' | 'content' | 'bullets' | 'table' | 'chart' | 'image' | 'twoColumn';
  title?: string;
  subtitle?: string;
  content?: string;
  bullets?: string[];
  tableData?: string[][];
  chartData?: {
    type: 'bar' | 'line' | 'pie';
    labels: string[];
    values: number[];
    seriesName?: string;
  };
  leftContent?: string | string[];
  rightContent?: string | string[];
}

export interface PPTConfig {
  title: string;
  author?: string;
  subject?: string;
  theme?: 'default' | 'dark' | 'corporate' | 'minimal';
  slides: SlideContent[];
}

// 主题配色
const THEMES = {
  default: {
    primary: '0066CC',
    secondary: '333333',
    accent: 'FF6600',
    background: 'FFFFFF',
    titleBg: '0066CC'
  },
  dark: {
    primary: '00D4FF',
    secondary: 'FFFFFF',
    accent: '7B2FF7',
    background: '1A1A2E',
    titleBg: '16213E'
  },
  corporate: {
    primary: '003366',
    secondary: '333333',
    accent: 'CC0000',
    background: 'FFFFFF',
    titleBg: '003366'
  },
  minimal: {
    primary: '222222',
    secondary: '666666',
    accent: '0066CC',
    background: 'FFFFFF',
    titleBg: 'F5F5F5'
  }
};

export class PPTGenerator {
  
  // 生成 PPT
  async generate(config: PPTConfig): Promise<Buffer> {
    const pptx = new PptxGenJS();
    const theme = THEMES[config.theme || 'default'];
    
    // 设置文档属性
    pptx.author = config.author || 'AI Data Platform';
    pptx.title = config.title;
    pptx.subject = config.subject || '';
    
    // 设置默认布局
    pptx.defineLayout({ name: 'CUSTOM', width: 13.33, height: 7.5 });
    pptx.layout = 'CUSTOM';
    
    // 生成每一页
    for (const slideContent of config.slides) {
      const slide = pptx.addSlide();
      
      // 设置背景
      if (config.theme === 'dark') {
        slide.background = { color: theme.background };
      }
      
      switch (slideContent.type) {
        case 'title':
          this.addTitleSlide(slide, slideContent, theme);
          break;
        case 'content':
          this.addContentSlide(slide, slideContent, theme);
          break;
        case 'bullets':
          this.addBulletsSlide(slide, slideContent, theme);
          break;
        case 'table':
          this.addTableSlide(slide, slideContent, theme);
          break;
        case 'chart':
          this.addChartSlide(slide, slideContent, theme);
          break;
        case 'twoColumn':
          this.addTwoColumnSlide(slide, slideContent, theme);
          break;
        default:
          this.addContentSlide(slide, slideContent, theme);
      }
    }
    
    // 生成文件
    const data = await pptx.write({ outputType: 'nodebuffer' });
    return data as Buffer;
  }
  
  // 封面页
  private addTitleSlide(slide: PptxGenJS.Slide, content: SlideContent, theme: any) {
    // 背景色块
    slide.addShape('rect', {
      x: 0, y: 2.5, w: '100%', h: 2.5,
      fill: { color: theme.titleBg }
    });
    
    // 主标题
    slide.addText(content.title || '', {
      x: 0.5, y: 2.7, w: 12.33, h: 1.2,
      fontSize: 44,
      bold: true,
      color: 'FFFFFF',
      align: 'center'
    });
    
    // 副标题
    if (content.subtitle) {
      slide.addText(content.subtitle, {
        x: 0.5, y: 4, w: 12.33, h: 0.8,
        fontSize: 24,
        color: 'FFFFFF',
        align: 'center'
      });
    }
  }
  
  // 内容页
  private addContentSlide(slide: PptxGenJS.Slide, content: SlideContent, theme: any) {
    // 标题栏
    slide.addShape('rect', {
      x: 0, y: 0, w: '100%', h: 1.2,
      fill: { color: theme.titleBg }
    });
    
    slide.addText(content.title || '', {
      x: 0.5, y: 0.3, w: 12.33, h: 0.6,
      fontSize: 28,
      bold: true,
      color: theme.titleBg === 'F5F5F5' ? theme.primary : 'FFFFFF'
    });
    
    // 正文内容
    if (content.content) {
      slide.addText(content.content, {
        x: 0.5, y: 1.5, w: 12.33, h: 5.5,
        fontSize: 18,
        color: theme.secondary,
        valign: 'top',
        wrap: true
      });
    }
  }
  
  // 要点列表页
  private addBulletsSlide(slide: PptxGenJS.Slide, content: SlideContent, theme: any) {
    // 标题栏
    slide.addShape('rect', {
      x: 0, y: 0, w: '100%', h: 1.2,
      fill: { color: theme.titleBg }
    });
    
    slide.addText(content.title || '', {
      x: 0.5, y: 0.3, w: 12.33, h: 0.6,
      fontSize: 28,
      bold: true,
      color: theme.titleBg === 'F5F5F5' ? theme.primary : 'FFFFFF'
    });
    
    // 要点列表
    if (content.bullets && content.bullets.length > 0) {
      const bulletText = content.bullets.map(b => ({
        text: b,
        options: { bullet: { type: 'bullet' as const, color: theme.accent }, indentLevel: 0 }
      }));
      
      slide.addText(bulletText, {
        x: 0.5, y: 1.5, w: 12.33, h: 5.5,
        fontSize: 20,
        color: theme.secondary,
        valign: 'top',
        lineSpacing: 36
      });
    }
  }
  
  // 表格页
  private addTableSlide(slide: PptxGenJS.Slide, content: SlideContent, theme: any) {
    // 标题栏
    slide.addShape('rect', {
      x: 0, y: 0, w: '100%', h: 1.2,
      fill: { color: theme.titleBg }
    });
    
    slide.addText(content.title || '', {
      x: 0.5, y: 0.3, w: 12.33, h: 0.6,
      fontSize: 28,
      bold: true,
      color: theme.titleBg === 'F5F5F5' ? theme.primary : 'FFFFFF'
    });
    
    // 表格
    if (content.tableData && content.tableData.length > 0) {
      const tableRows = content.tableData.map((row, rowIdx) => 
        row.map(cell => ({
          text: cell,
          options: {
            fill: { color: rowIdx === 0 ? theme.primary : (rowIdx % 2 === 0 ? 'F5F5F5' : 'FFFFFF') },
            color: rowIdx === 0 ? 'FFFFFF' : theme.secondary,
            bold: rowIdx === 0,
            align: 'center' as const,
            valign: 'middle' as const
          }
        }))
      );
      
      slide.addTable(tableRows, {
        x: 0.5, y: 1.5, w: 12.33,
        fontSize: 14,
        border: { type: 'solid', pt: 1, color: 'CCCCCC' }
      });
    }
  }
  
  // 图表页
  private addChartSlide(slide: PptxGenJS.Slide, content: SlideContent, theme: any) {
    // 标题栏
    slide.addShape('rect', {
      x: 0, y: 0, w: '100%', h: 1.2,
      fill: { color: theme.titleBg }
    });
    
    slide.addText(content.title || '', {
      x: 0.5, y: 0.3, w: 12.33, h: 0.6,
      fontSize: 28,
      bold: true,
      color: theme.titleBg === 'F5F5F5' ? theme.primary : 'FFFFFF'
    });
    
    // 图表
    if (content.chartData) {
      const chartType = content.chartData.type === 'pie' ? 'pie' : 
                       content.chartData.type === 'line' ? 'line' : 'bar';
      
      const chartData = [{
        name: content.chartData.seriesName || '数据',
        labels: content.chartData.labels,
        values: content.chartData.values
      }];
      
      slide.addChart(chartType as any, chartData, {
        x: 1, y: 1.5, w: 11, h: 5.5,
        showLegend: true,
        legendPos: 'b',
        showValue: true,
        chartColors: [theme.primary, theme.accent, '52C41A', 'FAAD14', 'F5222D']
      });
    }
  }
  
  // 两栏布局页
  private addTwoColumnSlide(slide: PptxGenJS.Slide, content: SlideContent, theme: any) {
    // 标题栏
    slide.addShape('rect', {
      x: 0, y: 0, w: '100%', h: 1.2,
      fill: { color: theme.titleBg }
    });
    
    slide.addText(content.title || '', {
      x: 0.5, y: 0.3, w: 12.33, h: 0.6,
      fontSize: 28,
      bold: true,
      color: theme.titleBg === 'F5F5F5' ? theme.primary : 'FFFFFF'
    });
    
    // 左栏
    if (content.leftContent) {
      const leftText = Array.isArray(content.leftContent) 
        ? content.leftContent.map(t => ({ text: t, options: { bullet: true } }))
        : content.leftContent;
      
      slide.addText(leftText, {
        x: 0.5, y: 1.5, w: 5.9, h: 5.5,
        fontSize: 16,
        color: theme.secondary,
        valign: 'top'
      });
    }
    
    // 右栏
    if (content.rightContent) {
      const rightText = Array.isArray(content.rightContent)
        ? content.rightContent.map(t => ({ text: t, options: { bullet: true } }))
        : content.rightContent;
      
      slide.addText(rightText, {
        x: 6.9, y: 1.5, w: 5.9, h: 5.5,
        fontSize: 16,
        color: theme.secondary,
        valign: 'top'
      });
    }
  }
}

export const pptGenerator = new PPTGenerator();
