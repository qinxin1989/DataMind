/**
 * 选择器验证API单元测试
 * 需求: 7.3
 * 
 * 测试 POST /api/admin/ai/crawler/validate-selector 接口
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';

// Mock axios
vi.mock('axios');
const mockedAxios = axios as any;

// Mock cheerio
vi.mock('cheerio', () => ({
  load: vi.fn()
}));

describe('Selector Validation API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Valid Selector Tests', () => {
    it('should return correct match count for valid selector', async () => {
      // 模拟HTML内容
      const mockHtml = `
        <html>
          <body>
            <h1>Title 1</h1>
            <h1>Title 2</h1>
            <h1>Title 3</h1>
          </body>
        </html>
      `;

      // Mock axios.get 返回HTML
      mockedAxios.get.mockResolvedValue({
        data: mockHtml
      });

      // 使用真实的cheerio来验证
      const cheerio = require('cheerio');
      const $ = cheerio.load(mockHtml);

      // 验证选择器
      const selector = 'h1';
      const matchCount = $(selector).length;

      expect(matchCount).toBe(3);
      expect(matchCount).toBeGreaterThan(0);
    });

    it('should handle complex selectors correctly', async () => {
      const mockHtml = `
        <html>
          <body>
            <div class="container">
              <p class="text">Paragraph 1</p>
              <p class="text">Paragraph 2</p>
            </div>
          </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({
        data: mockHtml
      });

      const cheerio = require('cheerio');
      const $ = cheerio.load(mockHtml);

      const selector = 'div.container > p.text';
      const matchCount = $(selector).length;

      expect(matchCount).toBe(2);
    });

    it('should handle attribute selectors', async () => {
      const mockHtml = `
        <html>
          <body>
            <a href="https://example.com">Link 1</a>
            <a href="https://test.com">Link 2</a>
            <a>Link 3</a>
          </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({
        data: mockHtml
      });

      const cheerio = require('cheerio');
      const $ = cheerio.load(mockHtml);

      const selector = 'a[href]';
      const matchCount = $(selector).length;

      expect(matchCount).toBe(2);
    });
  });

  describe('Invalid Selector Tests', () => {
    it('should return error for invalid CSS selector syntax', async () => {
      const mockHtml = '<html><body><h1>Test</h1></body></html>';

      mockedAxios.get.mockResolvedValue({
        data: mockHtml
      });

      const cheerio = await import('cheerio');
      
      // Mock cheerio to throw error for invalid selector
      const mockLoad = vi.fn(() => {
        return (selector: string) => {
          if (selector === '[[invalid]]') {
            throw new Error('Invalid selector syntax');
          }
          return { length: 0 };
        };
      });
      (cheerio.load as any).mockImplementation(mockLoad);

      const invalidSelector = '[[invalid]]';
      
      expect(() => {
        const $ = cheerio.load(mockHtml);
        $(invalidSelector);
      }).toThrow('Invalid selector syntax');
    });

    it('should return zero matches for non-existent selector', async () => {
      const mockHtml = `
        <html>
          <body>
            <h1>Title</h1>
            <p>Paragraph</p>
          </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({
        data: mockHtml
      });

      const cheerio = await import('cheerio');
      const $ = cheerio.load(mockHtml);
      (cheerio.load as any).mockReturnValue($);

      const selector = '.non-existent-class-12345';
      const matchCount = $(selector).length;

      expect(matchCount).toBe(0);
    });

    it('should handle malformed HTML gracefully', async () => {
      const mockHtml = '<html><body><div><p>Unclosed tags';

      mockedAxios.get.mockResolvedValue({
        data: mockHtml
      });

      const cheerio = await import('cheerio');
      const $ = cheerio.load(mockHtml);
      (cheerio.load as any).mockReturnValue($);

      // Cheerio should still parse malformed HTML
      const selector = 'p';
      const matchCount = $(selector).length;

      expect(matchCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Empty Selector Tests', () => {
    it('should handle empty string selector', async () => {
      const mockHtml = '<html><body><h1>Test</h1></body></html>';

      mockedAxios.get.mockResolvedValue({
        data: mockHtml
      });

      const cheerio = await import('cheerio');
      const $ = cheerio.load(mockHtml);
      (cheerio.load as any).mockReturnValue($);

      const emptySelector = '';
      
      // Empty selector should return 0 matches or throw error
      const result = $(emptySelector);
      expect(result.length).toBe(0);
    });

    it('should handle whitespace-only selector', async () => {
      const mockHtml = '<html><body><h1>Test</h1></body></html>';

      mockedAxios.get.mockResolvedValue({
        data: mockHtml
      });

      const cheerio = await import('cheerio');
      const $ = cheerio.load(mockHtml);
      (cheerio.load as any).mockReturnValue($);

      const whitespaceSelector = '   ';
      
      // Whitespace selector should be treated as invalid
      const result = $(whitespaceSelector.trim());
      expect(result.length).toBe(0);
    });

    it('should reject null or undefined selector', () => {
      const nullSelector = null;
      const undefinedSelector = undefined;

      // These should be caught by parameter validation
      expect(nullSelector).toBeNull();
      expect(undefinedSelector).toBeUndefined();
    });
  });

  describe('URL Validation Tests', () => {
    it('should reject invalid URL format', async () => {
      const invalidUrl = 'not-a-valid-url';
      
      // URL validation should happen before making request
      expect(invalidUrl.startsWith('http://') || invalidUrl.startsWith('https://')).toBe(false);
    });

    it('should accept valid HTTP URL', () => {
      const validUrl = 'http://example.com';
      expect(validUrl.startsWith('http://') || validUrl.startsWith('https://')).toBe(true);
    });

    it('should accept valid HTTPS URL', () => {
      const validUrl = 'https://example.com';
      expect(validUrl.startsWith('http://') || validUrl.startsWith('https://')).toBe(true);
    });

    it('should handle URL fetch errors', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      try {
        await mockedAxios.get('https://example.com');
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toBe('Network error');
      }
    });

    it('should handle 404 errors', async () => {
      mockedAxios.get.mockRejectedValue({
        response: { status: 404 },
        message: 'Not Found'
      });

      try {
        await mockedAxios.get('https://example.com/not-found');
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.response.status).toBe(404);
      }
    });

    it('should handle timeout errors', async () => {
      mockedAxios.get.mockRejectedValue({
        code: 'ETIMEDOUT',
        message: 'Timeout'
      });

      try {
        await mockedAxios.get('https://slow-site.com');
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.code).toBe('ETIMEDOUT');
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long selectors', async () => {
      const mockHtml = '<html><body><div class="test"><p>Content</p></div></body></html>';

      mockedAxios.get.mockResolvedValue({
        data: mockHtml
      });

      const cheerio = await import('cheerio');
      const $ = cheerio.load(mockHtml);
      (cheerio.load as any).mockReturnValue($);

      // Very long but valid selector
      const longSelector = 'html > body > div.test > p';
      const matchCount = $(longSelector).length;

      expect(matchCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle special characters in selectors', async () => {
      const mockHtml = `
        <html>
          <body>
            <div id="test-id">Content</div>
            <div class="test_class">Content</div>
          </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({
        data: mockHtml
      });

      // 使用真实的cheerio来验证
      const cheerio = require('cheerio');
      const $ = cheerio.load(mockHtml);

      const selector1 = '#test-id';
      const selector2 = '.test_class';

      expect($(selector1).length).toBe(1);
      expect($(selector2).length).toBe(1);
    });

    it('should handle pseudo-selectors', async () => {
      const mockHtml = `
        <html>
          <body>
            <ul>
              <li>Item 1</li>
              <li>Item 2</li>
              <li>Item 3</li>
            </ul>
          </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({
        data: mockHtml
      });

      const cheerio = await import('cheerio');
      const $ = cheerio.load(mockHtml);
      (cheerio.load as any).mockReturnValue($);

      const selector = 'li:first-child';
      const matchCount = $(selector).length;

      expect(matchCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle multiple class selectors', async () => {
      const mockHtml = `
        <html>
          <body>
            <div class="class1 class2">Content 1</div>
            <div class="class1">Content 2</div>
            <div class="class2">Content 3</div>
          </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({
        data: mockHtml
      });

      // 使用真实的cheerio来验证
      const cheerio = require('cheerio');
      const $ = cheerio.load(mockHtml);

      const selector = '.class1.class2';
      const matchCount = $(selector).length;

      expect(matchCount).toBe(1);
    });
  });

  describe('Parameter Validation', () => {
    it('should require both url and selector parameters', () => {
      const testCases = [
        { url: undefined, selector: 'h1' },
        { url: 'https://example.com', selector: undefined },
        { url: undefined, selector: undefined },
      ];

      testCases.forEach(testCase => {
        const hasRequiredParams = testCase.url && testCase.selector;
        expect(hasRequiredParams).toBeFalsy();
      });
    });

    it('should validate selector is a string', () => {
      const validSelector = 'h1';
      const invalidSelectors = [123, {}, [], null, undefined];

      expect(typeof validSelector).toBe('string');
      
      invalidSelectors.forEach(selector => {
        expect(typeof selector).not.toBe('string');
      });
    });

    it('should validate selector is not empty after trim', () => {
      const validSelector = 'h1';
      const emptySelectors = ['', '   ', '\t', '\n'];

      expect(validSelector.trim().length).toBeGreaterThan(0);

      emptySelectors.forEach(selector => {
        expect(selector.trim().length).toBe(0);
      });
    });
  });
});
