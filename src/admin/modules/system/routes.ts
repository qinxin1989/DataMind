/**
 * 系统管理 API 路由
 */

import { Router, Request, Response } from 'express';
import { systemService } from './systemService';
import { backupService } from './backupService';
import { envConfigService } from './envConfigService';
import { requirePermission } from '../../middleware/permission';
import type { ApiResponse } from '../../types';

const router = Router();

/** 成功响应 */
function success<T>(data: T): ApiResponse<T> {
  return { success: true, data, timestamp: Date.now() };
}

/** 错误响应 */
function error(code: string, message: string): ApiResponse {
  return { success: false, error: { code, message }, timestamp: Date.now() };
}

// ==================== 系统配置 ====================

// ==================== 数据库配置 ====================

/**
 * GET /system/db-config - 获取数据库配置
 */
router.get('/db-config', requirePermission('system:view'), async (req: Request, res: Response) => {
  try {
    const config = await envConfigService.getDbConfig();
    // 密码脱敏
    res.json(success({
      ...config,
      password: config.password ? '******' : '',
    }));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * PUT /system/db-config - 更新数据库配置
 */
router.put('/db-config', requirePermission('system:config'), async (req: Request, res: Response) => {
  try {
    const { host, port, user, password, database } = req.body;
    const config = await envConfigService.updateDbConfig({
      host,
      port: port ? parseInt(port, 10) : undefined,
      user,
      password,
      database,
    });
    res.json(success({
      ...config,
      password: config.password ? '******' : '',
      message: '配置已更新，重启服务后生效',
    }));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * POST /system/db-config/test - 测试数据库连接
 */
router.post('/db-config/test', requirePermission('system:view'), async (req: Request, res: Response) => {
  try {
    const { host, port, user, password, database } = req.body;
    const result = await envConfigService.testConnection({
      host: host || process.env.CONFIG_DB_HOST || 'localhost',
      port: parseInt(port || process.env.CONFIG_DB_PORT || '3306', 10),
      user: user || process.env.CONFIG_DB_USER || 'root',
      password: password || process.env.CONFIG_DB_PASSWORD || '',
      database: database || process.env.CONFIG_DB_NAME || '',
    });
    res.json(success(result));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

// ==================== 其他系统配置 ====================

/**
 * GET /system/configs - 获取系统配置
 */
router.get('/configs', requirePermission('system:view'), async (req: Request, res: Response) => {
  try {
    const group = req.query.group as string;
    const configs = await systemService.getConfigs(group);
    res.json(success(configs));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /system/configs/:key - 获取单个配置
 */
router.get('/configs/:key', requirePermission('system:view'), async (req: Request, res: Response) => {
  try {
    const config = await systemService.getConfig(req.params.key);
    if (!config) {
      return res.status(404).json(error('RES_NOT_FOUND', '配置项不存在'));
    }
    res.json(success(config));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * PUT /system/configs/:key - 更新配置
 */
router.put('/configs/:key', requirePermission('system:config'), async (req: Request, res: Response) => {
  try {
    const { value } = req.body;
    if (value === undefined) {
      return res.status(400).json(error('VALID_PARAM_MISSING', '缺少 value 参数'));
    }
    const config = await systemService.updateConfig(req.params.key, value);
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
 * GET /system/config-groups - 获取配置组列表
 */
router.get('/config-groups', requirePermission('system:view'), async (req: Request, res: Response) => {
  try {
    const groups = await systemService.getConfigGroups();
    res.json(success(groups));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

// ==================== 系统状态 ====================

/**
 * GET /system/status - 获取系统状态
 */
router.get('/status', requirePermission('system:view'), async (req: Request, res: Response) => {
  try {
    const status = await systemService.getSystemStatus();
    res.json(success(status));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

// ==================== 备份管理 ====================

/**
 * GET /system/backups - 获取备份列表
 */
router.get('/backups', requirePermission('system:backup'), async (req: Request, res: Response) => {
  try {
    const backups = await backupService.listBackups();
    res.json(success(backups));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * POST /system/backups - 创建备份
 */
router.post('/backups', requirePermission('system:backup'), async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json(error('VALID_PARAM_MISSING', '缺少备份名称'));
    }
    const backup = await backupService.createBackup(name, description);
    res.status(201).json(success(backup));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /system/backups/:id - 获取备份详情
 */
router.get('/backups/:id', requirePermission('system:backup'), async (req: Request, res: Response) => {
  try {
    const backup = await backupService.getBackup(req.params.id);
    if (!backup) {
      return res.status(404).json(error('RES_NOT_FOUND', '备份不存在'));
    }
    res.json(success(backup));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * DELETE /system/backups/:id - 删除备份
 */
router.delete('/backups/:id', requirePermission('system:backup'), async (req: Request, res: Response) => {
  try {
    await backupService.deleteBackup(req.params.id);
    res.json(success({ message: '删除成功' }));
  } catch (err: any) {
    if (err.message.includes('不存在')) {
      return res.status(404).json(error('RES_NOT_FOUND', err.message));
    }
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * POST /system/backups/:id/restore - 恢复备份
 */
router.post('/backups/:id/restore', requirePermission('system:backup'), async (req: Request, res: Response) => {
  try {
    const result = await backupService.restoreBackup(req.params.id);
    res.json(success(result));
  } catch (err: any) {
    if (err.message.includes('不存在')) {
      return res.status(404).json(error('RES_NOT_FOUND', err.message));
    }
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /system/backups/:id/verify - 验证备份
 */
router.get('/backups/:id/verify', requirePermission('system:backup'), async (req: Request, res: Response) => {
  try {
    const result = await backupService.verifyBackup(req.params.id);
    res.json(success(result));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /system/backups/:id/export - 导出备份
 */
router.get('/backups/:id/export', requirePermission('system:backup'), async (req: Request, res: Response) => {
  try {
    const content = await backupService.exportBackup(req.params.id);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=backup-${req.params.id}.json`);
    res.send(content);
  } catch (err: any) {
    if (err.message.includes('不存在')) {
      return res.status(404).json(error('RES_NOT_FOUND', err.message));
    }
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

export default router;
