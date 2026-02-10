/**
 * 认证模块入口
 */

import { Router } from 'express';
import type { Pool } from 'mysql2/promise';
import { AuthService } from '../../../src/services/authService';
import { createAuthMiddleware, requireAdmin } from './middleware';

export interface AuthModuleOptions {
  pool: Pool;
  jwtSecret?: string;
  jwtExpiresIn?: string;
}

export function initAuthModule(options: AuthModuleOptions) {
  const { pool, jwtSecret, jwtExpiresIn } = options;

  // 创建认证服务
  const authService = new AuthService({
    pool,
    jwtSecret: jwtSecret || process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    jwtExpiresIn: jwtExpiresIn || process.env.JWT_EXPIRES_IN || '7d'
  });

  // 创建中间件
  const authMiddleware = createAuthMiddleware(authService);

  // 创建路由
  const router = Router();

  // 公开接口
  router.post('/register', async (req, res) => {
    try {
      const { username, password, email, fullName } = req.body;
      const result = await authService.register(username, password, email, fullName);
      res.json({ user: result.user, message: result.message });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      const { user, token } = await authService.login(username, password);
      res.json({ user, token });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // 需要认证的接口
  router.get('/me', authMiddleware, (req, res) => {
    res.json({ user: req.user });
  });

  router.post('/change-password', authMiddleware, async (req, res) => {
    try {
      const { oldPassword, newPassword } = req.body;
      if (!req.user) return res.status(401).json({ error: '未认证' });
      await authService.changePassword(req.user.id, oldPassword, newPassword);
      res.json({ message: '密码修改成功' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // 管理员接口
  router.get('/users', authMiddleware, requireAdmin, async (req, res) => {
    try {
      const users = await authService.getAllUsers();
      res.json(users);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/users/pending', authMiddleware, requireAdmin, async (req, res) => {
    try {
      const users = await authService.getPendingUsers();
      res.json(users);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/users', authMiddleware, requireAdmin, async (req, res) => {
    try {
      const { username, password, role, email, fullName } = req.body;
      const user = await authService.createUser(username, password, role, email, fullName);
      res.json(user);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/users/:id/approve', authMiddleware, requireAdmin, async (req, res) => {
    try {
      const user = await authService.approveUser(req.params.id);
      res.json({ message: '审核通过', user });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/users/:id/reject', authMiddleware, requireAdmin, async (req, res) => {
    try {
      await authService.rejectUser(req.params.id);
      res.json({ message: '已拒绝' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  router.put('/users/:id', authMiddleware, requireAdmin, async (req, res) => {
    try {
      const { email, fullName, role, status } = req.body;
      const user = await authService.updateUser(req.params.id, { email, fullName, role, status });
      res.json(user);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  router.delete('/users/:id', authMiddleware, requireAdmin, async (req, res) => {
    try {
      await authService.deleteUser(req.params.id);
      res.json({ message: '用户已删除' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return {
    routes: router,
    name: 'auth',
    version: '1.0.0',

    // 导出服务和中间件
    authService,
    authMiddleware,
    requireAdmin
  };
}

// 导出所有类型和服务
export * from './types';
export { AuthService } from '../../../src/services/authService';
export { createAuthMiddleware, requireAdmin } from './middleware';