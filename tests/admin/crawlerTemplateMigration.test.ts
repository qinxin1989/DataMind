/**
 * 爬虫模板数据库迁移测试
 * 测试分页配置字段的添加和默认值
 * 需求: 9.1
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '../../src/admin/core/database';

describe('Crawler Template Migration Tests', () => {
  let connection: any;

  beforeAll(async () => {
    connection = await pool.getConnection();
  });

  afterAll(async () => {
    if (connection) {
      connection.release();
    }
  });

  describe('字段添加成功', () => {
    it('should have pagination_enabled field', async () => {
      const [columns] = await connection.execute(
        'DESCRIBE crawler_templates'
      ) as any;

      const fieldNames = columns.map((col: any) => col.Field);
      expect(fieldNames).toContain('pagination_enabled');
    });

    it('should have max_pages field', async () => {
      const [columns] = await connection.execute(
        'DESCRIBE crawler_templates'
      ) as any;

      const fieldNames = columns.map((col: any) => col.Field);
      expect(fieldNames).toContain('max_pages');
    });

    it('should have url_pattern field', async () => {
      const [columns] = await connection.execute(
        'DESCRIBE crawler_templates'
      ) as any;

      const fieldNames = columns.map((col: any) => col.Field);
      expect(fieldNames).toContain('url_pattern');
    });

    it('should have next_page_selector field', async () => {
      const [columns] = await connection.execute(
        'DESCRIBE crawler_templates'
      ) as any;

      const fieldNames = columns.map((col: any) => col.Field);
      expect(fieldNames).toContain('next_page_selector');
    });
  });

  describe('默认值正确', () => {
    it('pagination_enabled should default to 0 (false)', async () => {
      const [columns] = await connection.execute(
        'DESCRIBE crawler_templates'
      ) as any;

      const paginationEnabledField = columns.find(
        (col: any) => col.Field === 'pagination_enabled'
      );

      expect(paginationEnabledField).toBeDefined();
      expect(paginationEnabledField.Default).toBe('0');
      expect(paginationEnabledField.Type).toContain('tinyint');
    });

    it('max_pages should default to 1', async () => {
      const [columns] = await connection.execute(
        'DESCRIBE crawler_templates'
      ) as any;

      const maxPagesField = columns.find(
        (col: any) => col.Field === 'max_pages'
      );

      expect(maxPagesField).toBeDefined();
      expect(maxPagesField.Default).toBe('1');
      expect(maxPagesField.Type).toContain('int');
    });

    it('url_pattern should default to NULL', async () => {
      const [columns] = await connection.execute(
        'DESCRIBE crawler_templates'
      ) as any;

      const urlPatternField = columns.find(
        (col: any) => col.Field === 'url_pattern'
      );

      expect(urlPatternField).toBeDefined();
      expect(urlPatternField.Default).toBeNull();
      expect(urlPatternField.Type).toBe('varchar(500)');
    });

    it('next_page_selector should default to NULL', async () => {
      const [columns] = await connection.execute(
        'DESCRIBE crawler_templates'
      ) as any;

      const nextPageSelectorField = columns.find(
        (col: any) => col.Field === 'next_page_selector'
      );

      expect(nextPageSelectorField).toBeDefined();
      expect(nextPageSelectorField.Default).toBeNull();
      expect(nextPageSelectorField.Type).toBe('varchar(255)');
    });
  });

  describe('字段类型和约束', () => {
    it('pagination_enabled should be TINYINT(1)', async () => {
      const [columns] = await connection.execute(
        'DESCRIBE crawler_templates'
      ) as any;

      const field = columns.find(
        (col: any) => col.Field === 'pagination_enabled'
      );

      expect(field.Type).toContain('tinyint');
    });

    it('max_pages should be INT', async () => {
      const [columns] = await connection.execute(
        'DESCRIBE crawler_templates'
      ) as any;

      const field = columns.find(
        (col: any) => col.Field === 'max_pages'
      );

      expect(field.Type).toContain('int');
    });

    it('url_pattern should be VARCHAR(500)', async () => {
      const [columns] = await connection.execute(
        'DESCRIBE crawler_templates'
      ) as any;

      const field = columns.find(
        (col: any) => col.Field === 'url_pattern'
      );

      expect(field.Type).toBe('varchar(500)');
    });

    it('next_page_selector should be VARCHAR(255)', async () => {
      const [columns] = await connection.execute(
        'DESCRIBE crawler_templates'
      ) as any;

      const field = columns.find(
        (col: any) => col.Field === 'next_page_selector'
      );

      expect(field.Type).toBe('varchar(255)');
    });
  });

  describe('实际数据插入测试', () => {
    it('should insert template with default pagination values', async () => {
      // 首先获取一个有效的 user_id
      const [users] = await connection.execute(
        'SELECT id FROM sys_users LIMIT 1'
      ) as any;

      if (users.length === 0) {
        console.log('No users found, skipping insert test');
        return;
      }

      const userId = users[0].id;
      const testId = `test-${Date.now()}`;

      // 插入测试数据（不指定分页字段，使用默认值）
      await connection.execute(
        `INSERT INTO crawler_templates (id, user_id, name, url, container_selector)
         VALUES (?, ?, ?, ?, ?)`,
        [testId, userId, 'Test Template', 'https://example.com', '.container']
      );

      // 查询插入的数据
      const [rows] = await connection.execute(
        'SELECT * FROM crawler_templates WHERE id = ?',
        [testId]
      ) as any;

      expect(rows.length).toBe(1);
      expect(rows[0].pagination_enabled).toBe(0);
      expect(rows[0].max_pages).toBe(1);
      expect(rows[0].url_pattern).toBeNull();
      expect(rows[0].next_page_selector).toBeNull();

      // 清理测试数据
      await connection.execute(
        'DELETE FROM crawler_templates WHERE id = ?',
        [testId]
      );
    });

    it('should insert template with custom pagination values', async () => {
      // 首先获取一个有效的 user_id
      const [users] = await connection.execute(
        'SELECT id FROM sys_users LIMIT 1'
      ) as any;

      if (users.length === 0) {
        console.log('No users found, skipping insert test');
        return;
      }

      const userId = users[0].id;
      const testId = `test-${Date.now()}`;

      // 插入测试数据（指定分页字段）
      await connection.execute(
        `INSERT INTO crawler_templates 
         (id, user_id, name, url, container_selector, pagination_enabled, max_pages, url_pattern, next_page_selector)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          testId,
          userId,
          'Test Template with Pagination',
          'https://example.com',
          '.container',
          1,
          5,
          'https://example.com/page/{page}',
          '.next-page'
        ]
      );

      // 查询插入的数据
      const [rows] = await connection.execute(
        'SELECT * FROM crawler_templates WHERE id = ?',
        [testId]
      ) as any;

      expect(rows.length).toBe(1);
      expect(rows[0].pagination_enabled).toBe(1);
      expect(rows[0].max_pages).toBe(5);
      expect(rows[0].url_pattern).toBe('https://example.com/page/{page}');
      expect(rows[0].next_page_selector).toBe('.next-page');

      // 清理测试数据
      await connection.execute(
        'DELETE FROM crawler_templates WHERE id = ?',
        [testId]
      );
    });
  });
});
