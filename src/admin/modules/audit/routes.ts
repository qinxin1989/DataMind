/**
 * 审计日志 API 路由
 */

import { Router, Request, Response } from 'express';
import { auditService } from './auditService';
import { requirePermission } from '../../middleware/permission';
import type { ApiResponse, AuditQueryParams, AuditAction } from '../../types';

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
 * GET /audit - 查询审计日志
 */
router.get('/', requirePermission('audit:view'), async (req: Request, res: Response) => {
  try {
    const params: AuditQueryParams = {
      userId: req.query.userId as string,
      action: req.query.action as AuditAction,
      resourceType: req.query.resourceType as string,
      startTime: req.query.startTime ? parseInt(req.query.startTime as string) : undefined,
      endTime: req.query.endTime ? parseInt(req.query.endTime as string) : undefined,
      page: parseInt(req.query.page as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 20,
    };

    const result = await auditService.query(params);
    res.json(success(result));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /audit/export - 导出审计日志
 */
router.get('/export', requirePermission('audit:export'), async (req: Request, res: Response) => {
  try {
    const params: AuditQueryParams = {
      userId: req.query.userId as string,
      action: req.query.action as AuditAction,
      resourceType: req.query.resourceType as string,
      startTime: req.query.startTime ? parseInt(req.query.startTime as string) : undefined,
      endTime: req.query.endTime ? parseInt(req.query.endTime as string) : undefined,
      page: 1,
      pageSize: 10000,
    };

    const format = (req.query.format as 'csv' | 'json') || 'json';
    const content = await auditService.export(params, format);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
    } else {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.json');
    }

    res.send(content);
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /audit/stats - 获取审计统计
 */
router.get('/stats', requirePermission('audit:view'), async (req: Request, res: Response) => {
  try {
    const startTime = req.query.startTime 
      ? parseInt(req.query.startTime as string) 
      : Date.now() - 7 * 24 * 60 * 60 * 1000;
    const endTime = req.query.endTime 
      ? parseInt(req.query.endTime as string) 
      : Date.now();

    const stats = await auditService.getStats(startTime, endTime);
    res.json(success(stats));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /audit/user/:userId/trail - 获取用户操作轨迹
 */
router.get('/user/:userId/trail', requirePermission('audit:view'), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const startTime = req.query.startTime 
      ? parseInt(req.query.startTime as string) 
      : Date.now() - 24 * 60 * 60 * 1000;
    const endTime = req.query.endTime 
      ? parseInt(req.query.endTime as string) 
      : Date.now();

    const trail = await auditService.getUserTrail(userId, startTime, endTime);
    res.json(success(trail));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

// ==================== 对话历史 API ====================

/**
 * GET /audit/chat-history - 查询对话历史
 * 管理员可以看所有对话历史，普通用户只能看自己的
 */
router.get('/chat-history', requirePermission('audit:view'), async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const isAdmin = currentUser?.role === 'admin' || currentUser?.permissions?.includes('*');
    
    // 非管理员强制只能查看自己的对话历史
    let userId = req.query.userId as string;
    if (!isAdmin) {
      userId = currentUser?.id || currentUser?.userId;
    }
    
    const params = {
      userId,
      datasourceId: req.query.datasourceId as string,
      keyword: req.query.keyword as string,
      startTime: req.query.startTime ? parseInt(req.query.startTime as string) : undefined,
      endTime: req.query.endTime ? parseInt(req.query.endTime as string) : undefined,
      page: parseInt(req.query.page as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 20,
    };

    const result = await auditService.queryChatHistory(params);
    res.json(success(result));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /audit/chat-history/stats - 获取对话历史统计
 */
router.get('/chat-history/stats', requirePermission('audit:view'), async (req: Request, res: Response) => {
  try {
    const startTime = req.query.startTime ? parseInt(req.query.startTime as string) : undefined;
    const endTime = req.query.endTime ? parseInt(req.query.endTime as string) : undefined;

    const stats = await auditService.getChatStats(startTime, endTime);
    res.json(success(stats));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * DELETE /audit/chat-history/:id - 删除对话历史
 */
router.delete('/chat-history/:id', requirePermission('audit:delete'), async (req: Request, res: Response) => {
  try {
    await auditService.deleteChatHistory(req.params.id);
    res.json(success({ message: '删除成功' }));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

export default router;
