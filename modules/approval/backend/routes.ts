/**
 * 审批管理路由
 */

import { Router, Request, Response } from 'express';
import { approvalService } from './service';
import { requirePermission } from '../../../src/admin/middleware/permission';
import { success, error } from '../../../src/admin/utils/response';
import type { ApprovalType, ApprovalStatus } from './types';

const router = Router();

/**
 * GET / - 查询审批列表
 */
router.get('/', requirePermission('approval:view'), async (req: Request, res: Response) => {
  try {
    const params = {
      type: req.query.type as ApprovalType | undefined,
      status: req.query.status as ApprovalStatus | undefined,
      applicantId: req.query.applicantId as string | undefined,
      page: parseInt(req.query.page as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 20,
    };
    const result = await approvalService.query(params);
    res.json(success(result));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /pending-count - 获取待审批数量
 */
router.get('/pending-count', requirePermission('approval:view'), async (_req: Request, res: Response) => {
  try {
    const count = await approvalService.getPendingCount();
    res.json(success({ count }));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /:id - 获取审批详情
 */
router.get('/:id', requirePermission('approval:view'), async (req: Request, res: Response) => {
  try {
    const record = await approvalService.getById(req.params.id);
    if (!record) {
      return res.status(404).json(error('RES_NOT_FOUND', '审批记录不存在'));
    }
    res.json(success(record));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * POST / - 创建审批申请
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const record = await approvalService.create(req.body);
    res.status(201).json(success(record));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * POST /:id/approve - 审批通过
 */
router.post('/:id/approve', requirePermission('approval:review'), async (req: Request, res: Response) => {
  try {
    const { comment } = req.body;
    const userId = req.user!.id;
    const username = (req.user as any)?.username || userId;
    const ok = await approvalService.approve(req.params.id, userId, username, comment);
    if (!ok) {
      return res.status(400).json(error('BIZ_ERROR', '审批失败，可能记录不存在或已处理'));
    }
    res.json(success({ message: '审批通过' }));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * POST /:id/reject - 审批拒绝
 */
router.post('/:id/reject', requirePermission('approval:review'), async (req: Request, res: Response) => {
  try {
    const { comment } = req.body;
    if (!comment) {
      return res.status(400).json(error('VALID_PARAM_MISSING', '拒绝时必须填写原因'));
    }
    const userId = req.user!.id;
    const username = (req.user as any)?.username || userId;
    const ok = await approvalService.reject(req.params.id, userId, username, comment);
    if (!ok) {
      return res.status(400).json(error('BIZ_ERROR', '拒绝失败，可能记录不存在或已处理'));
    }
    res.json(success({ message: '已拒绝' }));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * POST /:id/cancel - 取消申请
 */
router.post('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const ok = await approvalService.cancel(req.params.id, userId);
    if (!ok) {
      return res.status(400).json(error('BIZ_ERROR', '取消失败，可能记录不存在或已处理'));
    }
    res.json(success({ message: '已取消' }));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

export default router;
export { router };
