/**
 * 文件工具服务测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileToolsService } from '../../../modules/file-tools/backend/service';
import * as fs from 'fs';
import * as path from 'path';

// Mock 数据库
const mockDb = {
  run: vi.fn().mockResolvedValue({}),
  get: vi.fn().mockResolvedValue({}),
  all: vi.fn().mockResolvedValue([])
};

describe('FileToolsService', () => {
  let service: FileToolsService;
  const testUploadDir = path.join(process.cwd(), 'uploads', 'test-file-tools');

  beforeEach(() => {
    service = new FileToolsService(mockDb, {
      uploadDir: testUploadDir,
      tempDir: path.join(testUploadDir, 'temp'),
      enableHistory: true
    });

    // 确保测试目录存在
    if (!fs.existsSync(testUploadDir)) {
      fs.mkdirSync(testUploadDir, { recursive: true });
    }

    // 重置 mock
    vi.clearAllMocks();
  });

  afterEach(() => {
    // 清理测试目录
    if (fs.existsSync(testUploadDir)) {
      fs.rmSync(testUploadDir, { recursive: true, force: true });
    }
  });

  describe('初始化', () => {
    it('应该创建服务实例', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(FileToolsService);
    });

    it('应该创建必要的目录', () => {
      expect(fs.existsSync(testUploadDir)).toBe(true);
    });
  });

  describe('文件路径管理', () => {
    it('应该返回正确的文件路径', () => {
      const fileId = 'test-file-id.txt';
      const filePath = service.getFilePath(fileId);
      expect(filePath).toContain(testUploadDir);
      expect(filePath).toContain(fileId);
    });

    it('应该检查文件是否存在', () => {
      const fileId = 'non-existent.txt';
      expect(service.fileExists(fileId)).toBe(false);

      // 创建测试文件
      const filePath = service.getFilePath(fileId);
      fs.writeFileSync(filePath, 'test content');
      expect(service.fileExists(fileId)).toBe(true);
    });
  });

  describe('文件清理', () => {
    it('应该清理文件', () => {
      const testFile = path.join(testUploadDir, 'test-cleanup.txt');
      fs.writeFileSync(testFile, 'test');
      expect(fs.existsSync(testFile)).toBe(true);

      service.cleanupFile(testFile);
      expect(fs.existsSync(testFile)).toBe(false);
    });

    it('应该处理不存在的文件', () => {
      const nonExistentFile = path.join(testUploadDir, 'non-existent.txt');
      expect(() => service.cleanupFile(nonExistentFile)).not.toThrow();
    });
  });

  describe('历史记录管理', () => {
    it('应该获取历史记录', async () => {
      const mockHistory = [
        {
          id: '1',
          userId: 'user1',
          sourceFormat: 'pdf',
          targetFormat: 'txt',
          originalFilename: 'test.pdf',
          status: 'success',
          createdAt: Date.now()
        }
      ];

      mockDb.get.mockResolvedValueOnce({ total: 1 });
      mockDb.all.mockResolvedValueOnce(mockHistory);

      const result = await service.getHistory({
        userId: 'user1',
        page: 1,
        pageSize: 20
      });

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('1');
    });

    it('应该支持状态过滤', async () => {
      mockDb.get.mockResolvedValueOnce({ total: 0 });
      mockDb.all.mockResolvedValueOnce([]);

      await service.getHistory({
        userId: 'user1',
        status: 'success'
      });

      expect(mockDb.get).toHaveBeenCalled();
      expect(mockDb.all).toHaveBeenCalled();
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
      expect(mockDb.all).toHaveBeenCalled();
    });

    it('应该删除历史记录', async () => {
      await service.deleteHistory('history-id', 'user1');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM file_conversion_history'),
        ['history-id', 'user1']
      );
    });
  });

  describe('清理过期文件', () => {
    it('应该清理过期文件', async () => {
      const expiredRecords = [
        {
          id: '1',
          result_filename: 'expired-file.txt',
          createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000
        }
      ];

      mockDb.all.mockResolvedValueOnce(expiredRecords);
      mockDb.run.mockResolvedValueOnce({});

      // 创建测试文件
      const testFile = service.getFilePath('expired-file.txt');
      fs.writeFileSync(testFile, 'test');

      const cleanedCount = await service.cleanupExpiredFiles();

      expect(cleanedCount).toBe(1);
      expect(fs.existsSync(testFile)).toBe(false);
    });

    it('应该处理不存在的过期文件', async () => {
      const expiredRecords = [
        {
          id: '1',
          result_filename: 'non-existent.txt',
          createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000
        }
      ];

      mockDb.all.mockResolvedValueOnce(expiredRecords);
      mockDb.run.mockResolvedValueOnce({});

      const cleanedCount = await service.cleanupExpiredFiles();

      expect(cleanedCount).toBe(1);
    });
  });

  describe('文件格式转换', () => {
    it('应该验证必需参数', async () => {
      await expect(
        service.convertFiles({
          files: [],
          sourceFormat: 'pdf',
          targetFormat: 'txt'
        }, 'user1')
      ).rejects.toThrow('请上传文件');
    });

    it('应该验证格式参数', async () => {
      const mockFile = {
        originalname: 'test.pdf',
        path: '/tmp/test.pdf',
        size: 1024
      } as any;

      await expect(
        service.convertFiles({
          files: [mockFile],
          sourceFormat: '' as any,
          targetFormat: 'txt'
        }, 'user1')
      ).rejects.toThrow('请指定源格式和目标格式');
    });
  });

  describe('配置管理', () => {
    it('应该使用默认配置', () => {
      const defaultService = new FileToolsService(mockDb);
      expect(defaultService).toBeDefined();
    });

    it('应该支持自定义配置', () => {
      const customService = new FileToolsService(mockDb, {
        maxFileSize: 50 * 1024 * 1024,
        retentionDays: 14,
        enableHistory: false
      });
      expect(customService).toBeDefined();
    });
  });
});
