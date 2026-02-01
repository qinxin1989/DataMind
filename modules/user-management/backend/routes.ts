/**
 * 用户管理 API 路由
 */

import { Router, Request, Response } from 'express';
import { userService } from './service';
import type { UserQueryParams, CreateUserRequest, UpdateUserRequest } from './types';

const router = Router();

/** 成功响应 */
function success<T>(data: T) {
  return { success: true, data, timestamp: Date.now() };
}

/** 错误响应 */
function error(code: string, message: string) {
  return { success: false, error: { code, message }, timestamp: Date.now() };
}

/**
 * GET /users - 获取用户列表
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const params: UserQueryParams = {
      keyword: req.query.keyword as string,
      status: req.query.status as any,
      role: req.query.role as any,
      department: req.query.department as string,
      page: parseInt(req.query.page as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 10,
      sortBy: req.query.sortBy as string,
      sortOrder: req.query.sortOrder as 'asc' | 'desc',
    };

    const result = await userService.queryUsers(params);
    res.json(success(result));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /users/:id - 获取用户详情
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = await userService.getUserById(req.params.id);
    if (!user) {
      return res.status(404).json(error('RES_NOT_FOUND', '用户不存在'));
    }
    res.json(success(user));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * POST /users - 创建用户
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const data: CreateUserRequest = req.body;

    if (!data.username || !data.password) {
      return res.status(400).json(error('VALID_PARAM_MISSING', '用户名和密码不能为空'));
    }

    const user = await userService.createUser(data);
    res.status(201).json(success(user));
  } catch (err: any) {
    if (err.message.includes('已存在')) {
      return res.status(400).json(error('BIZ_USERNAME_EXISTS', err.message));
    }
    if (err.message.includes('密码强度')) {
      return res.status(400).json(error('VALID_PASSWORD_WEAK', err.message));
    }
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * PUT /users/:id - 更新用户
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const data: UpdateUserRequest = req.body;
    const user = await userService.updateUser(req.params.id, data);
    res.json(success(user));
  } catch (err: any) {
    if (err.message.includes('不存在')) {
      return res.status(404).json(error('RES_NOT_FOUND', err.message));
    }
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * DELETE /users/:id - 删除用户
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await userService.deleteUser(req.params.id);
    res.json(success({ message: '删除成功' }));
  } catch (err: any) {
    if (err.message.includes('不存在')) {
      return res.status(404).json(error('RES_NOT_FOUND', err.message));
    }
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * PUT /users/:id/status - 更新用户状态
 */
router.put('/:id/status', async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json(error('VALID_PARAM_MISSING', '状态不能为空'));
    }
    const user = await userService.updateStatus(req.params.id, status);
    res.json(success(user));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * POST /users/batch/status - 批量更新状态
 */
router.post('/batch/status', async (req: Request, res: Response) => {
  try {
    const { ids, status } = req.body;
    if (!ids || !Array.isArray(ids) || !status) {
      return res.status(400).json(error('VALID_PARAM_MISSING', '参数错误'));
    }
    const count = await userService.batchUpdateStatus(ids, status);
    res.json(success({ count }));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * POST /users/batch/delete - 批量删除
 */
router.post('/batch/delete', async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json(error('VALID_PARAM_MISSING', '参数错误'));
    }
    const count = await userService.batchDelete(ids);
    res.json(success({ count }));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * POST /users/:id/reset-password - 重置密码
 */
router.post('/:id/reset-password', async (req: Request, res: Response) => {
  try {
    const newPassword = await userService.resetPassword(req.params.id);
    res.json(success({ newPassword }));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

export default router;
