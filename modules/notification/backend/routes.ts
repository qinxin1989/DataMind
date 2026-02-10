/**
 * 通知模块路由
 */

import { Router, Request, Response } from 'express';
import { notificationService } from './service';
import { requirePermission } from '../../../src/admin/middleware/permission';
import { success, error } from '../../../src/admin/utils/response';
import type { NotificationQueryParams, CreateNotificationDto, BroadcastNotificationDto } from './types';

const router = Router();

// 从请求中获取当前用户 ID
function getCurrentUserId(req: Request): string {
  return (req as any).user?.id || 'anonymous';
}

// ==================== 通知查询 ====================

/**
 * GET / - 获取当前用户通知列表
 */
router.get('/', requirePermission('notification:view'), async (req: Request, res: Response) => {
  try {
    const userId = getCurrentUserId(req);
    const params: NotificationQueryParams = {
      userId,
      type: req.query.type as any,
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
 * GET /unread-count - 获取未读数量
 */
router.get('/unread-count', requirePermission('notification:view'), async (req: Request, res: Response) => {
  try {
    const userId = getCurrentUserId(req);
    const count = await notificationService.getUnreadCount(userId);
    res.json(success({ count }));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /unread-count-by-type - 获取按类型分组的未读数量
 */
router.get('/unread-count-by-type', requirePermission('notification:view'), async (req: Request, res: Response) => {
  try {
    const userId = getCurrentUserId(req);
    const counts = await notificationService.getUnreadCountByType(userId);
    res.json(success(counts));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /:id - 获取单个通知
 */
router.get('/:id', requirePermission('notification:view'), async (req: Request, res: Response) => {
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

// ==================== 通知创建 ====================

/**
 * POST / - 创建通知（管理员）
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
 * POST /broadcast - 广播通知（管理员）
 */
router.post('/broadcast', requirePermission('notification:create'), async (req: Request, res: Response) => {
  try {
    const { userIds, type, title, content, link } = req.body;

    if (!userIds || !Array.isArray(userIds) || !type || !title || !content) {
      return res.status(400).json(error('VALID_PARAM_MISSING', '缺少必要参数'));
    }

    const notifications = await notificationService.createBroadcast({ userIds, type, title, content, link });
    res.status(201).json(success({ count: notifications.length }));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

// ==================== 已读状态管理 ====================

/**
 * PUT /:id/read - 标记为已读
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
 * PUT /read-all - 全部标记为已读
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
 * PUT /read-multiple - 批量标记为已读
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

// ==================== 通知删除 ====================

/**
 * DELETE /:id - 删除通知
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
 * DELETE /read - 删除所有已读通知
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
