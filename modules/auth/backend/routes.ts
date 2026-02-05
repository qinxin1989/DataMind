/**
 * 认证模块路由
 */

import { Router } from 'express';
import { AuthService } from '../../../src/services/authService';
import { createAuthMiddleware, requireAdmin } from '../../../src/middleware/auth';
import { pool } from '../../../src/admin/core/database';

const router = Router();

// 创建认证服务实例
const authService = new AuthService({
  pool,
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d'
});

// 认证中间件
const authMiddleware = createAuthMiddleware(authService);

/**
 * POST /auth/register - 用户注册（待审核）
 */
router.post('/register', async (req, res) => {
  try {
    const { username, password, email, fullName } = req.body;
    const result = await authService.register(username, password, email, fullName);
    res.json({ user: result.user, message: result.message });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /auth/login - 用户登录
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const { user, token } = await authService.login(username, password);
    res.json({ user, token });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /auth/me - 获取当前用户信息
 */
router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

/**
 * POST /auth/change-password - 修改密码
 */
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

/**
 * GET /auth/users - 获取所有用户（仅管理员）
 */
router.get('/users', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const users = await authService.getAllUsers();
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /auth/users/pending - 获取待审核用户（仅管理员）
 */
router.get('/users/pending', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const users = await authService.getPendingUsers();
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /auth/users - 管理员创建用户（直接激活）
 */
router.post('/users', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { username, password, role, email, fullName } = req.body;
    const user = await authService.createUser(username, password, role, email, fullName);
    res.json(user);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /auth/users/:id/approve - 审核通过用户（仅管理员）
 */
router.post('/users/:id/approve', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const user = await authService.approveUser(req.params.id);
    res.json({ message: '审核通过', user });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /auth/users/:id/reject - 拒绝用户注册（仅管理员）
 */
router.post('/users/:id/reject', authMiddleware, requireAdmin, async (req, res) => {
  try {
    await authService.rejectUser(req.params.id);
    res.json({ message: '已拒绝' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * PUT /auth/users/:id - 更新用户信息（仅管理员）
 */
router.put('/users/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { email, fullName, role, status } = req.body;
    const user = await authService.updateUser(req.params.id, { email, fullName, role, status });
    res.json(user);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /auth/users/:id - 删除用户（仅管理员）
 */
router.delete('/users/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    await authService.deleteUser(req.params.id);
    res.json({ message: '用户已删除' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;