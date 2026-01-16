/**
 * 审计中间件
 * 自动记录 API 操作日志
 */

import { Request, Response, NextFunction } from 'express';
import { auditService } from '../modules/audit/auditService';
import type { AuditAction } from '../types';

/** 敏感操作列表 */
const SENSITIVE_OPERATIONS = [
  'user:delete',
  'role:delete',
  'permission:grant',
  'permission:revoke',
  'system:config',
  'datasource:delete',
];

/** HTTP 方法到审计操作的映射 */
const METHOD_ACTION_MAP: Record<string, AuditAction> = {
  GET: 'read',
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete',
};

/** 路径到资源类型的映射 */
function getResourceType(path: string): string {
  const segments = path.split('/').filter(Boolean);
  if (segments.length >= 2 && segments[0] === 'api' && segments[1] === 'admin') {
    return segments[2] || 'unknown';
  }
  if (segments.length >= 1) {
    return segments[0];
  }
  return 'unknown';
}

/** 获取资源 ID */
function getResourceId(req: Request): string {
  return req.params.id || req.body?.id || '';
}

/** 获取客户端 IP */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

/** 审计中间件配置 */
export interface AuditMiddlewareConfig {
  /** 是否记录 GET 请求 */
  logReads?: boolean;
  /** 排除的路径模式 */
  excludePaths?: RegExp[];
  /** 敏感操作需要额外确认 */
  sensitiveOperations?: string[];
}

/**
 * 创建审计中间件
 */
export function auditMiddleware(config: AuditMiddlewareConfig = {}) {
  const { logReads = false, excludePaths = [] } = config;

  return async (req: Request, res: Response, next: NextFunction) => {
    // 检查是否排除
    const shouldExclude = excludePaths.some(pattern => pattern.test(req.path));
    if (shouldExclude) {
      return next();
    }

    // GET 请求默认不记录
    if (req.method === 'GET' && !logReads) {
      return next();
    }

    // 保存原始 json 方法
    const originalJson = res.json.bind(res);

    // 重写 json 方法以捕获响应
    res.json = function (body: any) {
      // 异步记录日志，不阻塞响应
      if (req.user?.id) {
        const action = METHOD_ACTION_MAP[req.method] || 'read';
        const resourceType = getResourceType(req.path);
        const resourceId = getResourceId(req);

        auditService.log({
          userId: req.user.id,
          username: req.user.username || 'unknown',
          action,
          resourceType,
          resourceId,
          newValue: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
          ip: getClientIp(req),
          userAgent: req.headers['user-agent'] || 'unknown',
        }).catch(err => {
          console.error('Failed to log audit:', err);
        });
      }

      return originalJson(body);
    };

    next();
  };
}

/**
 * 敏感操作确认中间件
 */
export function requireConfirmation(operationCode: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const confirmation = req.headers['x-confirm-operation'];
    
    if (confirmation !== operationCode) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BIZ_CONFIRMATION_REQUIRED',
          message: '此操作需要确认',
          details: { operationCode },
        },
        timestamp: Date.now(),
      });
    }

    next();
  };
}

/**
 * 手动记录审计日志的辅助函数
 */
export async function logAudit(
  req: Request,
  action: AuditAction,
  resourceType: string,
  resourceId: string,
  oldValue?: any,
  newValue?: any
): Promise<void> {
  if (!req.user?.id) return;

  await auditService.log({
    userId: req.user.id,
    username: req.user.username || 'unknown',
    action,
    resourceType,
    resourceId,
    oldValue: oldValue ? JSON.stringify(oldValue) : undefined,
    newValue: newValue ? JSON.stringify(newValue) : undefined,
    ip: getClientIp(req),
    userAgent: req.headers['user-agent'] || 'unknown',
  });
}
