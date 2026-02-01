/**
 * AI配置管理 API 路由
 */

import { Router, Request, Response } from 'express';
import type { AIConfigService } from './service';
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
export function initRoutes(service: AIConfigService, requirePermission: any) {
  /**
   * GET /ai/configs - 获取所有 AI 配置
   */
  router.get('/configs', requirePermission('ai:view'), async (req: Request, res: Response) => {
    try {
      const configs = await service.getAllConfigs();
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
      const config = await service.getConfigById(req.params.id);
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
      const { name, provider, apiKey, apiEndpoint, model, embeddingModel, maxTokens, temperature, isDefault } = req.body;

      if (!name || !provider || !apiKey || !model) {
        return res.status(400).json(error('VALID_PARAM_MISSING', '缺少必要参数'));
      }

      const config = await service.createConfig({
        name,
        provider,
        apiKey,
        apiEndpoint,
        model,
        embeddingModel,
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
      await service.updatePriorities(priorities);
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
      const config = await service.updateConfig(req.params.id, req.body);
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
      const config = await service.getConfigById(req.params.id);
      if (!config) {
        return res.status(404).json(error('RES_NOT_FOUND', 'AI配置不存在'));
      }
      if (config.isDefault) {
        return res.status(400).json(error('BIZ_CANNOT_DELETE_DEFAULT', '不能删除默认配置'));
      }
      
      await service.deleteConfig(req.params.id);
      res.json(success({ message: '删除成功' }));
    } catch (err: any) {
      if (err.message.includes('不存在')) {
        return res.status(404).json(error('RES_NOT_FOUND', err.message));
      }
      res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
  });

  /**
   * PUT /ai/configs/:id/default - 设置默认配置
   */
  router.put('/configs/:id/default', requirePermission('ai:config'), async (req: Request, res: Response) => {
    try {
      const config = await service.setDefaultConfig(req.params.id);
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
      const { provider, apiKey, apiEndpoint, configId, model } = req.body;

      let keyToValidate = apiKey;
      let endpointToValidate = apiEndpoint;
      let providerToValidate = provider;
      let modelToValidate = model;

      // 如果提供了 configId，从数据库获取真实的配置信息
      if (configId) {
        const config = await service.getConfigById(configId);
        if (config) {
          keyToValidate = config.apiKey;
          endpointToValidate = endpointToValidate || config.baseUrl;
          providerToValidate = providerToValidate || config.provider;
          modelToValidate = modelToValidate || config.model;
        } else {
          return res.status(404).json(error('RES_NOT_FOUND', '配置不存在'));
        }
      }

      if (!providerToValidate || !keyToValidate) {
        return res.status(400).json(error('VALID_PARAM_MISSING', '缺少必要参数'));
      }

      const result = await service.validateApiKey({
        provider: providerToValidate,
        apiKey: keyToValidate,
        apiEndpoint: endpointToValidate,
        model: modelToValidate
      });
      
      res.json(success(result));
    } catch (err: any) {
      res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
  });

  return router;
}

export default router;
