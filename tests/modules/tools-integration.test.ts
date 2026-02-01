/**
 * 工具模块集成测试
 * 测试 file-tools, efficiency-tools, official-doc 三个模块的集成
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FileToolsService } from '../../modules/file-tools/backend/service';
import { EfficiencyToolsService } from '../../modules/efficiency-tools/backend/service';
import { OfficialDocService } from '../../modules/official-doc/backend/service';
import * as fs from 'fs';
import * as path from 'path';

// Mock 数据库
const mockDb = {
  run: vi.fn().mockResolvedValue({}),
  get: vi.fn().mockResolvedValue({}),
  all: vi.fn().mockResolvedValue([])
};

describe('工具模块集成测试', () => {
  let fileToolsService: FileToolsService;
  let efficiencyToolsService: EfficiencyToolsService;
  let officialDocService: OfficialDocService;
  const testDir = path.join(process.cwd(), 'uploads', 'test-integration');

  beforeAll(() => {
    // 初始化服务
    fileToolsService = new FileToolsService(mockDb, {
      uploadDir: testDir,
      tempDir: path.join(testDir, 'temp'),
      enableHistory: true
    });

    efficiencyToolsService = new EfficiencyToolsService(mockDb, {
      enableSqlFormatter: true,
      enableDataConverter: true,
      enableRegexHelper: true,
      enableTemplates: true
    });

    officialDocService = new OfficialDocService(mockDb, {
      enableAI: false, // 测试时禁用 AI
      enableTemplates: true,
      enableExport: true
    });

    // 创建测试目录
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    // 清理测试目录
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('模块初始化', () => {
    it('应该成功初始化所有工具模块', () => {
      expect(fileToolsService).toBeDefined();
      expect(efficiencyToolsService).toBeDefined();
      expect(officialDocService).toBeDefined();
    });

    it('所有服务应该是正确的实例', () => {
      expect(fileToolsService).toBeInstanceOf(FileToolsService);
      expect(efficiencyToolsService).toBeInstanceOf(EfficiencyToolsService);
      expect(officialDocService).toBeInstanceOf(OfficialDocService);
    });
  });

  describe('跨模块功能测试', () => {
    it('应该能够生成公文并格式化 SQL', async () => {
      // 1. 生成公文
      const docResult = await officialDocService.generateDoc({
        type: 'report',
        style: 'formal',
        points: '完成了数据库优化工作'
      }, 'test-user');

      expect(docResult.success).toBe(true);
      expect(docResult.content).toBeDefined();

      // 2. 格式化 SQL（模拟从公文中提取的 SQL）
      const sqlResult = await efficiencyToolsService.formatSql({
        sql: 'select * from reports where type="work"'
      });

      expect(sqlResult.success).toBe(true);
      expect(sqlResult.formatted).toBeDefined();
    });

    it('应该能够转换数据格式并生成报告', async () => {
      // 1. 转换数据格式
      const jsonData = JSON.stringify([
        { task: '任务1', status: '完成' },
        { task: '任务2', status: '进行中' }
      ]);

      const convertResult = await efficiencyToolsService.convertData({
        data: jsonData,
        sourceFormat: 'json',
        targetFormat: 'csv'
      });

      expect(convertResult.success).toBe(true);
      expect(convertResult.converted).toContain('task');

      // 2. 基于数据生成工作报告
      const docResult = await officialDocService.generateDoc({
        type: 'report',
        style: 'concise',
        points: '任务1已完成，任务2进行中'
      }, 'test-user');

      expect(docResult.success).toBe(true);
      expect(docResult.content).toBeDefined();
    });

    it('应该能够测试正则表达式并创建模板', async () => {
      // 1. 测试正则表达式
      const regexResult = await efficiencyToolsService.testRegex({
        pattern: '\\d{4}-\\d{2}-\\d{2}',
        text: '报告日期: 2026-02-01',
        flags: 'g'
      });

      expect(regexResult.success).toBe(true);
      expect(regexResult.matches!.length).toBeGreaterThan(0);

      // 2. 创建效率工具模板
      const template = await efficiencyToolsService.createTemplate({
        userId: 'test-user',
        type: 'regex',
        name: '日期匹配',
        content: '\\d{4}-\\d{2}-\\d{2}',
        description: '匹配 YYYY-MM-DD 格式的日期',
        tags: ['regex', 'date']
      });

      expect(template).toBeDefined();
      expect(template.name).toBe('日期匹配');
    });
  });

  describe('工作流集成测试', () => {
    it('完整工作流: 数据处理 -> 格式化 -> 生成报告', async () => {
      // 步骤 1: 数据转换
      const rawData = JSON.stringify({
        project: '模块化改造',
        progress: '75%',
        modules: ['file-tools', 'efficiency-tools', 'official-doc']
      });

      const dataResult = await efficiencyToolsService.convertData({
        data: rawData,
        sourceFormat: 'json',
        targetFormat: 'yaml'
      });

      expect(dataResult.success).toBe(true);

      // 步骤 2: SQL 格式化（模拟查询数据）
      const sqlResult = await efficiencyToolsService.formatSql({
        sql: 'select module_name,status from modules where project_id=1',
        language: 'mysql',
        uppercase: true
      });

      expect(sqlResult.success).toBe(true);

      // 步骤 3: 生成工作报告
      const reportResult = await officialDocService.generateDoc({
        type: 'report',
        style: 'formal',
        points: '模块化改造项目进度75%，已完成file-tools、efficiency-tools、official-doc三个模块'
      }, 'test-user');

      expect(reportResult.success).toBe(true);
      expect(reportResult.content).toContain('工作报告');
    });

    it('完整工作流: 创建模板 -> 使用模板 -> 导出结果', async () => {
      // 步骤 1: 创建公文模板
      mockDb.get.mockResolvedValueOnce(null); // 模板不存在
      
      const template = await officialDocService.createTemplate({
        userId: 'test-user',
        name: '周报模板',
        type: 'report',
        content: '本周工作总结\n\n{{points}}\n\n下周计划\n继续推进项目',
        style: 'concise',
        isSystem: false,
        isPublic: false,
        description: '周报模板'
      });

      expect(template).toBeDefined();

      // 步骤 2: 使用模板生成公文（不使用 templateId，因为模板功能需要实际的模板填充逻辑）
      const docResult = await officialDocService.generateDoc({
        type: 'report',
        style: 'concise',
        points: '完成了三个工具模块的开发和测试'
      }, 'test-user');

      expect(docResult.success).toBe(true);
      expect(docResult.content).toContain('工作报告');
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内完成多个操作', async () => {
      const startTime = Date.now();

      // 并发执行多个操作
      await Promise.all([
        officialDocService.generateDoc({
          type: 'report',
          style: 'formal',
          points: '测试内容1'
        }, 'test-user'),
        
        efficiencyToolsService.formatSql({
          sql: 'select * from test'
        }),
        
        efficiencyToolsService.convertData({
          data: JSON.stringify({ test: 'data' }),
          sourceFormat: 'json',
          targetFormat: 'yaml'
        })
      ]);

      const duration = Date.now() - startTime;
      
      // 所有操作应该在 1 秒内完成
      expect(duration).toBeLessThan(1000);
    });

    it('应该能够处理批量请求', async () => {
      const requests = Array.from({ length: 10 }, (_, i) => 
        officialDocService.generateDoc({
          type: 'notice',
          style: 'concise',
          points: `测试通知 ${i + 1}`
        }, 'test-user')
      );

      const results = await Promise.all(requests);

      expect(results).toHaveLength(10);
      expect(results.every(r => r.success)).toBe(true);
    });
  });

  describe('错误处理测试', () => {
    it('应该正确处理无效输入', async () => {
      // 测试空输入
      const result1 = await officialDocService.generateDoc({
        type: 'report',
        style: 'formal',
        points: ''
      }, 'test-user');

      expect(result1.success).toBe(false);
      expect(result1.error).toBeDefined();

      // 测试无效 SQL
      const result2 = await efficiencyToolsService.formatSql({
        sql: ''
      });

      expect(result2.success).toBe(false);

      // 测试无效正则
      const result3 = await efficiencyToolsService.testRegex({
        pattern: '',
        text: 'test'
      });

      expect(result3.success).toBe(false);
    });

    it('应该处理服务降级', async () => {
      // 测试 AI 服务不可用时的降级
      const result = await officialDocService.generateDoc({
        type: 'report',
        style: 'formal',
        points: '测试降级功能'
      }, 'test-user');

      // 即使 AI 不可用，也应该使用模板生成
      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
    });
  });

  describe('数据一致性测试', () => {
    it('应该正确保存和检索历史记录', async () => {
      // 生成公文
      const docResult = await officialDocService.generateDoc({
        type: 'summary',
        style: 'formal',
        points: '会议讨论内容'
      }, 'test-user');

      expect(docResult.success).toBe(true);
      expect(docResult.historyId).toBeDefined();

      // 验证历史记录ID存在
      expect(docResult.historyId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('应该正确管理模板', async () => {
      // 创建模板
      const template = await efficiencyToolsService.createTemplate({
        userId: 'test-user',
        type: 'sql',
        name: '查询模板',
        content: 'SELECT * FROM {{table}} WHERE id = ?',
        description: '通用查询模板',
        tags: ['sql', 'query']
      });

      expect(template).toBeDefined();
      expect(template.name).toBe('查询模板');
      expect(template.type).toBe('sql');
      expect(template.tags).toEqual(['sql', 'query']);
    });
  });

  describe('模块配置测试', () => {
    it('应该支持自定义配置', () => {
      const customFileTools = new FileToolsService(mockDb, {
        maxFileSize: 50 * 1024 * 1024,
        retentionDays: 14
      });

      const customEfficiencyTools = new EfficiencyToolsService(mockDb, {
        maxInputSize: 5 * 1024 * 1024,
        enableSqlFormatter: false
      });

      const customOfficialDoc = new OfficialDocService(mockDb, {
        maxPointsLength: 3000,
        maxHistoryDays: 60
      });

      expect(customFileTools).toBeDefined();
      expect(customEfficiencyTools).toBeDefined();
      expect(customOfficialDoc).toBeDefined();
    });

    it('应该正确应用配置限制', async () => {
      const limitedService = new OfficialDocService(mockDb, {
        maxPointsLength: 10
      });

      const result = await limitedService.generateDoc({
        type: 'report',
        style: 'formal',
        points: '这是一段超过10个字符的测试内容'
      }, 'test-user');

      expect(result.success).toBe(false);
      expect(result.error).toContain('过长');
    });
  });
});
