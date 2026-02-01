/**
 * 采集模板配置服务测试
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { CrawlerTemplateConfigService } from '../../../modules/crawler-template-config/backend/service';
import { pool } from '../../../src/admin/core/database';
import { PoolConnection } from 'mysql2/promise';

describe('CrawlerTemplateConfigService', () => {
  let service: CrawlerTemplateConfigService;
  let connection: PoolConnection;
  let testTemplateId: number;

  beforeAll(async () => {
    service = new CrawlerTemplateConfigService('crawler_templates_test');
    connection = await pool.getConnection();
    
    // 创建独立的测试表
    await connection.query('DROP TABLE IF EXISTS crawler_templates_test');
    await connection.query(`
      CREATE TABLE crawler_templates_test (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        department VARCHAR(255),
        data_type VARCHAR(100),
        url TEXT NOT NULL,
        container_selector TEXT NOT NULL,
        fields JSON NOT NULL,
        pagination_enabled BOOLEAN DEFAULT FALSE,
        pagination_next_selector TEXT,
        pagination_max_pages INT DEFAULT 50,
        created_by INT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
  });

  afterAll(async () => {
    // 清理测试表
    await connection.query('DROP TABLE IF EXISTS crawler_templates_test');
    connection.release();
  });

  beforeEach(async () => {
    // 清理之前的测试数据
    await connection.query('DELETE FROM crawler_templates_test WHERE name LIKE "测试%"');
  });

  describe('模板CRUD操作', () => {
    it('应该能够创建采集模板', async () => {
      const templateData = {
        name: '测试模板1',
        department: '测试部门',
        dataType: '通知公告',
        url: 'https://example.com',
        containerSelector: '.list-item',
        fields: [
          { name: '标题', selector: 'a' },
          { name: '链接', selector: 'a::attr(href)' }
        ],
        paginationEnabled: true,
        paginationNextSelector: '.next-page',
        paginationMaxPages: 50
      };

      const template = await service.createTemplate(connection, templateData, 1);

      expect(template).toBeDefined();
      expect(template.id).toBeDefined();
      expect(template.name).toBe('测试模板1');
      expect(template.department).toBe('测试部门');
      expect(template.data_type).toBe('通知公告');
      expect(template.url).toBe('https://example.com');
      expect(template.container_selector).toBe('.list-item');
      expect(template.fields).toHaveLength(2);
      expect(template.pagination_enabled).toBe(true);

      testTemplateId = template.id!;
    });

    it('应该能够获取所有模板', async () => {
      // 创建测试数据
      await service.createTemplate(connection, {
        name: '测试模板2',
        url: 'https://example.com',
        containerSelector: '.item',
        fields: [{ name: '标题', selector: 'h1' }]
      }, 1);

      const templates = await service.getTemplates(connection);

      expect(templates).toBeDefined();
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
    });

    it('应该能够根据ID获取模板', async () => {
      const created = await service.createTemplate(connection, {
        name: '测试模板3',
        url: 'https://example.com',
        containerSelector: '.item',
        fields: [{ name: '标题', selector: 'h1' }]
      }, 1);

      const template = await service.getTemplate(connection, created.id!);

      expect(template).toBeDefined();
      expect(template?.id).toBe(created.id);
      expect(template?.name).toBe('测试模板3');
    });

    it('应该在模板不存在时返回null', async () => {
      const template = await service.getTemplate(connection, 999999);
      expect(template).toBeNull();
    });

    it('应该能够更新模板', async () => {
      const created = await service.createTemplate(connection, {
        name: '测试模板4',
        url: 'https://example.com',
        containerSelector: '.item',
        fields: [{ name: '标题', selector: 'h1' }]
      }, 1);

      const updated = await service.updateTemplate(connection, created.id!, {
        name: '测试模板4-更新',
        url: 'https://example.com/updated',
        containerSelector: '.new-item'
      });

      expect(updated.name).toBe('测试模板4-更新');
      expect(updated.url).toBe('https://example.com/updated');
      expect(updated.container_selector).toBe('.new-item');
    });

    it('应该能够删除模板', async () => {
      const created = await service.createTemplate(connection, {
        name: '测试模板5',
        url: 'https://example.com',
        containerSelector: '.item',
        fields: [{ name: '标题', selector: 'h1' }]
      }, 1);

      await service.deleteTemplate(connection, created.id!);

      const template = await service.getTemplate(connection, created.id!);
      expect(template).toBeNull();
    });
  });

  describe('字段配置', () => {
    it('应该正确保存和解析字段配置', async () => {
      const fields = [
        { name: '标题', selector: 'h1.title' },
        { name: '内容', selector: '.content' },
        { name: '日期', selector: '.date' },
        { name: '作者', selector: '.author' }
      ];

      const template = await service.createTemplate(connection, {
        name: '测试模板6',
        url: 'https://example.com',
        containerSelector: '.article',
        fields
      }, 1);

      expect(template.fields).toHaveLength(4);
      expect(template.fields[0].name).toBe('标题');
      expect(template.fields[0].selector).toBe('h1.title');
    });

    it('应该支持复杂的选择器语法', async () => {
      const fields = [
        { name: '链接', selector: 'a::attr(href)' },
        { name: '图片', selector: 'img::attr(src)' },
        { name: 'HTML', selector: '.content::html' }
      ];

      const template = await service.createTemplate(connection, {
        name: '测试模板7',
        url: 'https://example.com',
        containerSelector: '.item',
        fields
      }, 1);

      expect(template.fields[0].selector).toBe('a::attr(href)');
      expect(template.fields[1].selector).toBe('img::attr(src)');
      expect(template.fields[2].selector).toBe('.content::html');
    });
  });

  describe('分页配置', () => {
    it('应该正确保存分页配置', async () => {
      const template = await service.createTemplate(connection, {
        name: '测试模板8',
        url: 'https://example.com',
        containerSelector: '.item',
        fields: [{ name: '标题', selector: 'h1' }],
        paginationEnabled: true,
        paginationNextSelector: '.pagination .next',
        paginationMaxPages: 100
      }, 1);

      expect(template.pagination_enabled).toBe(true);
      expect(template.pagination_next_selector).toBe('.pagination .next');
      expect(template.pagination_max_pages).toBe(100);
    });

    it('应该支持禁用分页', async () => {
      const template = await service.createTemplate(connection, {
        name: '测试模板9',
        url: 'https://example.com',
        containerSelector: '.item',
        fields: [{ name: '标题', selector: 'h1' }],
        paginationEnabled: false
      }, 1);

      expect(template.pagination_enabled).toBe(false);
    });
  });

  describe('数据验证', () => {
    it('应该在缺少必填字段时抛出错误', async () => {
      await expect(
        service.createTemplate(connection, {
          name: '',
          url: 'https://example.com',
          containerSelector: '.item',
          fields: []
        } as any, 1)
      ).rejects.toThrow();
    });

    it('应该在更新不存在的模板时抛出错误', async () => {
      await expect(
        service.updateTemplate(connection, 999999, {
          name: '不存在的模板'
        })
      ).rejects.toThrow();
    });

    it('应该在没有更新字段时抛出错误', async () => {
      const created = await service.createTemplate(connection, {
        name: '测试模板10',
        url: 'https://example.com',
        containerSelector: '.item',
        fields: [{ name: '标题', selector: 'h1' }]
      }, 1);

      await expect(
        service.updateTemplate(connection, created.id!, {})
      ).rejects.toThrow('No fields to update');
    });
  });

  describe('模板查询', () => {
    it('应该按创建时间倒序返回模板', async () => {
      await service.createTemplate(connection, {
        name: '测试模板11',
        url: 'https://example.com',
        containerSelector: '.item',
        fields: [{ name: '标题', selector: 'h1' }]
      }, 1);

      // 增加延迟确保时间戳不同
      await new Promise(resolve => setTimeout(resolve, 1000));

      await service.createTemplate(connection, {
        name: '测试模板12',
        url: 'https://example.com',
        containerSelector: '.item',
        fields: [{ name: '标题', selector: 'h1' }]
      }, 1);

      const templates = await service.getTemplates(connection);
      const testTemplates = templates.filter(t => t.name?.startsWith('测试模板'));

      expect(testTemplates.length).toBeGreaterThanOrEqual(2);
      // 最新创建的应该在前面
      const idx11 = testTemplates.findIndex(t => t.name === '测试模板11');
      const idx12 = testTemplates.findIndex(t => t.name === '测试模板12');
      expect(idx12).toBeLessThan(idx11);
    });
  });

  describe('外部服务集成', () => {
    it('测试模板功能应该返回结果对象', async () => {
      const result = await service.testTemplate(connection, {
        url: 'https://example.com',
        selectors: {
          container: '.item',
          fields: {
            '标题': 'h1',
            '链接': 'a::attr(href)'
          }
        }
      });

      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
    });

    it('预览数据功能应该返回结果对象', async () => {
      const result = await service.previewData(connection, {
        url: 'https://example.com',
        selectors: {
          container: '.item',
          fields: {
            '标题': 'h1'
          }
        },
        limit: 5
      });

      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
    });

    it('验证选择器功能应该返回结果对象', async () => {
      const result = await service.validateSelector(connection, {
        url: 'https://example.com',
        selector: '.item'
      });

      expect(result).toBeDefined();
      expect(result).toHaveProperty('valid');
    });

    it('AI分析功能应该返回结果对象', async () => {
      const result = await service.aiAnalyze(connection, {
        url: 'https://example.com',
        dataType: '通知公告'
      });

      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
    });

    it('诊断功能应该返回结果对象', async () => {
      const result = await service.diagnose(connection, {
        url: 'https://example.com',
        containerSelector: '.item',
        fields: [
          { name: '标题', selector: 'h1' }
        ]
      });

      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
    });
  });

  describe('边界情况', () => {
    it('应该处理空字段数组', async () => {
      const template = await service.createTemplate(connection, {
        name: '测试模板13',
        url: 'https://example.com',
        containerSelector: '.item',
        fields: []
      }, 1);

      expect(template.fields).toHaveLength(0);
    });

    it('应该处理长URL', async () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(1000);
      const template = await service.createTemplate(connection, {
        name: '测试模板14',
        url: longUrl,
        containerSelector: '.item',
        fields: [{ name: '标题', selector: 'h1' }]
      }, 1);

      expect(template.url).toBe(longUrl);
    });

    it('应该处理复杂的JSON字段配置', async () => {
      const fields = Array.from({ length: 20 }, (_, i) => ({
        name: `字段${i + 1}`,
        selector: `.field-${i + 1}`
      }));

      const template = await service.createTemplate(connection, {
        name: '测试模板15',
        url: 'https://example.com',
        containerSelector: '.item',
        fields
      }, 1);

      expect(template.fields).toHaveLength(20);
    });
  });

  describe('并发操作', () => {
    it('应该支持并发创建模板', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        service.createTemplate(connection, {
          name: `测试模板并发${i + 1}`,
          url: 'https://example.com',
          containerSelector: '.item',
          fields: [{ name: '标题', selector: 'h1' }]
        }, 1)
      );

      const templates = await Promise.all(promises);

      expect(templates).toHaveLength(5);
      templates.forEach((template, i) => {
        expect(template.name).toBe(`测试模板并发${i + 1}`);
      });
    });

    it('应该支持并发更新不同模板', async () => {
      const created = await Promise.all([
        service.createTemplate(connection, {
          name: '测试模板并发更新1',
          url: 'https://example.com',
          containerSelector: '.item',
          fields: [{ name: '标题', selector: 'h1' }]
        }, 1),
        service.createTemplate(connection, {
          name: '测试模板并发更新2',
          url: 'https://example.com',
          containerSelector: '.item',
          fields: [{ name: '标题', selector: 'h1' }]
        }, 1)
      ]);

      const promises = created.map((template, i) =>
        service.updateTemplate(connection, template.id!, {
          name: `测试模板并发更新${i + 1}-已更新`
        })
      );

      const updated = await Promise.all(promises);

      expect(updated[0].name).toBe('测试模板并发更新1-已更新');
      expect(updated[1].name).toBe('测试模板并发更新2-已更新');
    });
  });
});
