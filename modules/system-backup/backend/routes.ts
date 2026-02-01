/**
 * 系统备份模块路由
 */

import { Router, Request, Response } from 'express';
import { SystemBackupService } from './service';
import type { ApiResponse } from '../../../src/admin/types';

const router = Router();

/** 成功响应 */
function success<T>(data: T): ApiResponse<T> {
  return { success: true, data, timestamp: Date.now() };
}

/** 错误响应 */
function error(code: string, message: string): ApiResponse {
  return { success: false, error: { code, message }, timestamp: Date.now() };
}

/**
 * 初始化路由
 */
export function initRoutes(db: any): Router {
  const service = new SystemBackupService(db);

  // ==================== 备份管理 ====================

  /**
   * GET /api/modules/system-backup/backups - 获取备份列表
   */
  router.get('/backups', async (req: Request, res: Response) => {
    try {
      const {
        status,
        createdBy,
        startDate,
        endDate,
        page,
        pageSize
      } = req.query;

      const result = await service.queryBackups({
        status: status as any,
        createdBy: createdBy as string,
        startDate: startDate ? Number(startDate) : undefined,
        endDate: endDate ? Number(endDate) : undefined,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined
      });

      res.json(success(result));
    } catch (err: any) {
      res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
  });

  /**
   * GET /api/modules/system-backup/backups/:id - 获取备份详情
   */
  router.get('/backups/:id', async (req: Request, res: Response) => {
    try {
      const backup = await service.getBackup(req.params.id);
      if (!backup) {
        return res.status(404).json(error('RES_NOT_FOUND', '备份不存在'));
      }
      res.json(success(backup));
    } catch (err: any) {
      res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
  });

  /**
   * POST /api/modules/system-backup/backups - 创建备份
   */
  router.post('/backups', async (req: Request, res: Response) => {
    try {
      const backup = await service.createBackup(req.body);
      res.status(201).json(success(backup));
    } catch (err: any) {
      res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
  });

  /**
   * DELETE /api/modules/system-backup/backups/:id - 删除备份
   */
  router.delete('/backups/:id', async (req: Request, res: Response) => {
    try {
      await service.deleteBackup(req.params.id);
      res.json(success({ message: '删除成功' }));
    } catch (err: any) {
      if (err.message.includes('不存在')) {
        return res.status(404).json(error('RES_NOT_FOUND', err.message));
      }
      res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
  });

  // ==================== 恢复功能 ====================

  /**
   * POST /api/modules/system-backup/backups/:id/restore - 恢复备份
   */
  router.post('/backups/:id/restore', async (req: Request, res: Response) => {
    try {
      const result = await service.restoreBackup(req.params.id);
      res.json(success(result));
    } catch (err: any) {
      if (err.message.includes('不存在')) {
        return res.status(404).json(error('RES_NOT_FOUND', err.message));
      }
      res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
  });

  // ==================== 验证功能 ====================

  /**
   * GET /api/modules/system-backup/backups/:id/verify - 验证备份
   */
  router.get('/backups/:id/verify', async (req: Request, res: Response) => {
    try {
      const result = await service.verifyBackup(req.params.id);
      res.json(success(result));
    } catch (err: any) {
      res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
  });

  // ==================== 导出功能 ====================

  /**
   * GET /api/modules/system-backup/backups/:id/export - 导出备份
   */
  router.get('/backups/:id/export', async (req: Request, res: Response) => {
    try {
      const content = await service.exportBackup(req.params.id);
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=backup-${req.params.id}.json`);
      res.send(content);
    } catch (err: any) {
      if (err.message.includes('不存在')) {
        return res.status(404).json(error('RES_NOT_FOUND', err.message));
      }
      res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
  });

  /**
   * GET /api/modules/system-backup/backups/:id/download - 下载备份
   */
  router.get('/backups/:id/download', async (req: Request, res: Response) => {
    try {
      const backup = await service.getBackup(req.params.id);
      if (!backup) {
        return res.status(404).json(error('RES_NOT_FOUND', '备份不存在'));
      }

      // 实际项目中应该打包成zip文件
      const content = await service.exportBackup(req.params.id);
      
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename=${backup.name}.json`);
      res.send(content);
    } catch (err: any) {
      res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
  });

  // ==================== 清理功能 ====================

  /**
   * POST /api/modules/system-backup/cleanup - 清理过期备份
   */
  router.post('/cleanup', async (req: Request, res: Response) => {
    try {
      const count = await service.cleanupOldBackups();
      res.json(success({ count, message: `已清理 ${count} 个过期备份` }));
    } catch (err: any) {
      res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
  });

  return router;
}

export default router;
