/**
 * 示例模块服务层测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Pool } from 'mysql2/promise';
import { ExampleService } from '../../../modules/example/backend/service';
import type { CreateExampleDto, UpdateExampleDto } from '../../../modules/example/backend/types';

// Mock 数据库连接池
const mockDb = {
  query: vi.fn()
} as unknown as Pool;

describe('ExampleService', () => {
  let service: ExampleService;

  beforeEach(() => {
    service = new ExampleService(mockDb);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getList', () => {
    it('应该返回示例列表', async () => {
      const mockItems = [
        {
          id: '1',
          title: 'Test 1',
          description: 'Description 1',
          status: 'active',
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      // Mock count query
      vi.mocked(mockDb.query).mockResolvedValueOnce([
        [{ total: 1 }],
        []
      ] as any);

      // Mock list query
      vi.mocked(mockDb.query).mockResolvedValueOnce([
        mockItems,
        []
      ] as any);

      const result = await service.getList({ page: 1, pageSize: 10 });

      expect(result.items).toEqual(mockItems);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
    });

    it('应该支持状态筛选', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce([
        [{ total: 0 }],
        []
      ] as any);

      vi.mocked(mockDb.query).mockResolvedValueOnce([
        [],
        []
      ] as any);

      await service.getList({ status: 'active' });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('AND status = ?'),
        expect.arrayContaining(['active'])
      );
    });

    it('应该支持关键词搜索', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce([
        [{ total: 0 }],
        []
      ] as any);

      vi.mocked(mockDb.query).mockResolvedValueOnce([
        [],
        []
      ] as any);

      await service.getList({ keyword: 'test' });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('AND (title LIKE ? OR description LIKE ?)'),
        expect.arrayContaining(['%test%', '%test%'])
      );
    });
  });

  describe('getById', () => {
    it('应该返回指定ID的示例', async () => {
      const mockItem = {
        id: '1',
        title: 'Test',
        status: 'active'
      };

      vi.mocked(mockDb.query).mockResolvedValueOnce([
        [mockItem],
        []
      ] as any);

      const result = await service.getById('1');

      expect(result).toEqual(mockItem);
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM example_items WHERE id = ?',
        ['1']
      );
    });

    it('应该在找不到时返回null', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce([
        [],
        []
      ] as any);

      const result = await service.getById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('应该创建新示例', async () => {
      const dto: CreateExampleDto = {
        title: 'New Item',
        description: 'Description',
        status: 'active'
      };

      const mockItem = {
        id: expect.any(String),
        ...dto,
        created_at: expect.any(Date),
        updated_at: expect.any(Date)
      };

      // Mock insert
      vi.mocked(mockDb.query).mockResolvedValueOnce([
        { affectedRows: 1 },
        []
      ] as any);

      // Mock getById
      vi.mocked(mockDb.query).mockResolvedValueOnce([
        [mockItem],
        []
      ] as any);

      const result = await service.create(dto, 'user123');

      expect(result).toMatchObject({
        title: dto.title,
        description: dto.description,
        status: dto.status
      });
    });

    it('应该使用默认状态', async () => {
      const dto: CreateExampleDto = {
        title: 'New Item'
      };

      vi.mocked(mockDb.query).mockResolvedValueOnce([
        { affectedRows: 1 },
        []
      ] as any);

      vi.mocked(mockDb.query).mockResolvedValueOnce([
        [{ ...dto, status: 'active' }],
        []
      ] as any);

      const result = await service.create(dto);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['active'])
      );
    });
  });

  describe('update', () => {
    it('应该更新示例', async () => {
      const dto: UpdateExampleDto = {
        title: 'Updated Title'
      };

      const mockItem = {
        id: '1',
        title: 'Updated Title',
        status: 'active'
      };

      // Mock update
      vi.mocked(mockDb.query).mockResolvedValueOnce([
        { affectedRows: 1 },
        []
      ] as any);

      // Mock getById
      vi.mocked(mockDb.query).mockResolvedValueOnce([
        [mockItem],
        []
      ] as any);

      const result = await service.update('1', dto);

      expect(result.title).toBe('Updated Title');
    });

    it('应该在找不到时抛出错误', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce([
        { affectedRows: 0 },
        []
      ] as any);

      await expect(
        service.update('nonexistent', { title: 'Test' })
      ).rejects.toThrow('Example item not found');
    });

    it('应该在没有更新字段时返回原数据', async () => {
      const mockItem = {
        id: '1',
        title: 'Test',
        status: 'active'
      };

      vi.mocked(mockDb.query).mockResolvedValueOnce([
        [mockItem],
        []
      ] as any);

      const result = await service.update('1', {});

      expect(result).toEqual(mockItem);
    });
  });

  describe('delete', () => {
    it('应该删除示例', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce([
        { affectedRows: 1 },
        []
      ] as any);

      await expect(service.delete('1')).resolves.not.toThrow();
    });

    it('应该在找不到时抛出错误', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce([
        { affectedRows: 0 },
        []
      ] as any);

      await expect(service.delete('nonexistent')).rejects.toThrow(
        'Example item not found'
      );
    });
  });

  describe('batchDelete', () => {
    it('应该批量删除示例', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce([
        { affectedRows: 3 },
        []
      ] as any);

      const count = await service.batchDelete(['1', '2', '3']);

      expect(count).toBe(3);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM example_items WHERE id IN (?,?,?)'),
        ['1', '2', '3']
      );
    });

    it('应该在空数组时返回0', async () => {
      const count = await service.batchDelete([]);

      expect(count).toBe(0);
      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });
});
