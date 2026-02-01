/**
 * 通知模块路由
 */

import { Router, Request, Response } from 'express';
import { notificationService } from './service';
import type { NotificationQueryParams, CreateNotificationDto, BroadcastNotificationDto } from './types';

const router = Router();

// ==================== 通知查询 ====================

/**
 * 获取通知列表
 * GET /api/notifications
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || req.query.userId as string;
    if (!userId) {
      return res.status(401).json({ error: '未授权' });
    }

    const params: NotificationQueryParams = {
      userId,
      type: req.query.type as any,
      read: req.query.read === 'true' ? true : req.query.read === 'false' ? false : undefined,
      page: parseInt(req.query.page as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 10,
    };

    const result = await notificationService.getNotifications(params);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取通知详情
 * GET /api/notifications/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || req.query.userId as string;
    if (!userId) {
      return res.status(401).json({ error: '未授权' });
    }

    const notification = await notificationService.getNotificationById(userId, req.params.id);
    if (!notification) {
      return res.status(404).json({ error: '通知不存在' });
    }

    res.json(notification);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取未读数量
 * GET /api/notifications/unread-count
 */
router.get('/stats/unread-count', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || req.query.userId as string;
    if (!userId) {
      return res.status(401).json({ error: '未授权' });
    }

    const count = await notificationService.getUnreadCount(userId);
    res.json({ count });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取按类型分组的未读数量
 * GET /api/notifications/unread-count-by-type
 */
router.get('/stats/unread-count-by-type', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || req.query.userId as string;
    if (!userId) {
      return res.status(401).json({ error: '未授权' });
    }

    const counts = await notificationService.getUnreadCountByType(userId);
    res.json(counts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 通知创建 ====================

/**
 * 创建通知
 * POST /api/notifications
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const data: CreateNotificationDto = req.body;
    
    if (!data.userId || !data.type || !data.title || !data.content) {
      return res.status(400).json({ error: '缺少必需字段' });
    }

    const notification = await notificationService.createNotification(data);
    res.status(201).json(notification);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 批量发送通知
 * POST /api/notifications/broadcast
 */
router.post('/broadcast', async (req: Request, res: Response) => {
  try {
    const data: BroadcastNotificationDto = req.body;
    
    if (!data.userIds || !Array.isArray(data.userIds) || data.userIds.length === 0) {
      return res.status(400).json({ error: '用户ID列表不能为空' });
    }
    if (!data.type || !data.title || !data.content) {
      return res.status(400).json({ error: '缺少必需字段' });
    }

    const notifications = await notificationService.createBroadcast(data);
    res.status(201).json({ count: notifications.length, notifications });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 已读状态管理 ====================

/**
 * 标记为已读
 * POST /api/notifications/:id/read
 */
router.post('/:id/read', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || req.body.userId;
    if (!userId) {
      return res.status(401).json({ error: '未授权' });
    }

    const notification = await notificationService.markAsRead(userId, req.params.id);
    res.json(notification);
  } catch (error: any) {
    if (error.message === '通知不存在') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * 全部标记为已读
 * POST /api/notifications/read-all
 */
router.post('/actions/read-all', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || req.body.userId;
    if (!userId) {
      return res.status(401).json({ error: '未授权' });
    }

    const count = await notificationService.markAllAsRead(userId);
    res.json({ count });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 批量标记为已读
 * POST /api/notifications/read-multiple
 */
router.post('/actions/read-multiple', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || req.body.userId;
    if (!userId) {
      return res.status(401).json({ error: '未授权' });
    }

    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ error: 'ids必须是数组' });
    }

    const count = await notificationService.markMultipleAsRead(userId, ids);
    res.json({ count });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 通知删除 ====================

/**
 * 删除通知
 * DELETE /api/notifications/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || req.query.userId as string;
    if (!userId) {
      return res.status(401).json({ error: '未授权' });
    }

    await notificationService.deleteNotification(userId, req.params.id);
    res.status(204).send();
  } catch (error: any) {
    if (error.message === '通知不存在') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * 删除所有已读通知
 * DELETE /api/notifications/read
 */
router.delete('/actions/delete-read', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || req.query.userId as string;
    if (!userId) {
      return res.status(401).json({ error: '未授权' });
    }

    const count = await notificationService.deleteAllRead(userId);
    res.json({ count });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 删除所有通知
 * DELETE /api/notifications/all
 */
router.delete('/actions/delete-all', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || req.query.userId as string;
    if (!userId) {
      return res.status(401).json({ error: '未授权' });
    }

    const count = await notificationService.deleteAll(userId);
    res.json({ count });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
