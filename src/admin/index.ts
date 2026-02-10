/**
 * 模块化后台管理框架 - 主入口
 * 整合所有模块路由到 Express
 */

import { Router, Request, Response } from 'express';
import { pool } from './core/database';

// 导入模块路由 — 静态 router
import userRoutes from '../../modules/user-management/backend/routes';
import roleRoutes from '../../modules/role-management/backend/routes';
import menuRoutes from '../../modules/menu-management/backend/routes';
import notificationRoutes from '../../modules/notification/backend/routes';
import datasourceRoutes from '../../modules/datasource-management/backend/routes';
import aiStatsRoutes from '../../modules/ai-stats/backend/routes';
import aiCrawlerRoutes from '../../modules/ai-crawler-assistant/backend/routes';
import monitoringRoutes from '../../modules/monitoring/backend/routes';

// 导入模块路由 — 工厂模式
import { initRoutes as initAuditRoutes } from '../../modules/audit-log/backend/routes';
import { initRoutes as initAiConfigRoutes } from '../../modules/ai-config/backend/routes';
import { initRoutes as initSystemConfigRoutes } from '../../modules/system-config/backend/routes';
import { initRoutes as initSystemBackupRoutes } from '../../modules/system-backup/backend/routes';
import { createRoutes as createAiQARoutes } from '../../modules/ai-qa/backend/routes';

// 导入服务类
import { AIConfigService } from '../../modules/ai-config/backend/service';
import { AIQAService } from '../../modules/ai-qa/backend/service';

// Dashboard 和文件工具
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

// 辅助函数：尝试加载模块路由
function loadModuleRoutes(moduleName: string, relativePath: string) {
  try {
    // 优先尝试标准开发路径
    return require(relativePath).default;
  } catch (err1) {
    try {
      // 尝试生产环境路径 (假设在 dist 中)
      // 如果当前在 dist/admin/index.js, 那么 ../../Modules/xx 对应 dist/modules/xx
      // 但实际上 ts 编译后 path 可能并没有变，问题是文件是否存在
      // 这里增加更健壮的路径检测

      // 尝试使用 path.resolve 动态构建路径
      const path = require('path');
      const fs = require('fs');

      // 检测是否在 dist 目录运行
      const isDist = __dirname.includes('dist');
      const rootDir = isDist ? path.resolve(__dirname, '../../..') : path.resolve(__dirname, '../..');

      // 尝试构建可能的路径
      const possiblePaths = [
        path.join(rootDir, 'modules', moduleName, 'backend', 'routes.js'),
        path.join(rootDir, 'dist', 'modules', moduleName, 'backend', 'routes.js'),
        path.join(rootDir, 'modules', moduleName, 'backend', 'routes.ts'), // ts-node 环境
      ];

      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          return require(p).default;
        }
      }

      throw err1; // 如果都找不到，抛出原始错误
    } catch (err2) {
      console.warn(`${moduleName} 模块路由加载失败:`, (err2 as any).message);
      return null;
    }
  }
}

ocrRoutes = loadModuleRoutes('ocr-service', '../../modules/ocr-service/backend/routes');
skillsRoutes = loadModuleRoutes('skills-service', '../../modules/skills-service/backend/routes');
ragRoutes = loadModuleRoutes('rag-service', '../../modules/rag-service/backend/routes');

// 创建服务单例
const aiConfigServiceInstance = new AIConfigService(pool);
const aiQAServiceInstance = new AIQAService(pool);

// 导入核心服务
export { moduleRegistry } from './core/moduleRegistry';
export { permissionService } from './services/permissionService';
export const aiQAService = aiQAServiceInstance;
export const aiConfigService = aiConfigServiceInstance;

// 导入中间件
import { requirePermission as _requirePermission } from './middleware/permission';
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
  router.use('/audit', initAuditRoutes(pool));

  // AI 路由（组合 ai-config + ai-stats + ai-crawler-assistant）
  router.use('/ai', initAiConfigRoutes(aiConfigServiceInstance, _requirePermission));
  router.use('/ai', aiStatsRoutes);
  router.use('/ai', aiCrawlerRoutes);

  // 系统路由（组合 system-config + system-backup）
  router.use('/system', initSystemConfigRoutes(pool));
  router.use('/system', initSystemBackupRoutes(pool));

  router.use('/notifications', notificationRoutes);
  router.use('/datasources', datasourceRoutes);
  router.use('/ai-qa', createAiQARoutes(aiQAServiceInstance));
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