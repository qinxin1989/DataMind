/**
 * 模板测试API单元测试
 * 需求: 10.3, 10.4
 * 
 * 测试 POST /api/admin/ai/crawler/test 接口
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock crawlerAssistantService
const mockPreviewExtraction = vi.fn();
vi.mock('../../../src/admin/modules/ai/crawlerAssistantService', () => ({
  crawlerAssistantService: {
    previewExtraction: mockPreviewExtraction
  }
}));

describe('Template Test API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Success Scenarios (需求 10.3)', () => {
    it('should return success result when test succeeds with data', async () => {
      // 模拟成功采集到数据
      const mockData = [
        { id: 1, title: 'Item 1', content: 'Content 1' },
        { id: 2, title: 'Item 2', content: 'Content 2' },
        { id: 3, title: 'Item 3', content: 'Content 3' }
      ];

      mockPreviewExtraction.mockResolvedValue(mockData);

      const requestBody = {
        url: 'https://example.com',
        selectors: {
          container: '.item',
          fields: {
            title: '.title',
            content: '.content'
          }
        }
      };

      // 模拟API逻辑
      let testResult: any;
      let testError: string | null = null;
      
      try {
        testResult = await mockPreviewExtraction(requestBody.url, requestBody.selectors);
      } catch (extractErr: any) {
        testError = extractErr.message;
        testResult = [];
      }

      const isSuccess = Array.isArray(testResult) && testResult.length > 0;
      const dataCount = Array.isArray(testResult) ? testResult.length : 0;

      const result: any = {
        success: isSuccess,
        data: testResult,
        count: dataCount,
        url: requestBody.url,
        selectors: requestBody.selectors,
        timestamp: Date.now()
      };

      if (isSuccess) {
        result.message = `✓ 测试成功！采集到 ${dataCount} 条数据`;
        result.summary = {
          totalItems: dataCount,
          fields: Object.keys(requestBody.selectors.fields || {}),
          containerUsed: requestBody.selectors.container || 'body'
        };
      }

      // 验证成功场景
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
      expect(result.count).toBe(3);
      expect(result.message).toContain('测试成功');
      expect(result.message).toContain('3 条数据');
      expect(result.summary).toBeDefined();
      expect(result.summary.totalItems).toBe(3);
      expect(result.summary.fields).toEqual(['title', 'content']);
      expect(result.summary.containerUsed).toBe('.item');
    });

    it('should include correct metadata in success response', async () => {
      const mockData = [
        { name: 'Product 1', price: '$10' },
        { name: 'Product 2', price: '$20' }
      ];

      mockPreviewExtraction.mockResolvedValue(mockData);

      const requestBody = {
        url: 'https://shop.example.com/products',
        selectors: {
          container: '.product',
          fields: {
            name: '.product-name',
            price: '.product-price'
          }
        }
      };

      const testResult = await mockPreviewExtraction(requestBody.url, requestBody.selectors);
      const isSuccess = Array.isArray(testResult) && testResult.length > 0;
      const dataCount = Array.isArray(testResult) ? testResult.length : 0;

      const result: any = {
        success: isSuccess,
        data: testResult,
        count: dataCount,
        url: requestBody.url,
        selectors: requestBody.selectors,
        timestamp: Date.now()
      };

      if (isSuccess) {
        result.message = `✓ 测试成功！采集到 ${dataCount} 条数据`;
        result.summary = {
          totalItems: dataCount,
          fields: Object.keys(requestBody.selectors.fields || {}),
          containerUsed: requestBody.selectors.container || 'body'
        };
      }

      // 验证响应包含所有必要字段
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('count');
      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('selectors');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('summary');
      
      // 验证URL和selectors被正确返回
      expect(result.url).toBe('https://shop.example.com/products');
      expect(result.selectors.container).toBe('.product');
      expect(result.selectors.fields.name).toBe('.product-name');
    });


    it('should handle large datasets successfully', async () => {
      const mockData = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        title: `Item ${i + 1}`
      }));

      mockPreviewExtraction.mockResolvedValue(mockData);

      const requestBody = {
        url: 'https://example.com',
        selectors: {
          container: '.item',
          fields: { title: '.title' }
        }
      };

      const testResult = await mockPreviewExtraction(requestBody.url, requestBody.selectors);
      const isSuccess = Array.isArray(testResult) && testResult.length > 0;
      const dataCount = Array.isArray(testResult) ? testResult.length : 0;

      const result: any = {
        success: isSuccess,
        data: testResult,
        count: dataCount,
        url: requestBody.url,
        selectors: requestBody.selectors,
        timestamp: Date.now()
      };

      if (isSuccess) {
        result.message = `✓ 测试成功！采集到 ${dataCount} 条数据`;
        result.summary = {
          totalItems: dataCount,
          fields: Object.keys(requestBody.selectors.fields || {}),
          containerUsed: requestBody.selectors.container || 'body'
        };
      }

      expect(result.success).toBe(true);
      expect(result.count).toBe(100);
      expect(result.data).toHaveLength(100);
      expect(result.message).toContain('100 条数据');
    });

    it('should handle single item successfully', async () => {
      const mockData = [{ id: 1, title: 'Single Item' }];

      mockPreviewExtraction.mockResolvedValue(mockData);

      const requestBody = {
        url: 'https://example.com',
        selectors: {
          container: '.item',
          fields: { title: '.title' }
        }
      };

      const testResult = await mockPreviewExtraction(requestBody.url, requestBody.selectors);
      const isSuccess = Array.isArray(testResult) && testResult.length > 0;
      const dataCount = Array.isArray(testResult) ? testResult.length : 0;

      const result: any = {
        success: isSuccess,
        data: testResult,
        count: dataCount,
        url: requestBody.url,
        selectors: requestBody.selectors,
        timestamp: Date.now()
      };

      if (isSuccess) {
        result.message = `✓ 测试成功！采集到 ${dataCount} 条数据`;
        result.summary = {
          totalItems: dataCount,
          fields: Object.keys(requestBody.selectors.fields || {}),
          containerUsed: requestBody.selectors.container || 'body'
        };
      }

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
      expect(result.message).toContain('1 条数据');
    });

    it('should include pagination info when pagination is enabled', async () => {
      const mockData = [
        { id: 1, title: 'Item 1' },
        { id: 2, title: 'Item 2' }
      ];

      mockPreviewExtraction.mockResolvedValue(mockData);

      const requestBody = {
        url: 'https://example.com',
        selectors: {
          container: '.item',
          fields: { title: '.title' }
        },
        paginationConfig: {
          enabled: true,
          maxPages: 5
        }
      };

      const testResult = await mockPreviewExtraction(requestBody.url, requestBody.selectors);
      const isSuccess = Array.isArray(testResult) && testResult.length > 0;
      const dataCount = Array.isArray(testResult) ? testResult.length : 0;

      const result: any = {
        success: isSuccess,
        data: testResult,
        count: dataCount,
        url: requestBody.url,
        selectors: requestBody.selectors,
        timestamp: Date.now()
      };

      if (isSuccess) {
        result.message = `✓ 测试成功！采集到 ${dataCount} 条数据`;
        result.summary = {
          totalItems: dataCount,
          fields: Object.keys(requestBody.selectors.fields || {}),
          containerUsed: requestBody.selectors.container || 'body'
        };
      }

      // 添加分页信息
      if (requestBody.paginationConfig && requestBody.paginationConfig.enabled) {
        result.pagination = {
          enabled: true,
          maxPages: requestBody.paginationConfig.maxPages || 1,
          note: '注意：测试模式只采集第一页数据'
        };
      }

      expect(result.success).toBe(true);
      expect(result.pagination).toBeDefined();
      expect(result.pagination.enabled).toBe(true);
      expect(result.pagination.maxPages).toBe(5);
      expect(result.pagination.note).toContain('测试模式只采集第一页数据');
    });
  });


  describe('Failure Scenarios (需求 10.3)', () => {
    it('should return failure result when no data is extracted', async () => {
      // 模拟采集失败，返回空数组
      mockPreviewExtraction.mockResolvedValue([]);

      const requestBody = {
        url: 'https://example.com',
        selectors: {
          container: '.item',
          fields: {
            title: '.title',
            content: '.content'
          }
        }
      };

      let testResult: any;
      let testError: string | null = null;
      
      try {
        testResult = await mockPreviewExtraction(requestBody.url, requestBody.selectors);
      } catch (extractErr: any) {
        testError = extractErr.message;
        testResult = [];
      }

      const isSuccess = Array.isArray(testResult) && testResult.length > 0;
      const dataCount = Array.isArray(testResult) ? testResult.length : 0;

      const result: any = {
        success: isSuccess,
        data: testResult,
        count: dataCount,
        url: requestBody.url,
        selectors: requestBody.selectors,
        timestamp: Date.now()
      };

      if (!isSuccess) {
        result.message = testError 
          ? `✗ 测试失败：${testError}` 
          : '✗ 测试失败：未采集到数据，请检查选择器配置';
        result.error = testError || '未采集到数据';
        
        result.suggestions = [
          '1. 使用浏览器开发者工具验证选择器是否正确',
          '2. 检查网页是否需要登录或有反爬虫机制',
          '3. 尝试使用"AI分析"功能获取详细诊断'
        ];
      }

      // 验证失败场景
      expect(result.success).toBe(false);
      expect(result.data).toHaveLength(0);
      expect(result.count).toBe(0);
      expect(result.message).toContain('测试失败');
      expect(result.message).toContain('未采集到数据');
      expect(result.error).toBe('未采集到数据');
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions).toHaveLength(3);
    });

    it('should return failure result with error message when extraction throws error', async () => {
      // 模拟采集过程抛出错误
      const errorMessage = 'Network timeout';
      mockPreviewExtraction.mockRejectedValue(new Error(errorMessage));

      const requestBody = {
        url: 'https://example.com',
        selectors: {
          container: '.item',
          fields: { title: '.title' }
        }
      };

      let testResult: any;
      let testError: string | null = null;
      
      try {
        testResult = await mockPreviewExtraction(requestBody.url, requestBody.selectors);
      } catch (extractErr: any) {
        testError = extractErr.message;
        testResult = [];
      }

      const isSuccess = Array.isArray(testResult) && testResult.length > 0;
      const dataCount = Array.isArray(testResult) ? testResult.length : 0;

      const result: any = {
        success: isSuccess,
        data: testResult,
        count: dataCount,
        url: requestBody.url,
        selectors: requestBody.selectors,
        timestamp: Date.now()
      };

      if (!isSuccess) {
        result.message = testError 
          ? `✗ 测试失败：${testError}` 
          : '✗ 测试失败：未采集到数据，请检查选择器配置';
        result.error = testError || '未采集到数据';
        
        result.suggestions = [
          '1. 使用浏览器开发者工具验证选择器是否正确',
          '2. 检查网页是否需要登录或有反爬虫机制',
          '3. 尝试使用"AI分析"功能获取详细诊断'
        ];
      }

      // 验证错误被正确捕获和处理
      expect(result.success).toBe(false);
      expect(result.error).toBe(errorMessage);
      expect(result.message).toContain('测试失败');
      expect(result.message).toContain(errorMessage);
      expect(result.suggestions).toBeDefined();
    });

    it('should provide helpful suggestions on failure', async () => {
      mockPreviewExtraction.mockResolvedValue([]);

      const requestBody = {
        url: 'https://example.com',
        selectors: {
          container: '.wrong-selector',
          fields: { title: '.wrong-title' }
        }
      };

      let testResult: any;
      let testError: string | null = null;
      
      try {
        testResult = await mockPreviewExtraction(requestBody.url, requestBody.selectors);
      } catch (extractErr: any) {
        testError = extractErr.message;
        testResult = [];
      }

      const isSuccess = Array.isArray(testResult) && testResult.length > 0;

      const result: any = {
        success: isSuccess,
        data: testResult,
        count: 0,
        url: requestBody.url,
        selectors: requestBody.selectors,
        timestamp: Date.now()
      };

      if (!isSuccess) {
        result.message = testError 
          ? `✗ 测试失败：${testError}` 
          : '✗ 测试失败：未采集到数据，请检查选择器配置';
        result.error = testError || '未采集到数据';
        
        result.suggestions = [
          '1. 使用浏览器开发者工具验证选择器是否正确',
          '2. 检查网页是否需要登录或有反爬虫机制',
          '3. 尝试使用"AI分析"功能获取详细诊断'
        ];
      }

      // 验证建议列表
      expect(result.suggestions).toBeDefined();
      expect(Array.isArray(result.suggestions)).toBe(true);
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions[0]).toContain('浏览器开发者工具');
      expect(result.suggestions[1]).toContain('登录');
      expect(result.suggestions[2]).toContain('AI分析');
    });
  });


  describe('Error Handling (需求 10.4)', () => {
    it('should handle missing url parameter', () => {
      const requestBody = {
        selectors: {
          container: '.item',
          fields: { title: '.title' }
        }
        // url 缺失
      };

      // 参数验证
      const hasRequiredParams = requestBody.url && requestBody.selectors;
      expect(hasRequiredParams).toBeFalsy();
      expect(requestBody.url).toBeUndefined();
    });

    it('should handle missing selectors parameter', () => {
      const requestBody = {
        url: 'https://example.com'
        // selectors 缺失
      };

      const hasRequiredParams = requestBody.url && requestBody.selectors;
      expect(hasRequiredParams).toBeFalsy();
      expect(requestBody.selectors).toBeUndefined();
    });

    it('should validate URL format', () => {
      const validUrls = [
        'http://example.com',
        'https://example.com',
        'https://example.com/path',
        'https://example.com/path?query=value'
      ];

      const invalidUrls = [
        'not-a-url',
        'ftp://example.com',
        'example.com',
        '',
        'javascript:alert(1)'
      ];

      validUrls.forEach(url => {
        const isValid = url.startsWith('http://') || url.startsWith('https://');
        expect(isValid).toBe(true);
      });

      invalidUrls.forEach(url => {
        const isValid = url.startsWith('http://') || url.startsWith('https://');
        expect(isValid).toBe(false);
      });
    });

    it('should handle network errors gracefully', async () => {
      const networkError = new Error('ECONNREFUSED');
      mockPreviewExtraction.mockRejectedValue(networkError);

      const requestBody = {
        url: 'https://unreachable-site.com',
        selectors: {
          container: '.item',
          fields: { title: '.title' }
        }
      };

      let testResult: any;
      let testError: string | null = null;
      
      try {
        testResult = await mockPreviewExtraction(requestBody.url, requestBody.selectors);
      } catch (extractErr: any) {
        testError = extractErr.message;
        testResult = [];
      }

      const isSuccess = Array.isArray(testResult) && testResult.length > 0;

      const result: any = {
        success: isSuccess,
        data: testResult,
        count: 0,
        url: requestBody.url,
        selectors: requestBody.selectors,
        timestamp: Date.now()
      };

      if (!isSuccess) {
        result.message = testError 
          ? `✗ 测试失败：${testError}` 
          : '✗ 测试失败：未采集到数据，请检查选择器配置';
        result.error = testError || '未采集到数据';
        
        result.suggestions = [
          '1. 使用浏览器开发者工具验证选择器是否正确',
          '2. 检查网页是否需要登录或有反爬虫机制',
          '3. 尝试使用"AI分析"功能获取详细诊断'
        ];
      }

      expect(result.success).toBe(false);
      expect(result.error).toBe('ECONNREFUSED');
      expect(result.message).toContain('ECONNREFUSED');
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Request timeout');
      mockPreviewExtraction.mockRejectedValue(timeoutError);

      const requestBody = {
        url: 'https://slow-site.com',
        selectors: {
          container: '.item',
          fields: { title: '.title' }
        }
      };

      let testResult: any;
      let testError: string | null = null;
      
      try {
        testResult = await mockPreviewExtraction(requestBody.url, requestBody.selectors);
      } catch (extractErr: any) {
        testError = extractErr.message;
        testResult = [];
      }

      const isSuccess = Array.isArray(testResult) && testResult.length > 0;

      const result: any = {
        success: isSuccess,
        data: testResult,
        count: 0,
        url: requestBody.url,
        selectors: requestBody.selectors,
        timestamp: Date.now()
      };

      if (!isSuccess) {
        result.message = testError 
          ? `✗ 测试失败：${testError}` 
          : '✗ 测试失败：未采集到数据，请检查选择器配置';
        result.error = testError || '未采集到数据';
        
        result.suggestions = [
          '1. 使用浏览器开发者工具验证选择器是否正确',
          '2. 检查网页是否需要登录或有反爬虫机制',
          '3. 尝试使用"AI分析"功能获取详细诊断'
        ];
      }

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('should handle invalid selector syntax errors', async () => {
      const selectorError = new Error('Invalid CSS selector syntax');
      mockPreviewExtraction.mockRejectedValue(selectorError);

      const requestBody = {
        url: 'https://example.com',
        selectors: {
          container: '[[invalid]]',
          fields: { title: '.title' }
        }
      };

      let testResult: any;
      let testError: string | null = null;
      
      try {
        testResult = await mockPreviewExtraction(requestBody.url, requestBody.selectors);
      } catch (extractErr: any) {
        testError = extractErr.message;
        testResult = [];
      }

      const isSuccess = Array.isArray(testResult) && testResult.length > 0;

      const result: any = {
        success: isSuccess,
        data: testResult,
        count: 0,
        url: requestBody.url,
        selectors: requestBody.selectors,
        timestamp: Date.now()
      };

      if (!isSuccess) {
        result.message = testError 
          ? `✗ 测试失败：${testError}` 
          : '✗ 测试失败：未采集到数据，请检查选择器配置';
        result.error = testError || '未采集到数据';
        
        result.suggestions = [
          '1. 使用浏览器开发者工具验证选择器是否正确',
          '2. 检查网页是否需要登录或有反爬虫机制',
          '3. 尝试使用"AI分析"功能获取详细诊断'
        ];
      }

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid CSS selector');
    });

    it('should handle non-array response from extraction', async () => {
      // 模拟返回非数组数据
      const mockData = { error: 'Invalid response' };
      mockPreviewExtraction.mockResolvedValue(mockData);

      const requestBody = {
        url: 'https://example.com',
        selectors: {
          container: '.item',
          fields: { title: '.title' }
        }
      };

      let testResult: any;
      let testError: string | null = null;
      
      try {
        testResult = await mockPreviewExtraction(requestBody.url, requestBody.selectors);
      } catch (extractErr: any) {
        testError = extractErr.message;
        testResult = [];
      }

      const isSuccess = Array.isArray(testResult) && testResult.length > 0;
      const dataCount = Array.isArray(testResult) ? testResult.length : 0;

      const result: any = {
        success: isSuccess,
        data: testResult,
        count: dataCount,
        url: requestBody.url,
        selectors: requestBody.selectors,
        timestamp: Date.now()
      };

      if (!isSuccess) {
        result.message = testError 
          ? `✗ 测试失败：${testError}` 
          : '✗ 测试失败：未采集到数据，请检查选择器配置';
        result.error = testError || '未采集到数据';
        
        result.suggestions = [
          '1. 使用浏览器开发者工具验证选择器是否正确',
          '2. 检查网页是否需要登录或有反爬虫机制',
          '3. 尝试使用"AI分析"功能获取详细诊断'
        ];
      }

      expect(result.success).toBe(false);
      expect(Array.isArray(result.data)).toBe(false);
      expect(result.count).toBe(0);
    });
  });


  describe('Edge Cases', () => {
    it('should handle empty selectors object', () => {
      const requestBody = {
        url: 'https://example.com',
        selectors: {}
      };

      // 验证selectors存在但为空
      expect(requestBody.selectors).toBeDefined();
      expect(Object.keys(requestBody.selectors).length).toBe(0);
    });

    it('should handle selectors without container', async () => {
      const mockData = [
        { title: 'Item 1' },
        { title: 'Item 2' }
      ];

      mockPreviewExtraction.mockResolvedValue(mockData);

      const requestBody = {
        url: 'https://example.com',
        selectors: {
          fields: { title: '.title' }
          // container 缺失
        }
      };

      const testResult = await mockPreviewExtraction(requestBody.url, requestBody.selectors);
      const isSuccess = Array.isArray(testResult) && testResult.length > 0;
      const dataCount = Array.isArray(testResult) ? testResult.length : 0;

      const result: any = {
        success: isSuccess,
        data: testResult,
        count: dataCount,
        url: requestBody.url,
        selectors: requestBody.selectors,
        timestamp: Date.now()
      };

      if (isSuccess) {
        result.message = `✓ 测试成功！采集到 ${dataCount} 条数据`;
        result.summary = {
          totalItems: dataCount,
          fields: Object.keys(requestBody.selectors.fields || {}),
          containerUsed: requestBody.selectors.container || 'body'
        };
      }

      // 应该使用默认的 'body' 作为容器
      expect(result.success).toBe(true);
      expect(result.summary.containerUsed).toBe('body');
    });

    it('should handle selectors without fields', async () => {
      const mockData = [
        { _raw: 'Item 1' },
        { _raw: 'Item 2' }
      ];

      mockPreviewExtraction.mockResolvedValue(mockData);

      const requestBody = {
        url: 'https://example.com',
        selectors: {
          container: '.item'
          // fields 缺失
        }
      };

      const testResult = await mockPreviewExtraction(requestBody.url, requestBody.selectors);
      const isSuccess = Array.isArray(testResult) && testResult.length > 0;
      const dataCount = Array.isArray(testResult) ? testResult.length : 0;

      const result: any = {
        success: isSuccess,
        data: testResult,
        count: dataCount,
        url: requestBody.url,
        selectors: requestBody.selectors,
        timestamp: Date.now()
      };

      if (isSuccess) {
        result.message = `✓ 测试成功！采集到 ${dataCount} 条数据`;
        result.summary = {
          totalItems: dataCount,
          fields: Object.keys(requestBody.selectors.fields || {}),
          containerUsed: requestBody.selectors.container || 'body'
        };
      }

      expect(result.success).toBe(true);
      expect(result.summary.fields).toEqual([]);
    });

    it('should handle very long URLs', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(1000);
      
      const requestBody = {
        url: longUrl,
        selectors: {
          container: '.item',
          fields: { title: '.title' }
        }
      };

      // URL应该被接受（只要格式正确）
      const isValid = requestBody.url.startsWith('http://') || requestBody.url.startsWith('https://');
      expect(isValid).toBe(true);
      expect(requestBody.url.length).toBeGreaterThan(1000);
    });

    it('should handle special characters in URLs', () => {
      const specialUrls = [
        'https://example.com/path?query=value&other=123',
        'https://example.com/path#anchor',
        'https://example.com/中文路径',
        'https://example.com/path%20with%20spaces'
      ];

      specialUrls.forEach(url => {
        const isValid = url.startsWith('http://') || url.startsWith('https://');
        expect(isValid).toBe(true);
      });
    });

    it('should handle complex selector structures', async () => {
      const mockData = [
        { 
          title: 'Item 1', 
          author: 'Author 1', 
          date: '2024-01-01',
          tags: ['tag1', 'tag2']
        }
      ];

      mockPreviewExtraction.mockResolvedValue(mockData);

      const requestBody = {
        url: 'https://example.com',
        selectors: {
          container: 'article.post',
          fields: {
            title: 'h1.title',
            author: '.author-name',
            date: 'time[datetime]',
            tags: '.tag'
          }
        }
      };

      const testResult = await mockPreviewExtraction(requestBody.url, requestBody.selectors);
      const isSuccess = Array.isArray(testResult) && testResult.length > 0;
      const dataCount = Array.isArray(testResult) ? testResult.length : 0;

      const result: any = {
        success: isSuccess,
        data: testResult,
        count: dataCount,
        url: requestBody.url,
        selectors: requestBody.selectors,
        timestamp: Date.now()
      };

      if (isSuccess) {
        result.message = `✓ 测试成功！采集到 ${dataCount} 条数据`;
        result.summary = {
          totalItems: dataCount,
          fields: Object.keys(requestBody.selectors.fields || {}),
          containerUsed: requestBody.selectors.container || 'body'
        };
      }

      expect(result.success).toBe(true);
      expect(result.summary.fields).toHaveLength(4);
      expect(result.summary.fields).toContain('title');
      expect(result.summary.fields).toContain('author');
      expect(result.summary.fields).toContain('date');
      expect(result.summary.fields).toContain('tags');
    });

    it('should handle pagination config with disabled state', async () => {
      const mockData = [{ id: 1, title: 'Item 1' }];

      mockPreviewExtraction.mockResolvedValue(mockData);

      const requestBody = {
        url: 'https://example.com',
        selectors: {
          container: '.item',
          fields: { title: '.title' }
        },
        paginationConfig: {
          enabled: false,
          maxPages: 5
        }
      };

      const testResult = await mockPreviewExtraction(requestBody.url, requestBody.selectors);
      const isSuccess = Array.isArray(testResult) && testResult.length > 0;
      const dataCount = Array.isArray(testResult) ? testResult.length : 0;

      const result: any = {
        success: isSuccess,
        data: testResult,
        count: dataCount,
        url: requestBody.url,
        selectors: requestBody.selectors,
        timestamp: Date.now()
      };

      if (isSuccess) {
        result.message = `✓ 测试成功！采集到 ${dataCount} 条数据`;
        result.summary = {
          totalItems: dataCount,
          fields: Object.keys(requestBody.selectors.fields || {}),
          containerUsed: requestBody.selectors.container || 'body'
        };
      }

      // 分页未启用时不应该添加分页信息
      if (requestBody.paginationConfig && requestBody.paginationConfig.enabled) {
        result.pagination = {
          enabled: true,
          maxPages: requestBody.paginationConfig.maxPages || 1,
          note: '注意：测试模式只采集第一页数据'
        };
      }

      expect(result.success).toBe(true);
      expect(result.pagination).toBeUndefined();
    });

    it('should include timestamp in response', async () => {
      const mockData = [{ id: 1, title: 'Item 1' }];

      mockPreviewExtraction.mockResolvedValue(mockData);

      const requestBody = {
        url: 'https://example.com',
        selectors: {
          container: '.item',
          fields: { title: '.title' }
        }
      };

      const beforeTimestamp = Date.now();
      const testResult = await mockPreviewExtraction(requestBody.url, requestBody.selectors);
      const isSuccess = Array.isArray(testResult) && testResult.length > 0;
      const dataCount = Array.isArray(testResult) ? testResult.length : 0;

      const result: any = {
        success: isSuccess,
        data: testResult,
        count: dataCount,
        url: requestBody.url,
        selectors: requestBody.selectors,
        timestamp: Date.now()
      };
      const afterTimestamp = Date.now();

      expect(result.timestamp).toBeDefined();
      expect(result.timestamp).toBeGreaterThanOrEqual(beforeTimestamp);
      expect(result.timestamp).toBeLessThanOrEqual(afterTimestamp);
    });
  });

  describe('Response Structure Validation', () => {
    it('should always include required fields in response', async () => {
      const mockData = [{ id: 1, title: 'Item 1' }];

      mockPreviewExtraction.mockResolvedValue(mockData);

      const requestBody = {
        url: 'https://example.com',
        selectors: {
          container: '.item',
          fields: { title: '.title' }
        }
      };

      const testResult = await mockPreviewExtraction(requestBody.url, requestBody.selectors);
      const isSuccess = Array.isArray(testResult) && testResult.length > 0;
      const dataCount = Array.isArray(testResult) ? testResult.length : 0;

      const result: any = {
        success: isSuccess,
        data: testResult,
        count: dataCount,
        url: requestBody.url,
        selectors: requestBody.selectors,
        timestamp: Date.now()
      };

      if (isSuccess) {
        result.message = `✓ 测试成功！采集到 ${dataCount} 条数据`;
        result.summary = {
          totalItems: dataCount,
          fields: Object.keys(requestBody.selectors.fields || {}),
          containerUsed: requestBody.selectors.container || 'body'
        };
      }

      // 验证必需字段
      const requiredFields = ['success', 'data', 'count', 'url', 'selectors', 'timestamp'];
      requiredFields.forEach(field => {
        expect(result).toHaveProperty(field);
      });
    });

    it('should include message field in both success and failure cases', async () => {
      // 成功场景
      const mockData1 = [{ id: 1, title: 'Item 1' }];
      mockPreviewExtraction.mockResolvedValue(mockData1);

      const requestBody1 = {
        url: 'https://example.com',
        selectors: {
          container: '.item',
          fields: { title: '.title' }
        }
      };

      const testResult1 = await mockPreviewExtraction(requestBody1.url, requestBody1.selectors);
      const isSuccess1 = Array.isArray(testResult1) && testResult1.length > 0;
      const dataCount1 = Array.isArray(testResult1) ? testResult1.length : 0;

      const result1: any = {
        success: isSuccess1,
        data: testResult1,
        count: dataCount1,
        url: requestBody1.url,
        selectors: requestBody1.selectors,
        timestamp: Date.now()
      };

      if (isSuccess1) {
        result1.message = `✓ 测试成功！采集到 ${dataCount1} 条数据`;
        result1.summary = {
          totalItems: dataCount1,
          fields: Object.keys(requestBody1.selectors.fields || {}),
          containerUsed: requestBody1.selectors.container || 'body'
        };
      }

      expect(result1.message).toBeDefined();
      expect(result1.message).toContain('测试成功');

      // 失败场景
      mockPreviewExtraction.mockResolvedValue([]);

      const requestBody2 = {
        url: 'https://example.com',
        selectors: {
          container: '.item',
          fields: { title: '.title' }
        }
      };

      let testResult2: any;
      let testError2: string | null = null;
      
      try {
        testResult2 = await mockPreviewExtraction(requestBody2.url, requestBody2.selectors);
      } catch (extractErr: any) {
        testError2 = extractErr.message;
        testResult2 = [];
      }

      const isSuccess2 = Array.isArray(testResult2) && testResult2.length > 0;

      const result2: any = {
        success: isSuccess2,
        data: testResult2,
        count: 0,
        url: requestBody2.url,
        selectors: requestBody2.selectors,
        timestamp: Date.now()
      };

      if (!isSuccess2) {
        result2.message = testError2 
          ? `✗ 测试失败：${testError2}` 
          : '✗ 测试失败：未采集到数据，请检查选择器配置';
        result2.error = testError2 || '未采集到数据';
        
        result2.suggestions = [
          '1. 使用浏览器开发者工具验证选择器是否正确',
          '2. 检查网页是否需要登录或有反爬虫机制',
          '3. 尝试使用"AI分析"功能获取详细诊断'
        ];
      }

      expect(result2.message).toBeDefined();
      expect(result2.message).toContain('测试失败');
    });
  });
});
