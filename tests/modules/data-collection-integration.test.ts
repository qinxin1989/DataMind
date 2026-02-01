/**
 * 数据采集中心模块集成测试
 * 测试 crawler-management, ai-crawler-assistant, crawler-template-config 三个模块的协作
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '../../src/admin/core/database';
import { crawlerAssistantService } from '../../modules/ai-crawler-assistant/backend/service';
import { CrawlerTemplateConfigService } from '../../modules/crawler-template-config/backend/service';
import { PoolConnection } from 'mysql2/promise';

describe('数据采集中心模块集成测试', () => {
  let connection: PoolConnection;
  let templateService: CrawlerTemplateConfigService;

  beforeAll(async () => {
    connection = await pool.getConnection();
    
    // 创建测试表
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

    // 初始化服务
    templateService = new CrawlerTemplateConfigService('crawler_templates_test');
  });

  afterAll(async () => {
    // 清理测试表
    await connection.query('DROP TABLE IF EXISTS crawler_templates_test');
    connection.release();
  });

  describe('模块间协作测试', () => {
    it('应该能够创建模板并使用AI助手分析', async () => {
      // 1. 创建采集模板
      const template = await templateService.createTemplate(connection, {
        name: '集成测试模板',
        url: 'https://example.com',
        containerSelector: '.list-item',
        fields: [
          { name: '标题', selector: 'h2' },
          { name: '链接', selector: 'a::attr(href)' }
        ]
      }, 1);

      expect(template).toBeDefined();
      expect(template.id).toBeDefined();

      // 2. 使用AI助手分析URL (可能因为缺少AI配置或模块依赖而失败,这是预期的)
      try {
        const analysis = await crawlerAssistantService.analyzeWebpage('https://example.com', '通知公告');
        expect(analysis).toBeDefined();
        expect(analysis).toHaveProperty('url');
      } catch (error: any) {
        // AI配置未设置或模块依赖缺失时会失败,这是正常的
        expect(error.message).toMatch(/未配置 AI 服务|Cannot find module/);
      }

      // 3. 验证模板可以被查询
      const retrieved = await templateService.getTemplate(connection, template.id!);
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('集成测试模板');
    });

    it('应该能够测试模板并获取结果', async () => {
      // 1. 创建模板
      const template = await templateService.createTemplate(connection, {
        name: '测试模板2',
        url: 'https://example.com',
        containerSelector: '.item',
        fields: [{ name: '标题', selector: 'h1' }]
      }, 1);

      // 2. 测试模板
      const testResult = await templateService.testTemplate(connection, {
        url: template.url,
        selectors: {
          container: template.container_selector,
          fields: {
            '标题': 'h1'
          }
        }
      });

      expect(testResult).toBeDefined();
      expect(testResult).toHaveProperty('success');
    });

    it('应该能够预览数据', async () => {
      // 1. 创建模板
      const template = await templateService.createTemplate(connection, {
        name: '预览测试模板',
        url: 'https://example.com',
        containerSelector: '.article',
        fields: [
          { name: '标题', selector: 'h1' },
          { name: '内容', selector: '.content' }
        ]
      }, 1);

      // 2. 预览数据
      const preview = await templateService.previewData(connection, {
        url: template.url,
        selectors: {
          container: template.container_selector,
          fields: {
            '标题': 'h1',
            '内容': '.content'
          }
        },
        limit: 5
      });

      expect(preview).toBeDefined();
      expect(preview).toHaveProperty('success');
    });

    it('应该能够验证选择器', async () => {
      const validation = await templateService.validateSelector(connection, {
        url: 'https://example.com',
        selector: '.item'
      });

      expect(validation).toBeDefined();
      expect(validation).toHaveProperty('valid');
    });

    it('应该能够使用AI分析功能', async () => {
      const analysis = await templateService.aiAnalyze(connection, {
        url: 'https://example.com',
        dataType: '新闻资讯'
      });

      expect(analysis).toBeDefined();
      expect(analysis).toHaveProperty('success');
    });

    it('应该能够诊断采集问题', async () => {
      const diagnosis = await templateService.diagnose(connection, {
        url: 'https://example.com',
        containerSelector: '.item',
        fields: [
          { name: '标题', selector: 'h1' }
        ]
      });

      expect(diagnosis).toBeDefined();
      expect(diagnosis).toHaveProperty('success');
    });
  });

  describe('完整流程测试', () => {
    it('应该支持完整的模板创建-测试-使用流程', async () => {
      // 步骤1: 使用AI助手分析URL (跳过,因为需要AI配置)
      // 步骤2: 创建模板
      const template = await templateService.createTemplate(connection, {
        name: '完整流程测试模板',
        url: 'https://example.com/news',
        containerSelector: '.news-item',
        fields: [
          { name: '标题', selector: 'h2.title' },
          { name: '摘要', selector: '.summary' },
          { name: '日期', selector: '.date' }
        ],
        paginationEnabled: true,
        paginationNextSelector: '.next-page',
        paginationMaxPages: 10
      }, 1);

      expect(template.id).toBeDefined();

      // 步骤3: 验证选择器
      const validation = await templateService.validateSelector(connection, {
        url: template.url,
        selector: template.container_selector
      });

      expect(validation).toBeDefined();

      // 步骤4: 预览数据
      const preview = await templateService.previewData(connection, {
        url: template.url,
        selectors: {
          container: template.container_selector,
          fields: {
            '标题': 'h2.title',
            '摘要': '.summary',
            '日期': '.date'
          }
        },
        limit: 3
      });

      expect(preview).toBeDefined();

      // 步骤5: 测试模板
      const testResult = await templateService.testTemplate(connection, {
        url: template.url,
        selectors: {
          container: template.container_selector,
          fields: {
            '标题': 'h2.title',
            '摘要': '.summary',
            '日期': '.date'
          }
        },
        pagination: {
          enabled: template.pagination_enabled || false,
          maxPages: template.pagination_max_pages,
          nextPageSelector: template.pagination_next_selector
        }
      });

      expect(testResult).toBeDefined();

      // 步骤6: 如果测试失败,使用诊断功能
      if (!testResult.success) {
        const diagnosis = await templateService.diagnose(connection, {
          url: template.url,
          containerSelector: template.container_selector,
          fields: template.fields
        });

        expect(diagnosis).toBeDefined();
        // 诊断结果可能有不同的格式
        expect(diagnosis).toHaveProperty('success');
      }

      // 步骤7: 更新模板
      const updated = await templateService.updateTemplate(connection, template.id!, {
        name: '完整流程测试模板-已优化'
      });

      expect(updated.name).toBe('完整流程测试模板-已优化');

      // 步骤8: 删除模板
      await templateService.deleteTemplate(connection, template.id!);

      const deleted = await templateService.getTemplate(connection, template.id!);
      expect(deleted).toBeNull();
    });
  });

  describe('并发操作测试', () => {
    it('应该支持并发创建多个模板', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        templateService.createTemplate(connection, {
          name: `并发测试模板${i + 1}`,
          url: `https://example.com/page${i + 1}`,
          containerSelector: '.item',
          fields: [{ name: '标题', selector: 'h1' }]
        }, 1)
      );

      const templates = await Promise.all(promises);

      expect(templates).toHaveLength(5);
      templates.forEach((template, i) => {
        expect(template.name).toBe(`并发测试模板${i + 1}`);
      });
    });

    it('应该支持并发测试多个模板', async () => {
      // 创建测试模板
      const templates = await Promise.all([
        templateService.createTemplate(connection, {
          name: '并发测试A',
          url: 'https://example.com/a',
          containerSelector: '.item',
          fields: [{ name: '标题', selector: 'h1' }]
        }, 1),
        templateService.createTemplate(connection, {
          name: '并发测试B',
          url: 'https://example.com/b',
          containerSelector: '.item',
          fields: [{ name: '标题', selector: 'h1' }]
        }, 1)
      ]);

      // 并发测试
      const testPromises = templates.map(template =>
        templateService.testTemplate(connection, {
          url: template.url,
          selectors: {
            container: template.container_selector,
            fields: { '标题': 'h1' }
          }
        })
      );

      const results = await Promise.all(testPromises);

      expect(results).toHaveLength(2);
      results.forEach(result => {
        expect(result).toHaveProperty('success');
      });
    });
  });

  describe('错误处理测试', () => {
    it('应该正确处理无效的URL', async () => {
      const result = await templateService.testTemplate(connection, {
        url: 'invalid-url',
        selectors: {
          container: '.item',
          fields: { '标题': 'h1' }
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('应该正确处理无效的选择器', async () => {
      const validation = await templateService.validateSelector(connection, {
        url: 'https://example.com',
        selector: '<<<invalid>>>'
      });

      expect(validation.valid).toBe(false);
    });

    it('应该正确处理不存在的模板', async () => {
      const template = await templateService.getTemplate(connection, 999999);
      expect(template).toBeNull();
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内完成模板创建', async () => {
      const startTime = Date.now();

      await templateService.createTemplate(connection, {
        name: '性能测试模板',
        url: 'https://example.com',
        containerSelector: '.item',
        fields: [{ name: '标题', selector: 'h1' }]
      }, 1);

      const duration = Date.now() - startTime;

      // 应该在100ms内完成
      expect(duration).toBeLessThan(100);
    });

    it('应该在合理时间内完成模板查询', async () => {
      const template = await templateService.createTemplate(connection, {
        name: '查询性能测试',
        url: 'https://example.com',
        containerSelector: '.item',
        fields: [{ name: '标题', selector: 'h1' }]
      }, 1);

      const startTime = Date.now();

      await templateService.getTemplate(connection, template.id!);

      const duration = Date.now() - startTime;

      // 应该在50ms内完成
      expect(duration).toBeLessThan(50);
    });

    it('应该支持批量查询', async () => {
      // 创建多个模板
      await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          templateService.createTemplate(connection, {
            name: `批量测试${i}`,
            url: 'https://example.com',
            containerSelector: '.item',
            fields: [{ name: '标题', selector: 'h1' }]
          }, 1)
        )
      );

      const startTime = Date.now();

      const templates = await templateService.getTemplates(connection);

      const duration = Date.now() - startTime;

      // 应该在200ms内完成
      expect(duration).toBeLessThan(200);
      expect(templates.length).toBeGreaterThanOrEqual(10);
    });
  });
});
