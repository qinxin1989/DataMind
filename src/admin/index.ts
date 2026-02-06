/**
 * 模块化后台管理框架 - 主入口
 * 整合所有模块路由到 Express
 */

import { Router } from 'express';

// 导入模块路由
import userRoutes from './modules/user/routes';
import roleRoutes from './modules/role/routes';
import menuRoutes from './modules/menu/routes';
import auditRoutes from './modules/audit/routes';
import aiRoutes from './modules/ai/routes';
import systemRoutes from './modules/system/routes';
import notificationRoutes from './modules/notification/routes';
import datasourceRoutes from './modules/datasource/routes';
import aiQARoutes from './modules/ai-qa/routes';
import { createDashboardRoutes } from '../../modules/dashboard/backend/routes';
import { DashboardService } from '../../modules/dashboard/backend/service';
import { createFileToolsRoutes } from '../../modules/file-tools/backend/routes';
import { FileToolsService } from '../../modules/file-tools/backend/service';

// 动态导入爬虫管理路由（避免编译时错误）
let crawlerRoutes: any = null;
try {
  const crawlerModule = require('../../modules/crawler-management/backend/routes');
  crawlerRoutes = crawlerModule.default || crawlerModule;
} catch (error) {
  console.warn('爬虫管理模块路由加载失败:', error);
}

// 导入新增模块路由
let ocrRoutes: any = null;
let skillsRoutes: any = null;
let ragRoutes: any = null;

try {
  ocrRoutes = require('../../modules/ocr-service/backend/routes').default;
} catch (error) {
  console.warn('OCR模块路由加载失败:', error);
}

try {
  skillsRoutes = require('../../modules/skills-service/backend/routes').default;
} catch (error) {
  console.warn('Skills模块路由加载失败:', error);
}

try {
  ragRoutes = require('../../modules/rag-service/backend/routes').default;
} catch (error) {
  console.warn('RAG模块路由加载失败:', error);
}

// 导入核心服务
export { moduleRegistry } from './core/moduleRegistry';
export { permissionService } from './services/permissionService';
export { aiQAService } from './modules/ai-qa/aiQAService';

// 导入中间件
export { requirePermission, requireAnyPermission, requireAllPermissions } from './middleware/permission';
export { auditMiddleware } from './middleware/audit';

// 导入类型
export * from './types';

/**
 * 创建管理后台路由
 * @returns Express Router 实例
 */
export function createAdminRouter(pool?: any): Router {
  const router = Router();

  // 创建服务实例
  const dashboardService = new DashboardService();
  const fileToolsService = new FileToolsService(pool);

  // 注册核心模块路由
  router.use('/users', userRoutes);
  router.use('/roles', roleRoutes);
  router.use('/menus', menuRoutes);
  router.use('/audit', auditRoutes);
  router.use('/ai', aiRoutes);
  router.use('/system', systemRoutes);
  router.use('/notifications', notificationRoutes);
  router.use('/datasources', datasourceRoutes);
  router.use('/ai-qa', aiQARoutes);
  router.use('/dashboards', createDashboardRoutes(dashboardService));
  
  // 注册业务模块路由
  if (crawlerRoutes) {
    router.use('/crawler', crawlerRoutes);
  }
  router.use('/tools/file', createFileToolsRoutes(fileToolsService));
  
  // 注册新增模块路由
  if (ocrRoutes) {
    router.use('/ocr', ocrRoutes);
  }
  if (skillsRoutes) {
    router.use('/skills', skillsRoutes);
  }
  if (ragRoutes) {
    router.use('/rag', ragRoutes);
  }

  // 健康检查端点
  router.get('/health', (req, res) => {
    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: Date.now(),
        version: '1.0.0',
        modules: [
          'users', 'roles', 'menus', 'audit', 'ai', 'system', 
          'notifications', 'datasources', 'ai-qa', 'dashboard',
          'crawler', 'file-tools', 'ocr', 'skills', 'rag'
        ]
      },
    });
  });

  return router;
}

/**
 * 模块信息
 */
export const adminModuleInfo = {
  name: 'admin',
  displayName: '后台管理框架',
  version: '1.0.0',
  description: '模块化后台管理框架，包含用户、权限、菜单、AI、系统管理等功能',
  modules: [
    { name: 'user', path: '/users', description: '用户管理' },
    { name: 'role', path: '/roles', description: '角色管理' },
    { name: 'menu', path: '/menus', description: '菜单管理' },
    { name: 'audit', path: '/audit', description: '审计日志' },
    { name: 'ai', path: '/ai', description: 'AI 管理' },
    { name: 'system', path: '/system', description: '系统管理' },
    { name: 'notification', path: '/notifications', description: '通知中心' },
    { name: 'datasource', path: '/datasources', description: '数据源管理' },
    { name: 'ai-qa', path: '/ai-qa', description: 'AI 问答' },
    { name: 'dashboard', path: '/dashboard', description: '仪表板' },
    { name: 'crawler', path: '/crawler', description: '爬虫管理' },
    { name: 'file-tools', path: '/tools/file', description: '文件工具' },
    { name: 'ocr', path: '/ocr', description: 'OCR识别' },
    { name: 'skills', path: '/skills', description: '技能服务' },
    { name: 'rag', path: '/rag', description: 'RAG知识库' }
  ],
};

export default createAdminRouter;