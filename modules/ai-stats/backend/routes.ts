/**
 * AI统计模块路由
 */

import { Router, Request, Response } from 'express';
import { aiStatsService } from './service';
import { requirePermission } from '../../../src/admin/middleware/permission';
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

// ==================== AI 使用统计 ====================

/**
 * GET /ai/stats - 获取使用统计
 */
router.get('/stats', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const startTime = req.query.startTime
      ? parseInt(req.query.startTime as string)
      : Date.now() - 30 * 24 * 60 * 60 * 1000;
    const endTime = req.query.endTime
      ? parseInt(req.query.endTime as string)
      : Date.now();

    const stats = await aiStatsService.getUsageStats(startTime, endTime);
    res.json(success(stats));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /ai/stats/user/:userId - 获取用户统计
 */
router.get('/stats/user/:userId', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const startTime = req.query.startTime
      ? parseInt(req.query.startTime as string)
      : Date.now() - 30 * 24 * 60 * 60 * 1000;
    const endTime = req.query.endTime
      ? parseInt(req.query.endTime as string)
      : Date.now();

    const stats = await aiStatsService.getUserStats(req.params.userId, startTime, endTime);
    res.json(success(stats));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

// ==================== 对话历史 ====================

/**
 * GET /ai/conversations - 查询对话历史
 */
router.get('/conversations', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const params = {
      userId: req.query.userId as string,
      datasourceId: req.query.datasourceId as string,
      keyword: req.query.keyword as string,
      startTime: req.query.startTime ? parseInt(req.query.startTime as string) : undefined,
      endTime: req.query.endTime ? parseInt(req.query.endTime as string) : undefined,
      page: parseInt(req.query.page as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 20,
    };

    const result = await aiStatsService.queryConversations(params);
    res.json(success(result));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /ai/conversations/:userId/:id - 获取单个对话
 */
router.get('/conversations/:userId/:id', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const conversation = await aiStatsService.getConversationById(req.params.userId, req.params.id);
    if (!conversation) {
      return res.status(404).json(error('RES_NOT_FOUND', '对话记录不存在'));
    }
    res.json(success(conversation));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * DELETE /ai/conversations/:userId/:id - 删除对话
 */
router.delete('/conversations/:userId/:id', requirePermission('ai:config'), async (req: Request, res: Response) => {
  try {
    await aiStatsService.deleteConversation(req.params.userId, req.params.id);
    res.json(success({ message: '删除成功' }));
  } catch (err: any) {
    if (err.message.includes('不存在')) {
      return res.status(404).json(error('RES_NOT_FOUND', err.message));
    }
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

export default router;
