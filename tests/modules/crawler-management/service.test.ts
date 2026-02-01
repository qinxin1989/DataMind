/**
 * 爬虫管理模块测试
 * 
 * 测试覆盖：
 * - 模板管理（CRUD）
 * - 任务管理
 * - 结果管理
 * - 权限控制
 * - 边界情况
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { pool } from '../../../src/admin/core/database';
import { crawlerManagementService } from '../../../modules/crawler-management/backend/service';
import { v4 as uuidv4 } from 'uuid';

describe('爬虫管理模块测试', () => {
  const testUserId = uuidv4();
  const testUserId2 = uuidv4();
  let testTemplateId: string;
  let testTaskId: string;
  let testResultId: string;

  beforeAll(async () => {
    // 禁用外键检查
    await pool.execute('SET FOREIGN_KEY_CHECKS = 0');
  });

  afterAll(async () => {
    // 清理测试数据
    await pool.execute('DELETE FROM crawler_result_items WHERE row_id IN (SELECT id FROM crawler_result_rows WHERE result_id IN (SELECT id FROM crawler_results WHERE user_id IN (?, ?)))', [testUserId, testUserId2]);
    await pool.execute('DELETE FROM crawler_result_rows WHERE result_id IN (SELECT id FROM crawler_results WHERE user_id IN (?, ?))', [testUserId, testUserId2]);
    await pool.execute('DELETE FROM crawler_results WHERE user_id IN (?, ?)', [testUserId, testUserId2]);
    await pool.execute('DELETE FROM crawler_template_fields WHERE template_id IN (SELECT id FROM crawler_templates WHERE user_id IN (?, ?))', [testUserId, testUserId2]);
    await pool.execute('DELETE FROM crawler_templates WHERE user_id IN (?, ?)', [testUserId, testUserId2]);
    await pool.execute('DELETE FROM crawler_tasks WHERE user_id IN (?, ?)', [testUserId, testUserId2]);
    
    // 恢复外键检查
    await pool.execute('SET FOREIGN_KEY_CHECKS = 1');
  });

  beforeEach(async () => {
    // 每个测试前清理（只清理test-开头的数据）
    await pool.execute('DELETE FROM crawler_result_items WHERE row_id IN (SELECT id FROM crawler_result_rows WHERE result_id IN (SELECT id FROM crawler_results WHERE user_id = ?))', [testUserId]);
    await pool.execute('DELETE FROM crawler_result_rows WHERE result_id IN (SELECT id FROM crawler_results WHERE user_id = ?)', [testUserId]);
    await pool.execute('DELETE FROM crawler_results WHERE user_id = ?', [testUserId]);
    await pool.execute('DELETE FROM crawler_template_fields WHERE template_id IN (SELECT id FROM crawler_templates WHERE user_id = ?)', [testUserId]);
    await pool.execute('DELETE FROM crawler_templates WHERE user_id = ?', [testUserId]);
    await pool.execute('DELETE FROM crawler_tasks WHERE user_id = ?', [testUserId]);
  });

  describe('模板管理', () => {
    it('应该能够保存模板', async () => {
      const templateData = {
        name: '测试模板',
        url: 'https://example.com',
        selectors: {
          container: '.list .item',
          fields: {
            '标题': '.title',
            '日期': '.date',
            '链接': 'a@href'
          }
        }
      };

      const templateId = await crawlerManagementService.saveTemplate(testUserId, templateData);
      expect(templateId).toBeTruthy();
      expect(templateId).toMatch(/^[0-9a-f-]{36}$/);

      testTemplateId = templateId;

      // 验证模板已保存
      const template = await crawlerManagementService.getTemplate(templateId);
      expect(template).toBeTruthy();
      expect(template?.name).toBe('测试模板');
      expect(template?.url).toBe('https://example.com');
      expect(template?.containerSelector).toBe('.list .item');
      expect(template?.fields).toHaveLength(3);
    });

    it('应该能够获取模板列表', async () => {
      // 创建多个模板
      const template1 = {
        name: '模板1',
        url: 'https://example1.com',
        selectors: {
          fields: { '字段1': '.field1' }
        }
      };
      
      await crawlerManagementService.saveTemplate(testUserId, template1);
      
      // 添加延迟确保创建时间不同
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const template2 = {
        name: '模板2',
        url: 'https://example2.com',
        selectors: {
          fields: { '字段2': '.field2' }
        }
      };

      await crawlerManagementService.saveTemplate(testUserId, template2);

      const templates = await crawlerManagementService.getTemplates(testUserId);
      expect(templates.length).toBeGreaterThanOrEqual(2);
      // 验证包含两个模板
      const names = templates.map(t => t.name);
      expect(names).toContain('模板1');
      expect(names).toContain('模板2');
    });

    it('应该能够删除模板', async () => {
      const templateData = {
        name: '待删除模板',
        url: 'https://example.com',
        selectors: {
          fields: { '字段': '.field' }
        }
      };

      const templateId = await crawlerManagementService.saveTemplate(testUserId, templateData);
      
      // 删除模板
      await crawlerManagementService.deleteTemplate(templateId, testUserId);

      // 验证模板已删除
      const template = await crawlerManagementService.getTemplate(templateId);
      expect(template).toBeNull();
    });

    it('应该拒绝删除其他用户的模板', async () => {
      const templateData = {
        name: '用户1的模板',
        url: 'https://example.com',
        selectors: {
          fields: { '字段': '.field' }
        }
      };

      const templateId = await crawlerManagementService.saveTemplate(testUserId, templateData);

      // 用户2尝试删除用户1的模板
      await expect(
        crawlerManagementService.deleteTemplate(templateId, testUserId2)
      ).rejects.toThrow('无权删除此模板');
    });

    it('应该正确处理没有容器选择器的模板', async () => {
      const templateData = {
        name: '无容器模板',
        url: 'https://example.com',
        selectors: {
          fields: { '字段': '.field' }
        }
      };

      const templateId = await crawlerManagementService.saveTemplate(testUserId, templateData);
      const template = await crawlerManagementService.getTemplate(templateId);
      
      expect(template?.containerSelector).toBe('');
    });
  });

  describe('任务管理', () => {
    beforeEach(async () => {
      // 创建测试模板
      const templateData = {
        name: '任务测试模板',
        url: 'https://example.com',
        selectors: {
          fields: { '字段': '.field' }
        }
      };
      testTemplateId = await crawlerManagementService.saveTemplate(testUserId, templateData);

      // 创建测试任务
      testTaskId = uuidv4();
      await pool.execute(
        `INSERT INTO crawler_tasks (id, user_id, template_id, name, frequency, status) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [testTaskId, testUserId, testTemplateId, '测试任务', 'daily', 'active']
      );
    });

    it('应该能够获取任务列表', async () => {
      const tasks = await crawlerManagementService.getTasks(testUserId);
      expect(tasks).toHaveLength(1);
      expect(tasks[0].name).toBe('测试任务');
      expect(tasks[0].frequency).toBe('daily');
      expect(tasks[0].status).toBe('active');
      expect(tasks[0].templateName).toBe('任务测试模板');
    });

    it('应该能够切换任务状态', async () => {
      // 暂停任务
      await crawlerManagementService.toggleTask(testTaskId, testUserId, 'paused');
      
      const [rows] = await pool.execute(
        'SELECT status FROM crawler_tasks WHERE id = ?',
        [testTaskId]
      );
      expect((rows as any[])[0].status).toBe('paused');

      // 恢复任务
      await crawlerManagementService.toggleTask(testTaskId, testUserId, 'active');
      
      const [rows2] = await pool.execute(
        'SELECT status FROM crawler_tasks WHERE id = ?',
        [testTaskId]
      );
      expect((rows2 as any[])[0].status).toBe('active');
    });

    it('应该拒绝操作其他用户的任务', async () => {
      await expect(
        crawlerManagementService.toggleTask(testTaskId, testUserId2, 'paused')
      ).rejects.toThrow('无权操作此任务');
    });
  });

  describe('结果管理', () => {
    beforeEach(async () => {
      // 创建测试模板
      const templateData = {
        name: '结果测试模板',
        url: 'https://example.com',
        selectors: {
          fields: { '字段': '.field' }
        }
      };
      testTemplateId = await crawlerManagementService.saveTemplate(testUserId, templateData);
    });

    it('应该能够保存采集结果', async () => {
      const data = [
        { '标题': '标题1', '日期': '2024-01-01', '链接': 'https://example.com/1' },
        { '标题': '标题2', '日期': '2024-01-02', '链接': 'https://example.com/2' }
      ];

      const resultId = await crawlerManagementService.saveResults(testUserId, testTemplateId, data);
      expect(resultId).toBeTruthy();
      
      testResultId = resultId;

      // 验证结果已保存
      const [rows] = await pool.execute(
        'SELECT * FROM crawler_results WHERE id = ?',
        [resultId]
      );
      expect((rows as any[]).length).toBe(1);
    });

    it('应该能够获取结果列表', async () => {
      const data = [{ '字段': '值' }];
      await crawlerManagementService.saveResults(testUserId, testTemplateId, data);

      const results = await crawlerManagementService.getResults(testUserId);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].templateName).toBe('结果测试模板');
    });

    it('应该能够获取结果详情', async () => {
      const data = [
        { '标题': '标题1', '日期': '2024-01-01' },
        { '标题': '标题2', '日期': '2024-01-02' }
      ];

      const resultId = await crawlerManagementService.saveResults(testUserId, testTemplateId, data);
      const details = await crawlerManagementService.getResultDetails(resultId, testUserId);

      expect(details).toHaveLength(2);
      // 验证包含两条数据（不验证顺序）
      const titles = details.map(d => d.data['标题']);
      expect(titles).toContain('标题1');
      expect(titles).toContain('标题2');
    });

    it('应该能够删除结果', async () => {
      const data = [{ '字段': '值' }];
      const resultId = await crawlerManagementService.saveResults(testUserId, testTemplateId, data);

      // 删除结果
      await crawlerManagementService.deleteResult(resultId, testUserId);

      // 验证结果已删除
      const [rows] = await pool.execute(
        'SELECT * FROM crawler_results WHERE id = ?',
        [resultId]
      );
      expect((rows as any[]).length).toBe(0);
    });

    it('应该拒绝查看其他用户的结果', async () => {
      const data = [{ '字段': '值' }];
      const resultId = await crawlerManagementService.saveResults(testUserId, testTemplateId, data);

      await expect(
        crawlerManagementService.getResultDetails(resultId, testUserId2)
      ).rejects.toThrow('无权查看此结果');
    });

    it('应该拒绝删除其他用户的结果', async () => {
      const data = [{ '字段': '值' }];
      const resultId = await crawlerManagementService.saveResults(testUserId, testTemplateId, data);

      await expect(
        crawlerManagementService.deleteResult(resultId, testUserId2)
      ).rejects.toThrow('无权删除此结果');
    });
  });

  describe('边界情况', () => {
    it('应该处理空字段列表', async () => {
      const templateData = {
        name: '空字段模板',
        url: 'https://example.com',
        selectors: {
          fields: {}
        }
      };

      const templateId = await crawlerManagementService.saveTemplate(testUserId, templateData);
      const template = await crawlerManagementService.getTemplate(templateId);
      
      expect(template?.fields).toHaveLength(0);
    });

    it('应该处理特殊字符', async () => {
      const templateData = {
        name: '特殊字符<>&"\'',
        url: 'https://example.com?a=1&b=2',
        selectors: {
          fields: {
            '字段<>&"\'': '.field'
          }
        }
      };

      const templateId = await crawlerManagementService.saveTemplate(testUserId, templateData);
      const template = await crawlerManagementService.getTemplate(templateId);
      
      expect(template?.name).toBe('特殊字符<>&"\'');
      expect(template?.url).toBe('https://example.com?a=1&b=2');
    });

    it('应该处理大量数据', async () => {
      const templateData = {
        name: '大数据模板',
        url: 'https://example.com',
        selectors: {
          fields: { '字段': '.field' }
        }
      };
      const templateId = await crawlerManagementService.saveTemplate(testUserId, templateData);

      // 创建100条数据
      const data = Array.from({ length: 100 }, (_, i) => ({
        '序号': String(i + 1),
        '标题': `标题${i + 1}`,
        '内容': `内容${i + 1}`.repeat(10) // 较长的内容
      }));

      const startTime = Date.now();
      const resultId = await crawlerManagementService.saveResults(testUserId, templateId, data);
      const endTime = Date.now();

      expect(resultId).toBeTruthy();
      expect(endTime - startTime).toBeLessThan(5000); // 应该在5秒内完成

      // 验证数据完整性
      const details = await crawlerManagementService.getResultDetails(resultId, testUserId);
      expect(details).toHaveLength(100);
    });

    it('应该处理不存在的模板', async () => {
      const template = await crawlerManagementService.getTemplate('non-existent-id');
      expect(template).toBeNull();
    });

    it('应该处理不存在的结果', async () => {
      await expect(
        crawlerManagementService.getResultDetails('non-existent-id', testUserId)
      ).rejects.toThrow('结果不存在');
    });
  });

  describe('HTML渲染', () => {
    it('应该正确渲染HTML表格', () => {
      const fields = ['标题', '日期', '链接'];
      const data = [
        { '标题': '标题1', '日期': '2024-01-01', '链接': 'https://example.com/1' },
        { '标题': '标题2', '日期': '2024-01-02', '链接': 'https://example.com/2' }
      ];

      const html = crawlerManagementService.renderHtml(fields, data);
      
      expect(html).toContain('<table');
      expect(html).toContain('<thead>');
      expect(html).toContain('<tbody>');
      expect(html).toContain('标题1');
      expect(html).toContain('2024-01-01');
      expect(html).toContain('https://example.com/1');
    });

    it('应该处理空数据', () => {
      const fields = ['字段1', '字段2'];
      const data: any[] = [];

      const html = crawlerManagementService.renderHtml(fields, data);
      
      expect(html).toContain('<table');
      expect(html).toContain('<thead>');
      expect(html).toContain('</tbody>');
    });
  });

  describe('性能测试', () => {
    it('应该快速获取模板列表', async () => {
      // 创建20个模板
      for (let i = 0; i < 20; i++) {
        await crawlerManagementService.saveTemplate(testUserId, {
          name: `模板${i}`,
          url: `https://example${i}.com`,
          selectors: {
            fields: { '字段': '.field' }
          }
        });
      }

      const startTime = Date.now();
      const templates = await crawlerManagementService.getTemplates(testUserId);
      const endTime = Date.now();

      expect(templates).toHaveLength(20);
      expect(endTime - startTime).toBeLessThan(1000); // 应该在1秒内完成
    });

    it('应该快速获取结果列表', async () => {
      const templateData = {
        name: '性能测试模板',
        url: 'https://example.com',
        selectors: {
          fields: { '字段': '.field' }
        }
      };
      const templateId = await crawlerManagementService.saveTemplate(testUserId, templateData);

      // 创建20个结果
      for (let i = 0; i < 20; i++) {
        await crawlerManagementService.saveResults(testUserId, templateId, [
          { '字段': `值${i}` }
        ]);
      }

      const startTime = Date.now();
      const results = await crawlerManagementService.getResults(testUserId, 20);
      const endTime = Date.now();

      expect(results).toHaveLength(20);
      expect(endTime - startTime).toBeLessThan(1000); // 应该在1秒内完成
    });
  });
});
