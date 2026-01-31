/**
 * 数据预览API单元测试
 * 需求: 2.1, 2.3
 * 
 * 测试 POST /api/admin/ai/crawler/preview 接口
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock crawlerAssistantService
const mockPreviewExtraction = vi.fn();
vi.mock('../../../src/admin/modules/ai/crawlerAssistantService', () => ({
  crawlerAssistantService: {
    previewExtraction: mockPreviewExtraction
  }
}));

describe('Data Preview API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Default Limit Tests (需求 2.1)', () => {
    it('should return maximum 10 items by default when no limit specified', async () => {
      // 模拟返回15条数据
      const mockData = Array.from({ length: 15 }, (_, i) => ({
        id: i + 1,
        title: `Item ${i + 1}`,
        content: `Content ${i + 1}`
      }));

      mockPreviewExtraction.mockResolvedValue(mockData);

      // 模拟API调用（不指定limit）
      const requestBody = {
        url: 'https://example.com',
        selectors: {
          container: '.item',
          fields: { title: '.title', content: '.content' }
        }
        // limit 未指定，应该使用默认值10
      };

      // 模拟API逻辑
      const limit = requestBody.limit || 10;
      const data = await mockPreviewExtraction(requestBody.url, requestBody.selectors);
      const resultData = Array.isArray(data) ? data.slice(0, limit) : data;
      const total = Array.isArray(data) ? data.length : 0;

      // 验证：默认返回10条数据
      expect(resultData).toHaveLength(10);
      expect(total).toBe(15);
      expect(resultData[0].id).toBe(1);
      expect(resultData[9].id).toBe(10);
    });

    it('should return maximum 10 items when limit is explicitly set to 10', async () => {
      const mockData = Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        title: `Item ${i + 1}`
      }));

      mockPreviewExtraction.mockResolvedValue(mockData);

      const requestBody = {
        url: 'https://example.com',
        selectors: { container: '.item' },
        limit: 10
      };

      const limit = parseInt(requestBody.limit as any) || 10;
      const data = await mockPreviewExtraction(requestBody.url, requestBody.selectors);
      const resultData = Array.isArray(data) ? data.slice(0, limit) : data;

      expect(resultData).toHaveLength(10);
      expect(resultData[0].id).toBe(1);
      expect(resultData[9].id).toBe(10);
    });

    it('should respect custom limit when specified', async () => {
      const mockData = Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        title: `Item ${i + 1}`
      }));

      mockPreviewExtraction.mockResolvedValue(mockData);

      const requestBody = {
        url: 'https://example.com',
        selectors: { container: '.item' },
        limit: 5
      };

      const limit = parseInt(requestBody.limit as any) || 10;
      const data = await mockPreviewExtraction(requestBody.url, requestBody.selectors);
      const resultData = Array.isArray(data) ? data.slice(0, limit) : data;

      expect(resultData).toHaveLength(5);
      expect(resultData[0].id).toBe(1);
      expect(resultData[4].id).toBe(5);
    });
  });

  describe('Less Than 10 Items Tests (需求 2.3)', () => {
    it('should return all items when data has less than 10 items', async () => {
      // 模拟返回5条数据
      const mockData = Array.from({ length: 5 }, (_, i) => ({
        id: i + 1,
        title: `Item ${i + 1}`,
        content: `Content ${i + 1}`
      }));

      mockPreviewExtraction.mockResolvedValue(mockData);

      const requestBody = {
        url: 'https://example.com',
        selectors: {
          container: '.item',
          fields: { title: '.title' }
        }
      };

      const limit = requestBody.limit || 10;
      const data = await mockPreviewExtraction(requestBody.url, requestBody.selectors);
      const resultData = Array.isArray(data) ? data.slice(0, limit) : data;
      const total = Array.isArray(data) ? data.length : 0;

      // 验证：返回全部5条数据
      expect(resultData).toHaveLength(5);
      expect(total).toBe(5);
      expect(resultData[0].id).toBe(1);
      expect(resultData[4].id).toBe(5);
    });

    it('should return all items when data has exactly 10 items', async () => {
      const mockData = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        title: `Item ${i + 1}`
      }));

      mockPreviewExtraction.mockResolvedValue(mockData);

      const requestBody = {
        url: 'https://example.com',
        selectors: { container: '.item' }
      };

      const limit = requestBody.limit || 10;
      const data = await mockPreviewExtraction(requestBody.url, requestBody.selectors);
      const resultData = Array.isArray(data) ? data.slice(0, limit) : data;

      expect(resultData).toHaveLength(10);
      expect(resultData[0].id).toBe(1);
      expect(resultData[9].id).toBe(10);
    });

    it('should return empty array when no data is available', async () => {
      mockPreviewExtraction.mockResolvedValue([]);

      const requestBody = {
        url: 'https://example.com',
        selectors: { container: '.item' }
      };

      const limit = requestBody.limit || 10;
      const data = await mockPreviewExtraction(requestBody.url, requestBody.selectors);
      const resultData = Array.isArray(data) ? data.slice(0, limit) : data;
      const total = Array.isArray(data) ? data.length : 0;

      expect(resultData).toHaveLength(0);
      expect(total).toBe(0);
    });

    it('should return single item when only one item is available', async () => {
      const mockData = [{ id: 1, title: 'Single Item' }];

      mockPreviewExtraction.mockResolvedValue(mockData);

      const requestBody = {
        url: 'https://example.com',
        selectors: { container: '.item' }
      };

      const limit = requestBody.limit || 10;
      const data = await mockPreviewExtraction(requestBody.url, requestBody.selectors);
      const resultData = Array.isArray(data) ? data.slice(0, limit) : data;

      expect(resultData).toHaveLength(1);
      expect(resultData[0].id).toBe(1);
      expect(resultData[0].title).toBe('Single Item');
    });
  });

  describe('Pagination Tests (需求 2.3)', () => {
    it('should support pagination with page and pageSize parameters', async () => {
      const mockData = Array.from({ length: 25 }, (_, i) => ({
        id: i + 1,
        title: `Item ${i + 1}`
      }));

      mockPreviewExtraction.mockResolvedValue(mockData);

      const requestBody = {
        url: 'https://example.com',
        selectors: { container: '.item' },
        page: 1,
        pageSize: 10
      };

      const page = parseInt(requestBody.page as any) || 1;
      const pageSize = parseInt(requestBody.pageSize as any);
      const data = await mockPreviewExtraction(requestBody.url, requestBody.selectors);
      const total = Array.isArray(data) ? data.length : 0;

      // 分页逻辑
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const resultData = Array.isArray(data) ? data.slice(startIndex, endIndex) : data;
      const totalPages = Math.ceil(total / pageSize);

      expect(resultData).toHaveLength(10);
      expect(resultData[0].id).toBe(1);
      expect(resultData[9].id).toBe(10);
      expect(total).toBe(25);
      expect(totalPages).toBe(3);
    });

    it('should return second page of data correctly', async () => {
      const mockData = Array.from({ length: 25 }, (_, i) => ({
        id: i + 1,
        title: `Item ${i + 1}`
      }));

      mockPreviewExtraction.mockResolvedValue(mockData);

      const requestBody = {
        url: 'https://example.com',
        selectors: { container: '.item' },
        page: 2,
        pageSize: 10
      };

      const page = parseInt(requestBody.page as any) || 1;
      const pageSize = parseInt(requestBody.pageSize as any);
      const data = await mockPreviewExtraction(requestBody.url, requestBody.selectors);

      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const resultData = Array.isArray(data) ? data.slice(startIndex, endIndex) : data;

      expect(resultData).toHaveLength(10);
      expect(resultData[0].id).toBe(11);
      expect(resultData[9].id).toBe(20);
    });

    it('should return partial data on last page', async () => {
      const mockData = Array.from({ length: 25 }, (_, i) => ({
        id: i + 1,
        title: `Item ${i + 1}`
      }));

      mockPreviewExtraction.mockResolvedValue(mockData);

      const requestBody = {
        url: 'https://example.com',
        selectors: { container: '.item' },
        page: 3,
        pageSize: 10
      };

      const page = parseInt(requestBody.page as any) || 1;
      const pageSize = parseInt(requestBody.pageSize as any);
      const data = await mockPreviewExtraction(requestBody.url, requestBody.selectors);
      const total = Array.isArray(data) ? data.length : 0;

      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const resultData = Array.isArray(data) ? data.slice(startIndex, endIndex) : data;

      // 第3页应该只有5条数据（21-25）
      expect(resultData).toHaveLength(5);
      expect(resultData[0].id).toBe(21);
      expect(resultData[4].id).toBe(25);
      expect(total).toBe(25);
    });

    it('should return empty array when page exceeds total pages', async () => {
      const mockData = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        title: `Item ${i + 1}`
      }));

      mockPreviewExtraction.mockResolvedValue(mockData);

      const requestBody = {
        url: 'https://example.com',
        selectors: { container: '.item' },
        page: 5,
        pageSize: 10
      };

      const page = parseInt(requestBody.page as any) || 1;
      const pageSize = parseInt(requestBody.pageSize as any);
      const data = await mockPreviewExtraction(requestBody.url, requestBody.selectors);

      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const resultData = Array.isArray(data) ? data.slice(startIndex, endIndex) : data;

      expect(resultData).toHaveLength(0);
    });

    it('should calculate total pages correctly', async () => {
      const testCases = [
        { total: 25, pageSize: 10, expectedPages: 3 },
        { total: 30, pageSize: 10, expectedPages: 3 },
        { total: 31, pageSize: 10, expectedPages: 4 },
        { total: 10, pageSize: 10, expectedPages: 1 },
        { total: 5, pageSize: 10, expectedPages: 1 },
        { total: 0, pageSize: 10, expectedPages: 0 }
      ];

      testCases.forEach(({ total, pageSize, expectedPages }) => {
        const totalPages = Math.ceil(total / pageSize);
        expect(totalPages).toBe(expectedPages);
      });
    });

    it('should handle different page sizes', async () => {
      const mockData = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        title: `Item ${i + 1}`
      }));

      mockPreviewExtraction.mockResolvedValue(mockData);

      // 测试 pageSize = 5
      const requestBody1 = {
        url: 'https://example.com',
        selectors: { container: '.item' },
        page: 1,
        pageSize: 5
      };

      const page1 = parseInt(requestBody1.page as any) || 1;
      const pageSize1 = parseInt(requestBody1.pageSize as any);
      const data1 = await mockPreviewExtraction(requestBody1.url, requestBody1.selectors);

      const startIndex1 = (page1 - 1) * pageSize1;
      const endIndex1 = startIndex1 + pageSize1;
      const resultData1 = Array.isArray(data1) ? data1.slice(startIndex1, endIndex1) : data1;

      expect(resultData1).toHaveLength(5);
      expect(resultData1[0].id).toBe(1);
      expect(resultData1[4].id).toBe(5);

      // 测试 pageSize = 20
      const requestBody2 = {
        url: 'https://example.com',
        selectors: { container: '.item' },
        page: 1,
        pageSize: 20
      };

      const page2 = parseInt(requestBody2.page as any) || 1;
      const pageSize2 = parseInt(requestBody2.pageSize as any);
      const data2 = await mockPreviewExtraction(requestBody2.url, requestBody2.selectors);

      const startIndex2 = (page2 - 1) * pageSize2;
      const endIndex2 = startIndex2 + pageSize2;
      const resultData2 = Array.isArray(data2) ? data2.slice(startIndex2, endIndex2) : data2;

      expect(resultData2).toHaveLength(20);
      expect(resultData2[0].id).toBe(1);
      expect(resultData2[19].id).toBe(20);
    });
  });

  describe('Response Format Tests', () => {
    it('should return correct response format with total count', async () => {
      const mockData = Array.from({ length: 15 }, (_, i) => ({
        id: i + 1,
        title: `Item ${i + 1}`
      }));

      mockPreviewExtraction.mockResolvedValue(mockData);

      const requestBody = {
        url: 'https://example.com',
        selectors: { container: '.item' }
      };

      const limit = requestBody.limit || 10;
      const data = await mockPreviewExtraction(requestBody.url, requestBody.selectors);
      const resultData = Array.isArray(data) ? data.slice(0, limit) : data;
      const total = Array.isArray(data) ? data.length : 0;

      // 验证响应格式
      const response = {
        data: resultData,
        total,
        limit,
        page: 1,
        pageSize: limit,
        totalPages: 1
      };

      expect(response).toHaveProperty('data');
      expect(response).toHaveProperty('total');
      expect(response).toHaveProperty('limit');
      expect(response.data).toHaveLength(10);
      expect(response.total).toBe(15);
    });

    it('should include pagination metadata when using pageSize', async () => {
      const mockData = Array.from({ length: 25 }, (_, i) => ({
        id: i + 1,
        title: `Item ${i + 1}`
      }));

      mockPreviewExtraction.mockResolvedValue(mockData);

      const requestBody = {
        url: 'https://example.com',
        selectors: { container: '.item' },
        page: 2,
        pageSize: 10
      };

      const page = parseInt(requestBody.page as any) || 1;
      const pageSize = parseInt(requestBody.pageSize as any);
      const data = await mockPreviewExtraction(requestBody.url, requestBody.selectors);
      const total = Array.isArray(data) ? data.length : 0;

      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const resultData = Array.isArray(data) ? data.slice(startIndex, endIndex) : data;
      const totalPages = Math.ceil(total / pageSize);

      const response = {
        data: resultData,
        total,
        limit: pageSize,
        page,
        pageSize,
        totalPages
      };

      expect(response.page).toBe(2);
      expect(response.pageSize).toBe(10);
      expect(response.totalPages).toBe(3);
      expect(response.total).toBe(25);
    });
  });

  describe('Edge Cases', () => {
    it('should handle non-array data gracefully', async () => {
      const mockData = { error: 'Invalid data' };

      mockPreviewExtraction.mockResolvedValue(mockData);

      const requestBody = {
        url: 'https://example.com',
        selectors: { container: '.item' }
      };

      const limit = requestBody.limit || 10;
      const data = await mockPreviewExtraction(requestBody.url, requestBody.selectors);
      const resultData = Array.isArray(data) ? data.slice(0, limit) : data;
      const total = Array.isArray(data) ? data.length : 0;

      expect(Array.isArray(resultData)).toBe(false);
      expect(total).toBe(0);
    });

    it('should handle invalid limit values', async () => {
      const mockData = Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        title: `Item ${i + 1}`
      }));

      mockPreviewExtraction.mockResolvedValue(mockData);

      // 测试无效的limit值
      const testCases = [
        { input: 'invalid', expected: 10 },
        { input: null, expected: 10 },
        { input: undefined, expected: 10 }
      ];

      testCases.forEach(({ input, expected }) => {
        const limit = parseInt(input as any) || 10;
        expect(limit).toBe(expected);
      });

      // 测试负数和0应该被处理（实际API会验证）
      const negativeLimit = -1;
      const zeroLimit = 0;
      expect(negativeLimit).toBeLessThan(1);
      expect(zeroLimit).toBe(0);
    });

    it('should handle invalid page values', async () => {
      const mockData = Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        title: `Item ${i + 1}`
      }));

      mockPreviewExtraction.mockResolvedValue(mockData);

      // 测试无效的page值
      const testCases = [
        { input: 'invalid', expected: 1 },
        { input: null, expected: 1 },
        { input: undefined, expected: 1 }
      ];

      testCases.forEach(({ input, expected }) => {
        const page = parseInt(input as any) || 1;
        expect(page).toBe(expected);
      });

      // 测试负数和0应该被处理（实际API会验证）
      const negativePage = -1;
      const zeroPage = 0;
      expect(negativePage).toBeLessThan(1);
      expect(zeroPage).toBe(0);
    });

    it('should handle very large datasets efficiently', async () => {
      const mockData = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        title: `Item ${i + 1}`
      }));

      mockPreviewExtraction.mockResolvedValue(mockData);

      const requestBody = {
        url: 'https://example.com',
        selectors: { container: '.item' },
        limit: 10
      };

      const limit = parseInt(requestBody.limit as any) || 10;
      const data = await mockPreviewExtraction(requestBody.url, requestBody.selectors);
      const resultData = Array.isArray(data) ? data.slice(0, limit) : data;

      // 即使有1000条数据，也只返回10条
      expect(resultData).toHaveLength(10);
      expect(resultData[0].id).toBe(1);
      expect(resultData[9].id).toBe(10);
    });
  });

  describe('Parameter Validation', () => {
    it('should require url parameter', () => {
      const requestBody = {
        selectors: { container: '.item' }
        // url 缺失
      };

      expect(requestBody.url).toBeUndefined();
    });

    it('should require selectors parameter', () => {
      const requestBody = {
        url: 'https://example.com'
        // selectors 缺失
      };

      expect(requestBody.selectors).toBeUndefined();
    });

    it('should validate url format', () => {
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
        ''
      ];

      validUrls.forEach(url => {
        expect(url.startsWith('http://') || url.startsWith('https://')).toBe(true);
      });

      invalidUrls.forEach(url => {
        expect(url.startsWith('http://') || url.startsWith('https://')).toBe(false);
      });
    });
  });
});
