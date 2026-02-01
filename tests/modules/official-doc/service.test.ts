/**
 * 公文写作服务测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OfficialDocService } from '../../../modules/official-doc/backend/service';

// Mock 数据库
const mockDb = {
  run: vi.fn().mockResolvedValue({}),
  get: vi.fn().mockResolvedValue({}),
  all: vi.fn().mockResolvedValue([])
};

// Mock AI 配置服务
const mockAIConfigService = {
  generate: vi.fn().mockResolvedValue({
    content: 'AI 生成的公文内容...'
  })
};

describe('OfficialDocService', () => {
  let service: OfficialDocService;

  beforeEach(() => {
    service = new OfficialDocService(mockDb);
    vi.clearAllMocks();
  });

  describe('初始化', () => {
    it('应该创建服务实例', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(OfficialDocService);
    });

    it('应该使用默认配置', () => {
      const defaultService = new OfficialDocService(mockDb);
      expect(defaultService).toBeDefined();
    });

    it('应该支持自定义配置', () => {
      const customService = new OfficialDocService(mockDb, {
        enableAI: false,
        maxPointsLength: 3000
      });
      expect(customService).toBeDefined();
    });

    it('应该设置 AI 配置服务', () => {
      service.setAIConfigService(mockAIConfigService);
      expect(() => service.setAIConfigService(mockAIConfigService)).not.toThrow();
    });
  });

  describe('公文生成', () => {
    it('应该验证空要点', async () => {
      const result = await service.generateDoc({
        type: 'report',
        style: 'formal',
        points: ''
      }, 'user1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('请输入核心要点');
    });

    it('应该验证要点长度', async () => {
      const longPoints = 'a'.repeat(6000);
      const result = await service.generateDoc({
        type: 'report',
        style: 'formal',
        points: longPoints
      }, 'user1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('过长');
    });

    it('应该使用模板生成公文', async () => {
      const result = await service.generateDoc({
        type: 'report',
        style: 'formal',
        points: '本月完成了重要工作'
      }, 'user1');

      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
      expect(result.content).toContain('工作报告');
      expect(result.historyId).toBeDefined();
    });

    it('应该生成通知公告', async () => {
      const result = await service.generateDoc({
        type: 'notice',
        style: 'formal',
        points: '重要通知事项'
      }, 'user1');

      expect(result.success).toBe(true);
      expect(result.content).toContain('通知公告');
    });

    it('应该生成会议纪要', async () => {
      const result = await service.generateDoc({
        type: 'summary',
        style: 'concise',
        points: '会议讨论内容'
      }, 'user1');

      expect(result.success).toBe(true);
      expect(result.content).toContain('会议纪要');
    });

    it('应该生成计划方案', async () => {
      const result = await service.generateDoc({
        type: 'plan',
        style: 'enthusiastic',
        points: '下季度工作计划'
      }, 'user1');

      expect(result.success).toBe(true);
      expect(result.content).toContain('计划方案');
    });

    it('应该支持不同文风', async () => {
      const styles: Array<'formal' | 'concise' | 'enthusiastic'> = ['formal', 'concise', 'enthusiastic'];

      for (const style of styles) {
        const result = await service.generateDoc({
          type: 'report',
          style,
          points: '测试内容'
        }, 'user1');

        expect(result.success).toBe(true);
        expect(result.content).toBeDefined();
      }
    });

    it('应该使用 AI 生成公文', async () => {
      service.setAIConfigService(mockAIConfigService);

      const result = await service.generateDoc({
        type: 'report',
        style: 'formal',
        points: '测试 AI 生成'
      }, 'user1');

      expect(result.success).toBe(true);
      expect(mockAIConfigService.generate).toHaveBeenCalled();
    });

    it('应该在 AI 失败时降级到模板', async () => {
      const failingAI = {
        generate: vi.fn().mockRejectedValue(new Error('AI 服务不可用'))
      };
      service.setAIConfigService(failingAI);

      const result = await service.generateDoc({
        type: 'report',
        style: 'formal',
        points: '测试降级'
      }, 'user1');

      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
    });
  });

  describe('模板管理', () => {
    it('应该创建模板', async () => {
      const template = await service.createTemplate({
        userId: 'user1',
        name: '测试模板',
        type: 'report',
        content: '模板内容 {{points}}',
        style: 'formal',
        isSystem: false,
        isPublic: false,
        description: '测试描述'
      });

      expect(template).toBeDefined();
      expect(template.id).toBeDefined();
      expect(template.name).toBe('测试模板');
      expect(mockDb.run).toHaveBeenCalled();
    });

    it('应该更新模板', async () => {
      await service.updateTemplate('template-id', {
        name: '更新后的名称',
        content: '更新后的内容'
      });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE official_doc_templates'),
        expect.any(Array)
      );
    });

    it('应该删除模板', async () => {
      await service.deleteTemplate('template-id');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM official_doc_templates'),
        ['template-id']
      );
    });

    it('应该获取模板', async () => {
      mockDb.get.mockResolvedValueOnce({
        id: 'template-id',
        user_id: 'user1',
        name: '测试模板',
        type: 'report',
        content: '模板内容',
        style: 'formal',
        is_system: 0,
        is_public: 0,
        description: '描述',
        created_at: Date.now(),
        updated_at: Date.now()
      });

      const template = await service.getTemplate('template-id');

      expect(template).toBeDefined();
      expect(template!.name).toBe('测试模板');
    });

    it('应该处理不存在的模板', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      const template = await service.getTemplate('non-existent');

      expect(template).toBeNull();
    });

    it('应该查询模板', async () => {
      mockDb.get.mockResolvedValueOnce({ total: 2 });
      mockDb.all.mockResolvedValueOnce([
        {
          id: '1',
          user_id: 'user1',
          name: '模板1',
          type: 'report',
          content: '内容1',
          style: 'formal',
          is_system: 0,
          is_public: 0,
          created_at: Date.now(),
          updated_at: Date.now()
        },
        {
          id: '2',
          user_id: 'user1',
          name: '模板2',
          type: 'notice',
          content: '内容2',
          style: 'concise',
          is_system: 0,
          is_public: 1,
          created_at: Date.now(),
          updated_at: Date.now()
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
        type: 'report'
      });

      expect(mockDb.get).toHaveBeenCalled();
      expect(mockDb.all).toHaveBeenCalled();
    });

    it('应该支持系统模板过滤', async () => {
      mockDb.get.mockResolvedValueOnce({ total: 0 });
      mockDb.all.mockResolvedValueOnce([]);

      await service.queryTemplates({
        isSystem: true
      });

      expect(mockDb.get).toHaveBeenCalled();
    });

    it('应该支持公开模板过滤', async () => {
      mockDb.get.mockResolvedValueOnce({ total: 0 });
      mockDb.all.mockResolvedValueOnce([]);

      await service.queryTemplates({
        isPublic: true
      });

      expect(mockDb.get).toHaveBeenCalled();
    });

    it('应该支持关键字搜索', async () => {
      mockDb.get.mockResolvedValueOnce({ total: 0 });
      mockDb.all.mockResolvedValueOnce([]);

      await service.queryTemplates({
        keyword: '报告'
      });

      expect(mockDb.get).toHaveBeenCalled();
    });
  });

  describe('历史记录', () => {
    it('应该获取历史记录', async () => {
      mockDb.get.mockResolvedValueOnce({ total: 1 });
      mockDb.all.mockResolvedValueOnce([
        {
          id: '1',
          user_id: 'user1',
          template_id: null,
          type: 'report',
          style: 'formal',
          points: '测试要点',
          result: '生成结果',
          status: 'success',
          error_message: null,
          created_at: Date.now()
        }
      ]);

      const result = await service.getHistory({
        userId: 'user1',
        page: 1,
        pageSize: 20
      });

      expect(result.total).toBe(1);
      expect(result.items.length).toBe(1);
      expect(result.items[0].status).toBe('success');
    });

    it('应该支持类型过滤', async () => {
      mockDb.get.mockResolvedValueOnce({ total: 0 });
      mockDb.all.mockResolvedValueOnce([]);

      await service.getHistory({
        userId: 'user1',
        type: 'report'
      });

      expect(mockDb.get).toHaveBeenCalled();
    });

    it('应该支持状态过滤', async () => {
      mockDb.get.mockResolvedValueOnce({ total: 0 });
      mockDb.all.mockResolvedValueOnce([]);

      await service.getHistory({
        userId: 'user1',
        status: 'success'
      });

      expect(mockDb.get).toHaveBeenCalled();
    });

    it('应该支持日期范围过滤', async () => {
      mockDb.get.mockResolvedValueOnce({ total: 0 });
      mockDb.all.mockResolvedValueOnce([]);

      const startDate = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const endDate = Date.now();

      await service.getHistory({
        userId: 'user1',
        startDate,
        endDate
      });

      expect(mockDb.get).toHaveBeenCalled();
    });

    it('应该删除历史记录', async () => {
      await service.deleteHistory('history-id', 'user1');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM official_doc_history'),
        ['history-id', 'user1']
      );
    });

    it('应该清理过期历史', async () => {
      const expiredRecords = [
        {
          id: '1',
          created_at: Date.now() - 100 * 24 * 60 * 60 * 1000
        },
        {
          id: '2',
          created_at: Date.now() - 95 * 24 * 60 * 60 * 1000
        }
      ];

      mockDb.get.mockResolvedValueOnce({ total: 2 });
      mockDb.run.mockResolvedValueOnce({});

      const count = await service.cleanupExpiredHistory();

      expect(count).toBe(2);
      expect(mockDb.run).toHaveBeenCalled();
    });
  });

  describe('配置管理', () => {
    it('应该禁用模板功能时返回错误', async () => {
      const disabledService = new OfficialDocService(mockDb, {
        enableTemplates: false
      });

      await expect(
        disabledService.createTemplate({
          userId: 'user1',
          name: '测试',
          type: 'report',
          content: '内容',
          style: 'formal',
          isSystem: false,
          isPublic: false
        })
      ).rejects.toThrow('模板功能未启用');
    });

    it('应该使用自定义历史保留天数', () => {
      const customService = new OfficialDocService(mockDb, {
        maxHistoryDays: 30
      });
      expect(customService).toBeDefined();
    });
  });
});
