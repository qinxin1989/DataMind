/**
 * 系统配置模块路由
 */

import { Router, Request, Response } from 'express';
import { SystemConfigService } from './service';
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

/**
 * 初始化路由
 */
export function initRoutes(db: any): Router {
  const service = new SystemConfigService(db);

  // ==================== 配置管理 ====================

  /**
   * GET /api/modules/system-config/configs - 获取配置列表
   */
  router.get('/configs', async (req: Request, res: Response) => {
    try {
      const { group, key } = req.query;
      const configs = await service.getConfigs({
        group: group as string,
        key: key as string
      });
      res.json(success(configs));
    } catch (err: any) {
      res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
  });

  /**
   * GET /api/modules/system-config/configs/:key - 获取单个配置
   */
  router.get('/configs/:key', async (req: Request, res: Response) => {
    try {
      const config = await service.getConfig(req.params.key);
      if (!config) {
        return res.status(404).json(error('RES_NOT_FOUND', '配置项不存在'));
      }
      res.json(success(config));
    } catch (err: any) {
      res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
  });

  /**
   * POST /api/modules/system-config/configs - 创建配置
   */
  router.post('/configs', async (req: Request, res: Response) => {
    try {
      const config = await service.createConfig(req.body);
      res.status(201).json(success(config));
    } catch (err: any) {
      if (err.message.includes('已存在')) {
        return res.status(409).json(error('RES_CONFLICT', err.message));
      }
      res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
  });

  /**
   * PUT /api/modules/system-config/configs/:key - 更新配置
   */
  router.put('/configs/:key', async (req: Request, res: Response) => {
    try {
      const config = await service.updateConfig(req.params.key, req.body);
      res.json(success(config));
    } catch (err: any) {
      if (err.message.includes('不存在')) {
        return res.status(404).json(error('RES_NOT_FOUND', err.message));
      }
      if (err.message.includes('不可编辑')) {
        return res.status(403).json(error('PERM_DENIED', err.message));
      }
      res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
  });

  /**
   * DELETE /api/modules/system-config/configs/:key - 删除配置
   */
  router.delete('/configs/:key', async (req: Request, res: Response) => {
    try {
      await service.deleteConfig(req.params.key);
      res.json(success({ message: '删除成功' }));
    } catch (err: any) {
      if (err.message.includes('不存在')) {
        return res.status(404).json(error('RES_NOT_FOUND', err.message));
      }
      if (err.message.includes('不可删除')) {
        return res.status(403).json(error('PERM_DENIED', err.message));
      }
      res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
  });

  /**
   * GET /api/modules/system-config/config-groups - 获取配置分组
   */
  router.get('/config-groups', async (req: Request, res: Response) => {
    try {
      const groups = await service.getConfigGroups();
      res.json(success(groups));
    } catch (err: any) {
      res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
  });

  // ==================== 系统状态 ====================

  /**
   * GET /api/modules/system-config/status - 获取系统状态
   */
  router.get('/status', async (req: Request, res: Response) => {
    try {
      const status = await service.getSystemStatus();
      res.json(success(status));
    } catch (err: any) {
      res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
  });

  // ==================== 数据库配置 ====================

  /**
   * GET /api/modules/system-config/db-config - 获取数据库配置
   */
  router.get('/db-config', async (req: Request, res: Response) => {
    try {
      const config = await service.getDbConfig();
      // 密码脱敏
      res.json(success({
        ...config,
        password: config.password ? '******' : ''
      }));
    } catch (err: any) {
      res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
  });

  /**
   * PUT /api/modules/system-config/db-config - 更新数据库配置
   */
  router.put('/db-config', async (req: Request, res: Response) => {
    try {
      const config = await service.updateDbConfig(req.body);
      res.json(success({
        ...config,
        password: config.password ? '******' : '',
        message: '配置已更新，重启服务后生效'
      }));
    } catch (err: any) {
      res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
  });

  /**
   * POST /api/modules/system-config/db-config/test - 测试数据库连接
   */
  router.post('/db-config/test', async (req: Request, res: Response) => {
    try {
      const result = await service.testDbConnection(req.body);
      res.json(success(result));
    } catch (err: any) {
      res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
  });

  return router;
}

export default router;
