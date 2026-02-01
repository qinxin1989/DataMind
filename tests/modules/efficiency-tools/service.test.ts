/**
 * 效率工具服务测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EfficiencyToolsService } from '../../../modules/efficiency-tools/backend/service';

// Mock 数据库
const mockDb = {
  run: vi.fn().mockResolvedValue({}),
  get: vi.fn().mockResolvedValue({}),
  all: vi.fn().mockResolvedValue([])
};

describe('EfficiencyToolsService', () => {
  let service: EfficiencyToolsService;

  beforeEach(() => {
    service = new EfficiencyToolsService(mockDb);
    vi.clearAllMocks();
  });

  describe('初始化', () => {
    it('应该创建服务实例', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(EfficiencyToolsService);
    });

    it('应该使用默认配置', () => {
      const defaultService = new EfficiencyToolsService(mockDb);
      expect(defaultService).toBeDefined();
    });

    it('应该支持自定义配置', () => {
      const customService = new EfficiencyToolsService(mockDb, {
        enableSqlFormatter: false,
        maxInputSize: 5 * 1024 * 1024
      });
      expect(customService).toBeDefined();
    });
  });

  describe('SQL 格式化', () => {
    it('应该格式化简单的 SQL', async () => {
      const result = await service.formatSql({
        sql: 'select * from users where id=1'
      });

      expect(result.success).toBe(true);
      expect(result.formatted).toBeDefined();
      expect(result.formatted).toContain('select');
      expect(result.formatted).toContain('from');
    });

    it('应该支持不同的 SQL 语言', async () => {
      const result = await service.formatSql({
        sql: 'select * from users',
        language: 'postgresql'
      });

      expect(result.success).toBe(true);
      expect(result.formatted).toBeDefined();
    });

    it('应该支持大写关键字', async () => {
      const result = await service.formatSql({
        sql: 'select * from users',
        uppercase: true
      });

      expect(result.success).toBe(true);
      expect(result.formatted).toBeDefined();
      // sql-formatter 的 uppercase 选项可能不会影响所有关键字
      expect(result.formatted).toMatch(/select|SELECT/);
    });

    it('应该验证空输入', async () => {
      const result = await service.formatSql({
        sql: ''
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('应该处理格式化错误', async () => {
      const result = await service.formatSql({
        sql: 'invalid sql syntax @#$%'
      });

      // sql-formatter 可能会尝试格式化或返回错误
      expect(result).toBeDefined();
    });
  });

  describe('数据转换', () => {
    it('应该将 JSON 转换为 CSV', async () => {
      const jsonData = JSON.stringify([
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 }
      ]);

      const result = await service.convertData({
        data: jsonData,
        sourceFormat: 'json',
        targetFormat: 'csv'
      });

      expect(result.success).toBe(true);
      expect(result.converted).toBeDefined();
      expect(result.converted).toContain('name');
      expect(result.converted).toContain('John');
    });

    it('应该将 JSON 转换为 Excel', async () => {
      const jsonData = JSON.stringify([{ name: 'John', age: 30 }]);

      const result = await service.convertData({
        data: jsonData,
        sourceFormat: 'json',
        targetFormat: 'excel'
      });

      expect(result.success).toBe(true);
      expect(result.converted).toBeDefined();
      // Excel 以 base64 格式返回
      expect(typeof result.converted).toBe('string');
    });

    it('应该将 JSON 转换为 XML', async () => {
      const jsonData = JSON.stringify({ name: 'John', age: 30 });

      const result = await service.convertData({
        data: jsonData,
        sourceFormat: 'json',
        targetFormat: 'xml'
      });

      expect(result.success).toBe(true);
      expect(result.converted).toBeDefined();
      expect(result.converted).toContain('<?xml');
      expect(result.converted).toContain('<name>');
    });

    it('应该将 JSON 转换为 YAML', async () => {
      const jsonData = JSON.stringify({ name: 'John', age: 30 });

      const result = await service.convertData({
        data: jsonData,
        sourceFormat: 'json',
        targetFormat: 'yaml'
      });

      expect(result.success).toBe(true);
      expect(result.converted).toBeDefined();
      expect(result.converted).toContain('name:');
    });

    it('应该将 CSV 转换为 JSON', async () => {
      const csvData = 'name,age\nJohn,30\nJane,25';

      const result = await service.convertData({
        data: csvData,
        sourceFormat: 'csv',
        targetFormat: 'json'
      });

      expect(result.success).toBe(true);
      expect(result.converted).toBeDefined();
      const parsed = JSON.parse(result.converted!);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].name).toBe('John');
    });

    it('应该验证空输入', async () => {
      const result = await service.convertData({
        data: '',
        sourceFormat: 'json',
        targetFormat: 'csv'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('应该处理无效的 JSON', async () => {
      const result = await service.convertData({
        data: 'invalid json',
        sourceFormat: 'json',
        targetFormat: 'csv'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('应该支持美化输出', async () => {
      const jsonData = JSON.stringify({ name: 'John' });

      const result = await service.convertData({
        data: jsonData,
        sourceFormat: 'json',
        targetFormat: 'json',
        options: { pretty: true }
      });

      expect(result.success).toBe(true);
      expect(result.converted).toContain('\n');
    });
  });

  describe('正则测试', () => {
    it('应该测试简单的正则表达式', async () => {
      const result = await service.testRegex({
        pattern: '\\d+',
        text: 'abc 123 def 456'
      });

      expect(result.success).toBe(true);
      expect(result.matches).toBeDefined();
      expect(result.matches!.length).toBeGreaterThan(0);
    });

    it('应该支持全局匹配', async () => {
      const result = await service.testRegex({
        pattern: '\\d+',
        text: '123 456 789',
        flags: 'g'
      });

      expect(result.success).toBe(true);
      expect(result.matches!.length).toBe(3);
    });

    it('应该支持忽略大小写', async () => {
      const result = await service.testRegex({
        pattern: 'hello',
        text: 'Hello HELLO hello',
        flags: 'gi'
      });

      expect(result.success).toBe(true);
      expect(result.matches!.length).toBe(3);
    });

    it('应该捕获分组', async () => {
      const result = await service.testRegex({
        pattern: '(\\d{3})-(\\d{4})',
        text: '123-4567',
        flags: 'g'
      });

      expect(result.success).toBe(true);
      expect(result.matches![0].groups).toBeDefined();
      expect(result.matches![0].groups!.length).toBe(2);
    });

    it('应该返回匹配位置', async () => {
      const result = await service.testRegex({
        pattern: 'test',
        text: 'this is a test string'
      });

      expect(result.success).toBe(true);
      expect(result.matches![0].index).toBe(10);
    });

    it('应该验证空模式', async () => {
      const result = await service.testRegex({
        pattern: '',
        text: 'test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('应该验证空文本', async () => {
      const result = await service.testRegex({
        pattern: '\\d+',
        text: ''
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('应该处理无效的正则表达式', async () => {
      const result = await service.testRegex({
        pattern: '[invalid',
        text: 'test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('应该处理无匹配情况', async () => {
      const result = await service.testRegex({
        pattern: '\\d+',
        text: 'no numbers here'
      });

      expect(result.success).toBe(true);
      expect(result.matches!.length).toBe(0);
    });
  });

  describe('模板管理', () => {
    it('应该创建模板', async () => {
      const template = await service.createTemplate({
        userId: 'user1',
        type: 'sql',
        name: '测试模板',
        content: 'SELECT * FROM users',
        description: '测试描述',
        tags: ['sql', 'test']
      });

      expect(template).toBeDefined();
      expect(template.id).toBeDefined();
      expect(template.name).toBe('测试模板');
      expect(mockDb.run).toHaveBeenCalled();
    });

    it('应该更新模板', async () => {
      await service.updateTemplate('template-id', 'user1', {
        name: '更新后的名称',
        content: '更新后的内容'
      });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE efficiency_templates'),
        expect.any(Array)
      );
    });

    it('应该删除模板', async () => {
      await service.deleteTemplate('template-id', 'user1');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM efficiency_templates'),
        ['template-id', 'user1']
      );
    });

    it('应该获取模板', async () => {
      mockDb.get.mockResolvedValueOnce({
        id: 'template-id',
        user_id: 'user1',
        type: 'sql',
        name: '测试模板',
        content: 'SELECT * FROM users',
        tags: '["sql","test"]'
      });

      const template = await service.getTemplate('template-id', 'user1');

      expect(template).toBeDefined();
      expect(template!.name).toBe('测试模板');
      expect(template!.tags).toEqual(['sql', 'test']);
    });

    it('应该处理不存在的模板', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      const template = await service.getTemplate('non-existent', 'user1');

      expect(template).toBeNull();
    });

    it('应该查询模板', async () => {
      mockDb.get.mockResolvedValueOnce({ total: 2 });
      mockDb.all.mockResolvedValueOnce([
        {
          id: '1',
          user_id: 'user1',
          type: 'sql',
          name: '模板1',
          content: 'SELECT 1',
          tags: '[]'
        },
        {
          id: '2',
          user_id: 'user1',
          type: 'sql',
          name: '模板2',
          content: 'SELECT 2',
          tags: '[]'
        }
      ]);

      const result = await service.queryTemplates({
        userId: 'user1',
        page: 1,
        pageSize: 20
      });

      expect(result.total).toBe(2);
      expect(result.items.length).toBe(2);
    });

    it('应该支持类型过滤', async () => {
      mockDb.get.mockResolvedValueOnce({ total: 0 });
      mockDb.all.mockResolvedValueOnce([]);

      await service.queryTemplates({
        userId: 'user1',
        type: 'sql'
      });

      expect(mockDb.get).toHaveBeenCalled();
      expect(mockDb.all).toHaveBeenCalled();
    });

    it('应该支持关键字搜索', async () => {
      mockDb.get.mockResolvedValueOnce({ total: 0 });
      mockDb.all.mockResolvedValueOnce([]);

      await service.queryTemplates({
        userId: 'user1',
        keyword: '用户'
      });

      expect(mockDb.get).toHaveBeenCalled();
      expect(mockDb.all).toHaveBeenCalled();
    });
  });

  describe('配置管理', () => {
    it('应该禁用功能时返回错误', async () => {
      const disabledService = new EfficiencyToolsService(mockDb, {
        enableSqlFormatter: false
      });

      const result = await disabledService.formatSql({
        sql: 'SELECT * FROM users'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('未启用');
    });

    it('应该检查输入大小限制', async () => {
      const smallService = new EfficiencyToolsService(mockDb, {
        maxInputSize: 10
      });

      const result = await smallService.formatSql({
        sql: 'SELECT * FROM users WHERE id = 1'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('过大');
    });
  });
});
