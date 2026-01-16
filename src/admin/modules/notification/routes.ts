/**
 * 通知中心 API 路由
 */

import { Router, Request, Response } from 'express';
import { notificationService, NotificationType } from './notificationService';
import { requirePermission } from '../../middleware/permission';
import type { ApiResponse } from '../../types';

const router = Router();

/** 成功响应 */
function success<T>(data: T): ApiResponse<T> {
  return { success: true, data, timestamp: Date.now() };
}

/** 错误响应 */
function error(code: string, message: string): ApiResponse {
  return { success: false, error: { code, message }, timestamp: Date.now() };
}

// 从请求中获取当前用户 ID（实际应从认证中间件获取）
function getCurrentUserId(req: Request): string {
  return (req as any).user?.id || 'anonymous';
}

/**
 * GET /notifications - 获取当前用户通知列表
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = getCurrentUserId(req);
    const params = {
      userId,
      type: req.query.type as NotificationType,
      read: req.query.read !== undefined ? req.query.read === 'true' : undefined,
      page: parseInt(req.query.page as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 20,
    };

    const result = await notificationService.getNotifications(params);
    res.json(success(result));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /notifications/unread-count - 获取未读数量
 */
router.get('/unread-count', async (req: Request, res: Response) => {
  try {
    const userId = getCurrentUserId(req);
    const count = await notificationService.getUnreadCount(userId);
    res.json(success({ count }));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /notifications/unread-count-by-type - 获取按类型分组的未读数量
 */
router.get('/unread-count-by-type', async (req: Request, res: Response) => {
  try {
    const userId = getCurrentUserId(req);
    const counts = await notificationService.getUnreadCountByType(userId);
    res.json(success(counts));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /notifications/:id - 获取单个通知
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = getCurrentUserId(req);
    const notification = await notificationService.getNotificationById(userId, req.params.id);
    if (!notification) {
      return res.status(404).json(error('RES_NOT_FOUND', '通知不存在'));
    }
    res.json(success(notification));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * POST /notifications - 创建通知（管理员）
 */
router.post('/', requirePermission('notification:create'), async (req: Request, res: Response) => {
  try {
    const { userId, type, title, content, link } = req.body;

    if (!userId || !type || !title || !content) {
      return res.status(400).json(error('VALID_PARAM_MISSING', '缺少必要参数'));
    }

    const notification = await notificationService.createNotification({
      userId,
      type,
      title,
      content,
      link,
    });

    res.status(201).json(success(notification));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * POST /notifications/broadcast - 广播通知（管理员）
 */
router.post('/broadcast', requirePermission('notification:create'), async (req: Request, res: Response) => {
  try {
    const { userIds, type, title, content, link } = req.body;

    if (!userIds || !Array.isArray(userIds) || !type || !title || !content) {
      return res.status(400).json(error('VALID_PARAM_MISSING', '缺少必要参数'));
    }

    const notifications = await notificationService.createBroadcast(userIds, {
      type,
      title,
      content,
      link,
    });

    res.status(201).json(success({ count: notifications.length }));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * PUT /notifications/:id/read - 标记为已读
 */
router.put('/:id/read', async (req: Request, res: Response) => {
  try {
    const userId = getCurrentUserId(req);
    const notification = await notificationService.markAsRead(userId, req.params.id);
    res.json(success(notification));
  } catch (err: any) {
    if (err.message.includes('不存在')) {
      return res.status(404).json(error('RES_NOT_FOUND', err.message));
    }
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * PUT /notifications/read-all - 全部标记为已读
 */
router.put('/read-all', async (req: Request, res: Response) => {
  try {
    const userId = getCurrentUserId(req);
    const count = await notificationService.markAllAsRead(userId);
    res.json(success({ count }));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * PUT /notifications/read-multiple - 批量标记为已读
 */
router.put('/read-multiple', async (req: Request, res: Response) => {
  try {
    const userId = getCurrentUserId(req);
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json(error('VALID_PARAM_MISSING', '缺少 ids 参数'));
    }

    const count = await notificationService.markMultipleAsRead(userId, ids);
    res.json(success({ count }));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * DELETE /notifications/:id - 删除通知
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = getCurrentUserId(req);
    await notificationService.deleteNotification(userId, req.params.id);
    res.json(success({ message: '删除成功' }));
  } catch (err: any) {
    if (err.message.includes('不存在')) {
      return res.status(404).json(error('RES_NOT_FOUND', err.message));
    }
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * DELETE /notifications/read - 删除所有已读通知
 */
router.delete('/read', async (req: Request, res: Response) => {
  try {
    const userId = getCurrentUserId(req);
    const count = await notificationService.deleteAllRead(userId);
    res.json(success({ count }));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

export default router;
