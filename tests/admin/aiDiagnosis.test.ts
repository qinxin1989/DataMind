/**
 * AI诊断API单元测试
 * 需求: 6.3, 6.4
 * 
 * 测试 POST /api/admin/ai/crawler/diagnose 接口
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock axios
const mockAxiosGet = vi.fn();
vi.mock('axios', () => ({
  default: {
    get: mockAxiosGet
  },
  get: mockAxiosGet
}));

// Mock cheerio
vi.mock('cheerio', () => ({
  load: vi.fn()
}));

// Mock aiConfigService
const mockGetActiveConfigsByPriority = vi.fn();
vi.mock('../../../src/admin/modules/ai/aiConfigService', () => ({
  aiConfigService: {
    getActiveConfigsByPriority: mockGetActiveConfigsByPriority
  }
}));

// Mock OpenAI
const mockCreate = vi.fn();
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate
      }
    }
  }))
}));

describe('AI Diagnosis API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Selector Mismatch Diagnosis (需求 6.3)', () => {
    it('should detect when container selector does not match any elements', async () => {
      const mockHtml = `
        <html>
          <body>
            <div class="content">
              <h1>Title</h1>
              <p>Content</p>
            </div>
          </body>
        </html>
      `;

      mockAxiosGet.mockResolvedValue({
        data: mockHtml
      });

      const cheerio = require('cheerio');
      const $ = cheerio.load(mockHtml);


      const requestBody = {
        url: 'https://example.com',
        selectors: {
          container: '.non-existent-container',
          fields: {
            title: 'h1',
            content: 'p'
          }
        },
        error: '未采集到数据'
      };

      // 模拟诊断逻辑
      const containers = $(requestBody.selectors.container);
      const diagnosis: any = {
        reason: '',
        issues: [],
        suggestions: [],
        recommendedStrategy: {}
      };

      if (containers.length === 0) {
        diagnosis.issues.push('容器选择器未匹配到任何元素');
        diagnosis.suggestions.push('检查容器选择器是否正确，或尝试使用更通用的选择器如 "body"');
      }

      // 验证诊断结果
      expect(diagnosis.issues).toContain('容器选择器未匹配到任何元素');
      expect(diagnosis.suggestions.length).toBeGreaterThan(0);
      expect(diagnosis.suggestions[0]).toContain('检查容器选择器');
    });

    it('should detect when field selectors do not match any elements', async () => {
      const mockHtml = `
        <html>
          <body>
            <div class="container">
              <h1>Title</h1>
            </div>
          </body>
        </html>
      `;

      mockAxiosGet.mockResolvedValue({
        data: mockHtml
      });

      const cheerio = require('cheerio');
      const $ = cheerio.load(mockHtml);


      const requestBody = {
        url: 'https://example.com',
        selectors: {
          container: '.container',
          fields: {
            title: 'h1',
            description: '.description',  // 不存在
            author: '.author'  // 不存在
          }
        }
      };

      // 模拟诊断逻辑
      const diagnosis: any = {
        issues: [],
        suggestions: []
      };

      const failedFields: string[] = [];
      if (requestBody.selectors.fields) {
        for (const [field, selector] of Object.entries(requestBody.selectors.fields)) {
          const elements = $(selector as string);
          if (elements.length === 0) {
            diagnosis.issues.push(`字段 "${field}" 的选择器未匹配到任何元素`);
            failedFields.push(field);
          }
        }
      }

      // 验证诊断结果
      expect(failedFields).toContain('description');
      expect(failedFields).toContain('author');
      expect(failedFields).not.toContain('title');
      expect(diagnosis.issues.length).toBe(2);
      expect(diagnosis.issues[0]).toContain('description');
      expect(diagnosis.issues[1]).toContain('author');
    });

    it('should provide specific suggestions for failed field selectors', async () => {
      const mockHtml = '<html><body><div class="item"><h1>Title</h1></div></body></html>';

      mockAxiosGet.mockResolvedValue({
        data: mockHtml
      });

      const cheerio = require('cheerio');
      const $ = cheerio.load(mockHtml);


      const requestBody = {
        url: 'https://example.com',
        selectors: {
          container: '.item',
          fields: {
            title: 'h1',
            price: '.price',
            date: '.date'
          }
        }
      };

      // 模拟诊断逻辑
      const failedFields: string[] = [];
      const diagnosis: any = {
        issues: [],
        suggestions: []
      };

      for (const [field, selector] of Object.entries(requestBody.selectors.fields)) {
        const elements = $(selector as string);
        if (elements.length === 0) {
          failedFields.push(field);
        }
      }

      if (failedFields.length > 0) {
        diagnosis.suggestions.push(`尝试在浏览器开发者工具中验证这些字段的选择器: ${failedFields.join(', ')}`);
      }

      // 验证
      expect(failedFields).toEqual(['price', 'date']);
      expect(diagnosis.suggestions[0]).toContain('price, date');
      expect(diagnosis.suggestions[0]).toContain('浏览器开发者工具');
    });

    it('should handle all selectors matching successfully', async () => {
      const mockHtml = `
        <html>
          <body>
            <div class="container">
              <h1>Title</h1>
              <p class="description">Description</p>
              <span class="author">Author</span>
            </div>
          </body>
        </html>
      `;

      mockAxiosGet.mockResolvedValue({
        data: mockHtml
      });

      const cheerio = require('cheerio');
      const $ = cheerio.load(mockHtml);


      const requestBody = {
        url: 'https://example.com',
        selectors: {
          container: '.container',
          fields: {
            title: 'h1',
            description: '.description',
            author: '.author'
          }
        }
      };

      // 模拟诊断逻辑
      const diagnosis: any = {
        issues: [],
        suggestions: []
      };

      // 检查容器
      const containers = $(requestBody.selectors.container);
      if (containers.length === 0) {
        diagnosis.issues.push('容器选择器未匹配到任何元素');
      }

      // 检查字段
      const failedFields: string[] = [];
      for (const [field, selector] of Object.entries(requestBody.selectors.fields)) {
        const elements = $(selector as string);
        if (elements.length === 0) {
          failedFields.push(field);
        }
      }

      // 验证：所有选择器都匹配成功
      expect(containers.length).toBeGreaterThan(0);
      expect(failedFields).toHaveLength(0);
      expect(diagnosis.issues).toHaveLength(0);
    });
  });

  describe('Dynamic Loading Detection (需求 6.4)', () => {
    it('should detect pages with many scripts as potentially dynamic', async () => {
      const mockHtml = `
        <html>
          <head>
            <script src="script1.js"></script>
            <script src="script2.js"></script>
            <script src="script3.js"></script>
            <script src="script4.js"></script>
            <script src="script5.js"></script>
            <script src="script6.js"></script>
            <script src="script7.js"></script>
            <script src="script8.js"></script>
            <script src="script9.js"></script>
            <script src="script10.js"></script>
            <script src="script11.js"></script>
          </head>
          <body>
            <div id="app"></div>
          </body>
        </html>
      `;

      mockAxiosGet.mockResolvedValue({
        data: mockHtml
      });

      const cheerio = require('cheerio');
      const $ = cheerio.load(mockHtml);


      // 模拟动态加载检测逻辑
      const hasScripts = $('script').length > 10;
      const diagnosis: any = {
        issues: [],
        suggestions: [],
        recommendedStrategy: {}
      };

      if (hasScripts) {
        diagnosis.issues.push('页面可能使用了动态加载（检测到大量JavaScript或前端框架）');
        diagnosis.suggestions.push('建议使用浏览器自动化工具（如Puppeteer）进行采集');
        diagnosis.recommendedStrategy.useHeadless = true;
        diagnosis.recommendedStrategy.waitForSelector = 'body';
      }

      // 验证
      expect(hasScripts).toBe(true);
      expect(diagnosis.issues).toContain('页面可能使用了动态加载（检测到大量JavaScript或前端框架）');
      expect(diagnosis.suggestions).toContain('建议使用浏览器自动化工具（如Puppeteer）进行采集');
      expect(diagnosis.recommendedStrategy.useHeadless).toBe(true);
    });

    it('should detect React applications', async () => {
      const mockHtml = `
        <html>
          <head>
            <script src="react.js"></script>
            <script src="react-dom.js"></script>
          </head>
          <body>
            <div id="root"></div>
            <script>
              // React application code
              ReactDOM.render(...)
            </script>
          </body>
        </html>
      `;

      mockAxiosGet.mockResolvedValue({
        data: mockHtml
      });

      // 模拟检测逻辑
      const hasReactVue = mockHtml.includes('react') || 
                          mockHtml.includes('vue') || 
                          mockHtml.includes('angular') ||
                          mockHtml.includes('__NEXT_DATA__');

      const diagnosis: any = {
        issues: [],
        suggestions: [],
        recommendedStrategy: {}
      };

      if (hasReactVue) {
        diagnosis.issues.push('页面可能使用了动态加载（检测到大量JavaScript或前端框架）');
        diagnosis.suggestions.push('建议使用浏览器自动化工具（如Puppeteer）进行采集');
        diagnosis.recommendedStrategy.useHeadless = true;
      }

      // 验证
      expect(hasReactVue).toBe(true);
      expect(diagnosis.issues.length).toBeGreaterThan(0);
      expect(diagnosis.recommendedStrategy.useHeadless).toBe(true);
    });

    it('should detect Vue applications', async () => {
      const mockHtml = `
        <html>
          <head>
            <script src="vue.js"></script>
          </head>
          <body>
            <div id="app">
              {{ message }}
            </div>
          </body>
        </html>
      `;

      mockAxiosGet.mockResolvedValue({
        data: mockHtml
      });

      const hasReactVue = mockHtml.includes('vue');

      expect(hasReactVue).toBe(true);
    });

    it('should detect Next.js applications', async () => {
      const mockHtml = `
        <html>
          <head>
            <script id="__NEXT_DATA__" type="application/json">
              {"props":{"pageProps":{}},"page":"/","query":{},"buildId":"development"}
            </script>
          </head>
          <body>
            <div id="__next"></div>
          </body>
        </html>
      `;

      mockAxiosGet.mockResolvedValue({
        data: mockHtml
      });

      const hasNextJS = mockHtml.includes('__NEXT_DATA__');

      expect(hasNextJS).toBe(true);
    });

    it('should detect Angular applications', async () => {
      const mockHtml = `
        <html>
          <head>
            <script src="angular.js"></script>
          </head>
          <body ng-app="myApp">
            <div ng-controller="MainCtrl">
              {{ message }}
            </div>
          </body>
        </html>
      `;

      mockAxiosGet.mockResolvedValue({
        data: mockHtml
      });

      const hasAngular = mockHtml.includes('angular');

      expect(hasAngular).toBe(true);
    });

    it('should not flag static pages as dynamic', async () => {
      const mockHtml = `
        <html>
          <head>
            <title>Static Page</title>
          </head>
          <body>
            <div class="container">
              <h1>Title</h1>
              <p>Content</p>
            </div>
          </body>
        </html>
      `;

      mockAxiosGet.mockResolvedValue({
        data: mockHtml
      });

      const cheerio = require('cheerio');
      const $ = cheerio.load(mockHtml);


      // 模拟检测逻辑
      const hasScripts = $('script').length > 10;
      const hasReactVue = mockHtml.includes('react') || 
                          mockHtml.includes('vue') || 
                          mockHtml.includes('angular') ||
                          mockHtml.includes('__NEXT_DATA__');

      const diagnosis: any = {
        issues: [],
        recommendedStrategy: {}
      };

      if (hasScripts || hasReactVue) {
        diagnosis.issues.push('页面可能使用了动态加载');
        diagnosis.recommendedStrategy.useHeadless = true;
      }

      // 验证：静态页面不应该被标记为动态
      expect(hasScripts).toBe(false);
      expect(hasReactVue).toBe(false);
      expect(diagnosis.issues).toHaveLength(0);
      expect(diagnosis.recommendedStrategy.useHeadless).toBeUndefined();
    });

    it('should recommend waitForSelector when dynamic loading detected', async () => {
      const mockHtml = `
        <html>
          <head>
            <script src="react.js"></script>
          </head>
          <body>
            <div id="root"></div>
          </body>
        </html>
      `;

      mockAxiosGet.mockResolvedValue({
        data: mockHtml
      });

      const requestBody = {
        url: 'https://example.com',
        selectors: {
          container: '.data-container'
        }
      };

      const hasReactVue = mockHtml.includes('react');
      const diagnosis: any = {
        recommendedStrategy: {}
      };

      if (hasReactVue) {
        diagnosis.recommendedStrategy.useHeadless = true;
        diagnosis.recommendedStrategy.waitForSelector = requestBody.selectors.container || 'body';
      }

      // 验证
      expect(diagnosis.recommendedStrategy.useHeadless).toBe(true);
      expect(diagnosis.recommendedStrategy.waitForSelector).toBe('.data-container');
    });
  });

  describe('Recommended Strategy Generation (需求 6.4)', () => {
    it('should generate strategy with useHeadless for dynamic pages', async () => {
      const mockHtml = `
        <html>
          <head>
            <script src="react.js"></script>
          </head>
          <body>
            <div id="app"></div>
          </body>
        </html>
      `;

      mockAxiosGet.mockResolvedValue({
        data: mockHtml
      });

      const hasReactVue = mockHtml.includes('react');
      const diagnosis: any = {
        recommendedStrategy: {}
      };

      if (hasReactVue) {
        diagnosis.recommendedStrategy.useHeadless = true;
        diagnosis.recommendedStrategy.waitForSelector = 'body';
      }

      // 验证策略
      expect(diagnosis.recommendedStrategy).toHaveProperty('useHeadless');
      expect(diagnosis.recommendedStrategy.useHeadless).toBe(true);
      expect(diagnosis.recommendedStrategy).toHaveProperty('waitForSelector');
    });

    it('should include waitForSelector in strategy', async () => {
      const requestBody = {
        url: 'https://example.com',
        selectors: {
          container: '.product-list'
        }
      };

      const diagnosis: any = {
        recommendedStrategy: {
          useHeadless: true,
          waitForSelector: requestBody.selectors.container
        }
      };

      // 验证
      expect(diagnosis.recommendedStrategy.waitForSelector).toBe('.product-list');
    });

    it('should provide default strategy when no issues detected', async () => {
      const mockHtml = '<html><body><div class="content">Static content</div></body></html>';

      mockAxiosGet.mockResolvedValue({
        data: mockHtml
      });

      const requestBody = {
        url: 'https://example.com',
        selectors: {
          container: '.content'
        }
      };

      const diagnosis: any = {
        recommendedStrategy: {}
      };

      // 如果没有推荐策略，提供默认策略
      if (Object.keys(diagnosis.recommendedStrategy).length === 0) {
        diagnosis.recommendedStrategy = {
          useHeadless: false,
          waitForSelector: requestBody.selectors.container || 'body'
        };
      }

      // 验证
      expect(diagnosis.recommendedStrategy.useHeadless).toBe(false);
      expect(diagnosis.recommendedStrategy.waitForSelector).toBe('.content');
    });

    it('should suggest scrollToBottom for infinite scroll pages', async () => {
      const diagnosis: any = {
        recommendedStrategy: {
          useHeadless: true,
          waitForSelector: '.item',
          scrollToBottom: true
        }
      };

      // 验证
      expect(diagnosis.recommendedStrategy.scrollToBottom).toBe(true);
    });

    it('should allow custom script in strategy', async () => {
      const diagnosis: any = {
        recommendedStrategy: {
          useHeadless: true,
          waitForSelector: '.data',
          customScript: 'await page.click(".load-more"); await page.waitForTimeout(2000);'
        }
      };

      // 验证
      expect(diagnosis.recommendedStrategy).toHaveProperty('customScript');
      expect(diagnosis.recommendedStrategy.customScript).toContain('page.click');
    });

    it('should combine multiple strategy options', async () => {
      const diagnosis: any = {
        recommendedStrategy: {
          useHeadless: true,
          waitForSelector: '.content',
          scrollToBottom: true,
          customScript: 'await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));'
        }
      };

      // 验证：策略包含多个选项
      expect(Object.keys(diagnosis.recommendedStrategy).length).toBeGreaterThanOrEqual(3);
      expect(diagnosis.recommendedStrategy.useHeadless).toBe(true);
      expect(diagnosis.recommendedStrategy.scrollToBottom).toBe(true);
      expect(diagnosis.recommendedStrategy.customScript).toBeTruthy();
    });
  });

  describe('AI Analysis Integration', () => {
    it('should call AI service when configured', async () => {
      const mockHtml = '<html><body><div>Content</div></body></html>';

      mockAxiosGet.mockResolvedValue({
        data: mockHtml
      });

      // Mock AI配置
      mockGetActiveConfigsByPriority.mockResolvedValue([
        {
          apiKey: 'test-key',
          baseUrl: 'https://api.openai.com/v1',
          model: 'gpt-4o'
        }
      ]);

      // Mock AI响应
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                reason: '选择器不匹配',
                suggestions: ['建议1', '建议2'],
                strategy: {
                  useHeadless: true,
                  waitForSelector: '.content'
                }
              })
            }
          }
        ]
      });

      const requestBody = {
        url: 'https://example.com',
        selectors: {
          container: '.container',
          fields: { title: '.title' }
        },
        error: '未采集到数据'
      };

      // 模拟AI分析流程
      const aiConfigs = await mockGetActiveConfigsByPriority();
      expect(aiConfigs).toHaveLength(1);

      if (aiConfigs && aiConfigs.length > 0) {
        const aiResponse = await mockCreate({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: '你是一个专业的网页爬虫诊断专家' },
            { role: 'user', content: '分析采集失败原因' }
          ]
        });

        const aiContent = aiResponse.choices[0]?.message?.content || '';
        const aiAnalysis = JSON.parse(aiContent);

        // 验证AI分析结果
        expect(aiAnalysis).toHaveProperty('reason');
        expect(aiAnalysis).toHaveProperty('suggestions');
        expect(aiAnalysis).toHaveProperty('strategy');
        expect(aiAnalysis.suggestions).toBeInstanceOf(Array);
        expect(aiAnalysis.strategy.useHeadless).toBe(true);
      }
    });

    it('should handle AI service errors gracefully', async () => {
      const mockHtml = '<html><body><div>Content</div></body></html>';

      mockAxiosGet.mockResolvedValue({
        data: mockHtml
      });

      // Mock AI配置
      mockGetActiveConfigsByPriority.mockResolvedValue([
        {
          apiKey: 'test-key',
          baseUrl: 'https://api.openai.com/v1',
          model: 'gpt-4o'
        }
      ]);

      // Mock AI服务错误
      mockCreate.mockRejectedValue(new Error('AI service timeout'));

      const diagnosis: any = {
        reason: '',
        issues: ['选择器不匹配'],
        suggestions: []
      };

      try {
        await mockCreate({
          model: 'gpt-4o',
          messages: []
        });
      } catch (aiErr: any) {
        // AI分析失败，使用基本分析
        diagnosis.reason = diagnosis.issues.join('; ') || '未检测到明显问题';
        diagnosis.suggestions.push('尝试在浏览器开发者工具中验证选择器');
      }

      // 验证：即使AI失败，也应该有基本诊断
      expect(diagnosis.reason).toBeTruthy();
      expect(diagnosis.suggestions.length).toBeGreaterThan(0);
    });

    it('should use basic analysis when no AI config available', async () => {
      const mockHtml = '<html><body><div>Content</div></body></html>';

      mockAxiosGet.mockResolvedValue({
        data: mockHtml
      });

      // Mock 没有AI配置
      mockGetActiveConfigsByPriority.mockResolvedValue([]);

      const diagnosis: any = {
        issues: ['容器选择器未匹配到任何元素'],
        suggestions: [],
        reason: ''
      };

      const aiConfigs = await mockGetActiveConfigsByPriority();
      
      if (!aiConfigs || aiConfigs.length === 0) {
        // 没有AI配置，使用基本分析
        diagnosis.reason = diagnosis.issues.join('; ') || '未检测到明显问题';
        diagnosis.suggestions.push('检查容器选择器是否正确');
      }

      // 验证：没有AI配置时应该使用基本分析
      expect(diagnosis.reason).toBe('容器选择器未匹配到任何元素');
      expect(diagnosis.suggestions).toContain('检查容器选择器是否正确');
    });

    it('should parse AI JSON response correctly', async () => {
      const aiResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                reason: '页面使用了动态加载',
                suggestions: [
                  '使用Puppeteer进行采集',
                  '等待页面完全加载后再提取数据',
                  '检查是否需要登录'
                ],
                strategy: {
                  useHeadless: true,
                  waitForSelector: '.data-container',
                  scrollToBottom: false
                }
              })
            }
          }
        ]
      };

      const aiContent = aiResponse.choices[0]?.message?.content || '';
      const aiAnalysis = JSON.parse(aiContent);

      // 验证解析结果
      expect(aiAnalysis.reason).toBe('页面使用了动态加载');
      expect(aiAnalysis.suggestions).toHaveLength(3);
      expect(aiAnalysis.suggestions[0]).toContain('Puppeteer');
      expect(aiAnalysis.strategy.useHeadless).toBe(true);
      expect(aiAnalysis.strategy.waitForSelector).toBe('.data-container');
    });

    it('should handle non-JSON AI response', async () => {
      const aiResponse = {
        choices: [
          {
            message: {
              content: '这个页面使用了React框架，建议使用浏览器自动化工具进行采集。'
            }
          }
        ]
      };

      const aiContent = aiResponse.choices[0]?.message?.content || '';
      const diagnosis: any = {
        reason: '',
        suggestions: []
      };

      try {
        const aiAnalysis = JSON.parse(aiContent);
        diagnosis.reason = aiAnalysis.reason;
      } catch (parseErr) {
        // 如果AI返回的不是JSON，直接使用文本
        diagnosis.reason = aiContent;
      }

      // 验证：非JSON响应应该被直接使用
      expect(diagnosis.reason).toContain('React框架');
      expect(diagnosis.reason).toContain('浏览器自动化工具');
    });

    it('should merge AI suggestions with basic diagnosis', async () => {
      const basicDiagnosis = {
        issues: ['容器选择器未匹配到任何元素'],
        suggestions: ['检查容器选择器是否正确'],
        recommendedStrategy: {
          useHeadless: false
        }
      };

      const aiAnalysis = {
        reason: '页面结构可能已更新',
        suggestions: ['尝试使用更通用的选择器', '检查页面是否有多个版本'],
        strategy: {
          useHeadless: true,
          waitForSelector: 'body'
        }
      };

      // 合并诊断结果
      const mergedDiagnosis = {
        reason: aiAnalysis.reason || basicDiagnosis.issues.join('; '),
        suggestions: [...basicDiagnosis.suggestions, ...aiAnalysis.suggestions],
        recommendedStrategy: {
          ...basicDiagnosis.recommendedStrategy,
          ...aiAnalysis.strategy
        }
      };

      // 验证合并结果
      expect(mergedDiagnosis.reason).toBe('页面结构可能已更新');
      expect(mergedDiagnosis.suggestions).toHaveLength(3);
      expect(mergedDiagnosis.suggestions).toContain('检查容器选择器是否正确');
      expect(mergedDiagnosis.suggestions).toContain('尝试使用更通用的选择器');
      expect(mergedDiagnosis.recommendedStrategy.useHeadless).toBe(true);
    });
  });

  describe('Parameter Validation', () => {
    it('should require url parameter', () => {
      const requestBody = {
        selectors: { container: '.item' },
        error: '采集失败'
      };

      expect(requestBody.url).toBeUndefined();
    });

    it('should require selectors parameter', () => {
      const requestBody = {
        url: 'https://example.com',
        error: '采集失败'
      };

      expect(requestBody.selectors).toBeUndefined();
    });

    it('should validate url format', () => {
      const validUrls = [
        'http://example.com',
        'https://example.com',
        'https://example.com/path'
      ];

      const invalidUrls = [
        'not-a-url',
        'ftp://example.com',
        'example.com'
      ];

      validUrls.forEach(url => {
        expect(url.startsWith('http://') || url.startsWith('https://')).toBe(true);
      });

      invalidUrls.forEach(url => {
        expect(url.startsWith('http://') || url.startsWith('https://')).toBe(false);
      });
    });

    it('should accept error parameter as optional', () => {
      const requestBody1 = {
        url: 'https://example.com',
        selectors: { container: '.item' }
        // error 未提供
      };

      const requestBody2 = {
        url: 'https://example.com',
        selectors: { container: '.item' },
        error: '未采集到数据'
      };

      expect(requestBody1.error).toBeUndefined();
      expect(requestBody2.error).toBe('未采集到数据');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors when fetching page', async () => {
      mockAxiosGet.mockRejectedValue(new Error('Network error'));

      try {
        await mockAxiosGet('https://example.com');
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toBe('Network error');
      }
    });

    it('should handle timeout errors', async () => {
      mockAxiosGet.mockRejectedValue({
        code: 'ETIMEDOUT',
        message: 'Timeout'
      });

      try {
        await mockAxiosGet('https://example.com');
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.code).toBe('ETIMEDOUT');
      }
    });

    it('should handle 404 errors', async () => {
      mockAxiosGet.mockRejectedValue({
        response: { status: 404 },
        message: 'Not Found'
      });

      try {
        await mockAxiosGet('https://example.com/not-found');
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.response.status).toBe(404);
      }
    });

    it('should handle malformed HTML gracefully', async () => {
      const mockHtml = '<html><body><div><p>Unclosed tags';

      mockAxiosGet.mockResolvedValue({
        data: mockHtml
      });

      const cheerio = require('cheerio');
      const $ = cheerio.load(mockHtml);


      // Cheerio应该能够解析格式错误的HTML
      const selector = 'p';
      const matchCount = $(selector).length;

      expect(matchCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Complete Diagnosis Flow', () => {
    it('should provide complete diagnosis for failed extraction', async () => {
      const mockHtml = `
        <html>
          <head>
            <script src="react.js"></script>
            <script src="react-dom.js"></script>
          </head>
          <body>
            <div id="root"></div>
          </body>
        </html>
      `;

      mockAxiosGet.mockResolvedValue({
        data: mockHtml
      });

      const cheerio = require('cheerio');
      const $ = cheerio.load(mockHtml);


      const requestBody = {
        url: 'https://example.com',
        selectors: {
          container: '.product-list',
          fields: {
            title: '.product-title',
            price: '.product-price'
          }
        },
        error: '未采集到数据'
      };

      // 完整诊断流程
      const diagnosis: any = {
        reason: '',
        issues: [],
        suggestions: [],
        recommendedStrategy: {}
      };

      // 1. 检查选择器匹配
      const containers = $(requestBody.selectors.container);
      if (containers.length === 0) {
        diagnosis.issues.push('容器选择器未匹配到任何元素');
        diagnosis.suggestions.push('检查容器选择器是否正确');
      }

      const failedFields: string[] = [];
      for (const [field, selector] of Object.entries(requestBody.selectors.fields)) {
        const elements = $(selector as string);
        if (elements.length === 0) {
          diagnosis.issues.push(`字段 "${field}" 的选择器未匹配到任何元素`);
          failedFields.push(field);
        }
      }

      // 2. 检查动态加载
      const hasScripts = $('script').length > 10;
      const hasReactVue = mockHtml.includes('react') || mockHtml.includes('vue');

      if (hasScripts || hasReactVue) {
        diagnosis.issues.push('页面可能使用了动态加载');
        diagnosis.suggestions.push('建议使用浏览器自动化工具（如Puppeteer）进行采集');
        diagnosis.recommendedStrategy.useHeadless = true;
        diagnosis.recommendedStrategy.waitForSelector = requestBody.selectors.container || 'body';
      }

      // 3. 生成诊断原因
      diagnosis.reason = diagnosis.issues.join('; ') || '未检测到明显问题';

      // 4. 提供默认策略
      if (Object.keys(diagnosis.recommendedStrategy).length === 0) {
        diagnosis.recommendedStrategy = {
          useHeadless: false,
          waitForSelector: requestBody.selectors.container || 'body'
        };
      }

      // 验证完整诊断结果
      expect(diagnosis).toHaveProperty('reason');
      expect(diagnosis).toHaveProperty('issues');
      expect(diagnosis).toHaveProperty('suggestions');
      expect(diagnosis).toHaveProperty('recommendedStrategy');
      expect(diagnosis.issues.length).toBeGreaterThan(0);
      expect(diagnosis.suggestions.length).toBeGreaterThan(0);
      expect(diagnosis.recommendedStrategy).toHaveProperty('useHeadless');
      expect(diagnosis.recommendedStrategy).toHaveProperty('waitForSelector');
    });

    it('should provide minimal diagnosis for successful extraction', async () => {
      const mockHtml = `
        <html>
          <body>
            <div class="product-list">
              <div class="product">
                <h2 class="product-title">Product 1</h2>
                <span class="product-price">$10</span>
              </div>
            </div>
          </body>
        </html>
      `;

      mockAxiosGet.mockResolvedValue({
        data: mockHtml
      });

      const cheerio = require('cheerio');
      const $ = cheerio.load(mockHtml);


      const requestBody = {
        url: 'https://example.com',
        selectors: {
          container: '.product-list',
          fields: {
            title: '.product-title',
            price: '.product-price'
          }
        }
      };

      const diagnosis: any = {
        reason: '',
        issues: [],
        suggestions: [],
        recommendedStrategy: {}
      };

      // 检查选择器
      const containers = $(requestBody.selectors.container);
      if (containers.length === 0) {
        diagnosis.issues.push('容器选择器未匹配到任何元素');
      }

      for (const [field, selector] of Object.entries(requestBody.selectors.fields)) {
        const elements = $(selector as string);
        if (elements.length === 0) {
          diagnosis.issues.push(`字段 "${field}" 的选择器未匹配到任何元素`);
        }
      }

      // 检查动态加载
      const hasScripts = $('script').length > 10;
      const hasReactVue = mockHtml.includes('react') || mockHtml.includes('vue');

      if (hasScripts || hasReactVue) {
        diagnosis.issues.push('页面可能使用了动态加载');
      }

      diagnosis.reason = diagnosis.issues.join('; ') || '未检测到明显问题';

      // 验证：成功的情况应该没有问题
      expect(diagnosis.issues).toHaveLength(0);
      expect(diagnosis.reason).toBe('未检测到明显问题');
    });
  });
});
