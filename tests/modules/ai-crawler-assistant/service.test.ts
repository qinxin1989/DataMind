/**
 * AI爬虫助手服务测试
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { pool } from '../../../src/admin/core/database';
import { CrawlerAssistantService } from '../../../modules/ai-crawler-assistant/backend/service';
import { AIConfigService } from '../../../modules/ai-config/backend/service';

describe('AI爬虫助手服务', () => {
  let service: CrawlerAssistantService;
  let aiConfigService: AIConfigService;
  const testUserId = 'test-user-crawler-assistant';

  beforeAll(async () => {
    service = new CrawlerAssistantService();
    aiConfigService = new AIConfigService(pool);
    
    // 临时禁用外键检查
    await pool.execute('SET FOREIGN_KEY_CHECKS = 0');
  });

  beforeEach(async () => {
    // 清理测试数据
    await service.clearAll();
    await aiConfigService.clearAll();
  });

  afterAll(async () => {
    // 清理测试数据
    await service.clearAll();
    await aiConfigService.clearAll();
    
    // 恢复外键检查
    await pool.execute('SET FOREIGN_KEY_CHECKS = 1');
  });

  // ==================== URL提取测试 ====================

  describe('URL提取', () => {
    it('应该能提取单个URL', async () => {
      const service = new CrawlerAssistantService();
      const text = '请分析这个网页 https://example.com/news';
      const urls = (service as any).extractUrls(text);
      
      expect(urls).toHaveLength(1);
      expect(urls[0]).toBe('https://example.com/news');
    });

    it('应该能提取多个URL', async () => {
      const service = new CrawlerAssistantService();
      const text = '分析 https://example.com/news 和 http://test.com/data';
      const urls = (service as any).extractUrls(text);
      
      expect(urls).toHaveLength(2);
      expect(urls).toContain('https://example.com/news');
      expect(urls).toContain('http://test.com/data');
    });

    it('应该能去重URL', async () => {
      const service = new CrawlerAssistantService();
      const text = 'https://example.com https://example.com';
      const urls = (service as any).extractUrls(text);
      
      expect(urls).toHaveLength(1);
    });

    it('没有URL时应该返回空数组', async () => {
      const service = new CrawlerAssistantService();
      const text = '这是一段没有URL的文本';
      const urls = (service as any).extractUrls(text);
      
      expect(urls).toHaveLength(0);
    });
  });

  // ==================== HTML清理测试 ====================

  describe('HTML清理', () => {
    it('应该移除script标签', () => {
      const service = new CrawlerAssistantService();
      const html = '<div>content</div><script>alert("test")</script>';
      const cleaned = (service as any).cleanHtml(html);
      
      expect(cleaned).not.toContain('<script>');
      expect(cleaned).toContain('<div>');
    });

    it('应该移除style标签', () => {
      const service = new CrawlerAssistantService();
      const html = '<div>content</div><style>.test{color:red}</style>';
      const cleaned = (service as any).cleanHtml(html);
      
      expect(cleaned).not.toContain('<style>');
      expect(cleaned).toContain('<div>');
    });

    it('应该移除HTML注释', () => {
      const service = new CrawlerAssistantService();
      const html = '<div>content</div><!-- comment -->';
      const cleaned = (service as any).cleanHtml(html);
      
      expect(cleaned).not.toContain('<!--');
      expect(cleaned).toContain('<div>');
    });

    it('应该保留id和class属性', () => {
      const service = new CrawlerAssistantService();
      const html = '<div id="test" class="container" data-value="123">content</div>';
      const cleaned = (service as any).cleanHtml(html);
      
      expect(cleaned).toContain('id="test"');
      expect(cleaned).toContain('class="container"');
      expect(cleaned).not.toContain('data-value');
    });

    it('应该截断过长的HTML', () => {
      const service = new CrawlerAssistantService();
      const html = 'a'.repeat(50000);
      const cleaned = (service as any).cleanHtml(html);
      
      expect(cleaned.length).toBeLessThanOrEqual(40000);
    });
  });

  // ==================== 模板管理测试 ====================

  describe('模板管理', () => {
    it('应该能保存模板', async () => {
      const templateId = await service.saveTemplate({
        name: '测试模板',
        description: '测试描述',
        url: 'https://example.com',
        department: '测试部门',
        selectors: {
          container: 'tr',
          fields: {
            '标题': 'td:nth-child(1)',
            '链接': 'td:nth-child(2) a::attr(href)'
          }
        },
        userId: testUserId
      });

      expect(templateId).toBeTruthy();
      expect(typeof templateId).toBe('string');
    });

    it('应该能获取用户模板列表', async () => {
      // 创建2个模板
      await service.saveTemplate({
        name: '模板1',
        url: 'https://example.com/1',
        selectors: { fields: { '标题': 'h1' } },
        userId: testUserId
      });

      await service.saveTemplate({
        name: '模板2',
        url: 'https://example.com/2',
        selectors: { fields: { '标题': 'h2' } },
        userId: testUserId
      });

      const templates = await service.getUserTemplates(testUserId);
      expect(templates).toHaveLength(2);
      expect(templates[0].name).toBeTruthy();
      expect(templates[0].fields).toBeTruthy();
    });

    it('应该能获取单个模板', async () => {
      const templateId = await service.saveTemplate({
        name: '单个模板',
        url: 'https://example.com',
        selectors: {
          container: 'div',
          fields: { '标题': 'h1' }
        },
        userId: testUserId
      });

      const template = await service.getTemplateById(templateId, testUserId);
      expect(template).toBeTruthy();
      expect(template?.name).toBe('单个模板');
      expect(template?.containerSelector).toBe('div');
      expect(template?.fields).toHaveLength(1);
    });

    it('获取不存在的模板应该返回null', async () => {
      const template = await service.getTemplateById('non-existent-id', testUserId);
      expect(template).toBeNull();
    });

    it('应该能更新模板', async () => {
      const templateId = await service.saveTemplate({
        name: '原始名称',
        url: 'https://example.com',
        selectors: { fields: { '标题': 'h1' } },
        userId: testUserId
      });

      await service.updateTemplate(templateId, testUserId, {
        name: '更新后名称',
        selectors: {
          container: 'ul',
          fields: { '标题': 'li' }
        }
      });

      const template = await service.getTemplateById(templateId, testUserId);
      expect(template?.name).toBe('更新后名称');
      expect(template?.containerSelector).toBe('ul');
    });

    it('应该能删除模板', async () => {
      const templateId = await service.saveTemplate({
        name: '待删除模板',
        url: 'https://example.com',
        selectors: { fields: { '标题': 'h1' } },
        userId: testUserId
      });

      await service.deleteTemplate(templateId, testUserId);

      const template = await service.getTemplateById(templateId, testUserId);
      expect(template).toBeNull();
    });

    it('删除不存在的模板应该抛出错误', async () => {
      await expect(
        service.deleteTemplate('non-existent-id', testUserId)
      ).rejects.toThrow('模板不存在');
    });

    it('不同用户的模板应该隔离', async () => {
      const user1Id = 'user1';
      const user2Id = 'user2';

      const templateId = await service.saveTemplate({
        name: '用户1的模板',
        url: 'https://example.com',
        selectors: { fields: { '标题': 'h1' } },
        userId: user1Id
      });

      // 用户2不应该能访问用户1的模板
      const template = await service.getTemplateById(templateId, user2Id);
      expect(template).toBeNull();
    });
  });

  // ==================== 权限控制测试 ====================

  describe('权限控制', () => {
    it('更新其他用户的模板应该抛出错误', async () => {
      const user1Id = 'user1';
      const user2Id = 'user2';

      const templateId = await service.saveTemplate({
        name: '用户1的模板',
        url: 'https://example.com',
        selectors: { fields: { '标题': 'h1' } },
        userId: user1Id
      });

      await expect(
        service.updateTemplate(templateId, user2Id, { name: '尝试更新' })
      ).rejects.toThrow('无权更新此模板');
    });

    it('删除其他用户的模板应该抛出错误', async () => {
      const user1Id = 'user1';
      const user2Id = 'user2';

      const templateId = await service.saveTemplate({
        name: '用户1的模板',
        url: 'https://example.com',
        selectors: { fields: { '标题': 'h1' } },
        userId: user1Id
      });

      await expect(
        service.deleteTemplate(templateId, user2Id)
      ).rejects.toThrow('无权删除此模板');
    });
  });

  // ==================== 边界情况测试 ====================

  describe('边界情况', () => {
    it('保存模板时缺少必要字段应该正常处理', async () => {
      const templateId = await service.saveTemplate({
        name: '最小模板',
        url: 'https://example.com',
        selectors: { fields: {} },
        userId: testUserId
      });

      expect(templateId).toBeTruthy();

      const template = await service.getTemplateById(templateId, testUserId);
      expect(template?.fields).toHaveLength(0);
    });

    it('模板名称可以包含特殊字符', async () => {
      const templateId = await service.saveTemplate({
        name: '测试<>模板"\'&',
        url: 'https://example.com',
        selectors: { fields: { '标题': 'h1' } },
        userId: testUserId
      });

      const template = await service.getTemplateById(templateId, testUserId);
      expect(template?.name).toBe('测试<>模板"\'&');
    });

    it('选择器可以包含复杂的CSS语法', async () => {
      const templateId = await service.saveTemplate({
        name: '复杂选择器',
        url: 'https://example.com',
        selectors: {
          container: 'div.container > ul:first-child',
          fields: {
            '标题': 'li:nth-child(2n+1) > a[href^="http"]::text',
            '链接': 'a::attr(href)'
          }
        },
        userId: testUserId
      });

      const template = await service.getTemplateById(templateId, testUserId);
      expect(template?.containerSelector).toBe('div.container > ul:first-child');
    });

    it('空用户ID应该使用默认值', async () => {
      const templateId = await service.saveTemplate({
        name: '默认用户模板',
        url: 'https://example.com',
        selectors: { fields: { '标题': 'h1' } }
      });

      const template = await service.getTemplateById(templateId, 'admin');
      expect(template).toBeTruthy();
    });
  });

  // ==================== 数据完整性测试 ====================

  describe('数据完整性', () => {
    it('删除模板应该同时删除关联的字段', async () => {
      const templateId = await service.saveTemplate({
        name: '带字段的模板',
        url: 'https://example.com',
        selectors: {
          fields: {
            '字段1': 'selector1',
            '字段2': 'selector2',
            '字段3': 'selector3'
          }
        },
        userId: testUserId
      });

      await service.deleteTemplate(templateId, testUserId);

      // 验证字段也被删除
      const [rows] = await pool.execute(
        'SELECT * FROM crawler_template_fields WHERE template_id = ?',
        [templateId]
      );
      expect((rows as any[]).length).toBe(0);
    });

    it('更新模板选择器应该重建字段', async () => {
      const templateId = await service.saveTemplate({
        name: '模板',
        url: 'https://example.com',
        selectors: {
          fields: {
            '旧字段1': 'old1',
            '旧字段2': 'old2'
          }
        },
        userId: testUserId
      });

      await service.updateTemplate(templateId, testUserId, {
        selectors: {
          fields: {
            '新字段1': 'new1',
            '新字段2': 'new2',
            '新字段3': 'new3'
          }
        }
      });

      const template = await service.getTemplateById(templateId, testUserId);
      expect(template?.fields).toHaveLength(3);
      expect(template?.fields.map(f => f.name)).toContain('新字段1');
      expect(template?.fields.map(f => f.name)).not.toContain('旧字段1');
    });
  });

  // ==================== 性能测试 ====================

  describe('性能测试', () => {
    it('批量创建模板应该在合理时间内完成', async () => {
      const startTime = Date.now();
      const count = 10;

      for (let i = 0; i < count; i++) {
        await service.saveTemplate({
          name: `批量模板${i}`,
          url: `https://example.com/${i}`,
          selectors: { fields: { '标题': 'h1' } },
          userId: testUserId
        });
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // 应该在5秒内完成

      const templates = await service.getUserTemplates(testUserId);
      expect(templates).toHaveLength(count);
    });

    it('获取大量模板应该在合理时间内完成', async () => {
      // 创建20个模板
      for (let i = 0; i < 20; i++) {
        await service.saveTemplate({
          name: `模板${i}`,
          url: `https://example.com/${i}`,
          selectors: { fields: { '标题': 'h1' } },
          userId: testUserId
        });
      }

      const startTime = Date.now();
      const templates = await service.getUserTemplates(testUserId);
      const duration = Date.now() - startTime;

      expect(templates).toHaveLength(20);
      expect(duration).toBeLessThan(1000); // 应该在1秒内完成
    });
  });
});
