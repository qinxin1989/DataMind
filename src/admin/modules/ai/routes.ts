/**
 * AI 管理 API 路由
 */

import { Router, Request, Response } from 'express';
import { aiConfigService } from './aiConfigService';
import { aiStatsService } from './aiStatsService';
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

// ==================== AI 配置管理 ====================

/**
 * GET /ai/configs - 获取所有 AI 配置
 */
router.get('/configs', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const configs = await aiConfigService.getProviderConfigs();
    // 隐藏 API Key
    const safeConfigs = configs.map(c => ({
      ...c,
      apiKey: c.apiKey ? '***' + c.apiKey.slice(-4) : '',
    }));
    res.json(success(safeConfigs));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /ai/configs/:id - 获取单个 AI 配置
 */
router.get('/configs/:id', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const config = await aiConfigService.getProviderConfigById(req.params.id);
    if (!config) {
      return res.status(404).json(error('RES_NOT_FOUND', 'AI 配置不存在'));
    }
    // 隐藏 API Key
    const safeConfig = {
      ...config,
      apiKey: config.apiKey ? '***' + config.apiKey.slice(-4) : '',
    };
    res.json(success(safeConfig));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * POST /ai/configs - 创建 AI 配置
 */
router.post('/configs', requirePermission('ai:config'), async (req: Request, res: Response) => {
  try {
    const { name, provider, apiKey, apiEndpoint, model, maxTokens, temperature, isDefault } = req.body;

    if (!name || !provider || !apiKey || !model) {
      return res.status(400).json(error('VALID_PARAM_MISSING', '缺少必要参数'));
    }

    const config = await aiConfigService.createProviderConfig({
      name,
      provider,
      apiKey,
      apiEndpoint,
      model,
      maxTokens: maxTokens || 2048,
      temperature: temperature ?? 0.7,
      isDefault: isDefault || false,
      status: 'active',
    });

    res.status(201).json(success(config));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * PUT /ai/configs/priorities - 批量更新优先级（拖拽排序）
 * 注意：此路由必须在 /configs/:id 之前定义
 */
router.put('/configs/priorities', requirePermission('ai:config'), async (req: Request, res: Response) => {
  try {
    const { priorities } = req.body;
    if (!Array.isArray(priorities)) {
      return res.status(400).json(error('VALID_PARAM_MISSING', '缺少 priorities 数组'));
    }
    await aiConfigService.updatePriorities(priorities);
    res.json(success({ message: '优先级更新成功' }));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * PUT /ai/configs/:id - 更新 AI 配置
 */
router.put('/configs/:id', requirePermission('ai:config'), async (req: Request, res: Response) => {
  try {
    const config = await aiConfigService.updateProviderConfig(req.params.id, req.body);
    res.json(success(config));
  } catch (err: any) {
    if (err.message.includes('不存在')) {
      return res.status(404).json(error('RES_NOT_FOUND', err.message));
    }
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * DELETE /ai/configs/:id - 删除 AI 配置
 */
router.delete('/configs/:id', requirePermission('ai:config'), async (req: Request, res: Response) => {
  try {
    await aiConfigService.deleteProviderConfig(req.params.id);
    res.json(success({ message: '删除成功' }));
  } catch (err: any) {
    if (err.message.includes('不存在')) {
      return res.status(404).json(error('RES_NOT_FOUND', err.message));
    }
    if (err.message.includes('默认')) {
      return res.status(400).json(error('BIZ_CANNOT_DELETE_DEFAULT', err.message));
    }
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * PUT /ai/configs/:id/default - 设置默认配置
 */
router.put('/configs/:id/default', requirePermission('ai:config'), async (req: Request, res: Response) => {
  try {
    const config = await aiConfigService.setDefaultProvider(req.params.id);
    res.json(success(config));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * POST /ai/configs/validate - 验证 API Key
 */
router.post('/configs/validate', requirePermission('ai:config'), async (req: Request, res: Response) => {
  try {
    const { provider, apiKey, apiEndpoint, configId } = req.body;
    
    let keyToValidate = apiKey;
    let endpointToValidate = apiEndpoint;
    let providerToValidate = provider;
    
    // 如果提供了 configId，从数据库获取真实的 API Key
    if (configId) {
      const config = await aiConfigService.getConfigById(configId);
      if (config) {
        keyToValidate = config.apiKey;
        endpointToValidate = endpointToValidate || config.baseUrl;
        providerToValidate = providerToValidate || config.provider;
      } else {
        return res.status(404).json(error('RES_NOT_FOUND', '配置不存在'));
      }
    }
    
    if (!providerToValidate || !keyToValidate) {
      return res.status(400).json(error('VALID_PARAM_MISSING', '缺少必要参数'));
    }

    const result = await aiConfigService.validateApiKey(providerToValidate, keyToValidate, endpointToValidate);
    res.json(success(result));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

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
