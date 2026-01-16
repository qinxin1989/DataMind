/**
 * 权限检查中间件
 * 实现路由级和按钮级权限控制
 */

import { Request, Response, NextFunction } from 'express';
import { permissionService } from '../services/permissionService';
import type { ApiResponse } from '../types';

// 注意：Express.Request.user 类型已在 src/middleware/auth.ts 中声明
// 这里不再重复声明，避免类型冲突

/** 权限中间件配置 */
export interface PermissionMiddlewareConfig {
  permissionCode: string;
  onDenied?: (req: Request, res: Response) => void;
}

/**
 * 创建权限检查中间件
 * @param permissionCode 需要的权限编码
 */
export function requirePermission(permissionCode: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 检查用户是否已认证
      if (!req.user?.id) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'AUTH_TOKEN_MISSING',
            message: '请先登录',
          },
          timestamp: Date.now(),
        };
        return res.status(401).json(response);
      }

      // 检查权限
      const hasPermission = await permissionService.hasPermission(req.user.id, permissionCode);

      if (!hasPermission) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'PERM_ACCESS_DENIED',
            message: '没有权限执行此操作',
          },
          timestamp: Date.now(),
        };
        return res.status(403).json(response);
      }

      next();
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'SYS_INTERNAL_ERROR',
          message: '权限检查失败',
        },
        timestamp: Date.now(),
      };
      return res.status(500).json(response);
    }
  };
}

/**
 * 创建任一权限检查中间件
 * @param permissionCodes 权限编码列表（满足任一即可）
 */
export function requireAnyPermission(permissionCodes: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'AUTH_TOKEN_MISSING',
            message: '请先登录',
          },
          timestamp: Date.now(),
        };
        return res.status(401).json(response);
      }

      const hasPermission = await permissionService.hasAnyPermission(req.user.id, permissionCodes);

      if (!hasPermission) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'PERM_ACCESS_DENIED',
            message: '没有权限执行此操作',
          },
          timestamp: Date.now(),
        };
        return res.status(403).json(response);
      }

      next();
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'SYS_INTERNAL_ERROR',
          message: '权限检查失败',
        },
        timestamp: Date.now(),
      };
      return res.status(500).json(response);
    }
  };
}

/**
 * 创建所有权限检查中间件
 * @param permissionCodes 权限编码列表（需要全部满足）
 */
export function requireAllPermissions(permissionCodes: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'AUTH_TOKEN_MISSING',
            message: '请先登录',
          },
          timestamp: Date.now(),
        };
        return res.status(401).json(response);
      }

      const hasPermission = await permissionService.hasAllPermissions(req.user.id, permissionCodes);

      if (!hasPermission) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'PERM_ACCESS_DENIED',
            message: '没有权限执行此操作',
          },
          timestamp: Date.now(),
        };
        return res.status(403).json(response);
      }

      next();
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'SYS_INTERNAL_ERROR',
          message: '权限检查失败',
        },
        timestamp: Date.now(),
      };
      return res.status(500).json(response);
    }
  };
}

/**
 * 检查是否为超级管理员
 */
export function requireSuperAdmin() {
  return requirePermission('*');
}

/**
 * 检查是否为管理员（超级管理员或普通管理员）
 */
export function requireAdmin() {
  return requireAnyPermission(['*', 'admin:access']);
}

/**
 * 资源所有者检查中间件
 * 检查用户是否为资源所有者或有管理权限
 */
export function requireOwnerOrPermission(
  getOwnerId: (req: Request) => string | Promise<string>,
  permissionCode: string
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'AUTH_TOKEN_MISSING',
            message: '请先登录',
          },
          timestamp: Date.now(),
        };
        return res.status(401).json(response);
      }

      // 检查是否为资源所有者
      const ownerId = await getOwnerId(req);
      if (ownerId === req.user.id) {
        return next();
      }

      // 检查是否有管理权限
      const hasPermission = await permissionService.hasPermission(req.user.id, permissionCode);
      if (hasPermission) {
        return next();
      }

      const response: ApiResponse = {
        success: false,
        error: {
          code: 'PERM_ACCESS_DENIED',
          message: '没有权限执行此操作',
        },
        timestamp: Date.now(),
      };
      return res.status(403).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'SYS_INTERNAL_ERROR',
          message: '权限检查失败',
        },
        timestamp: Date.now(),
      };
      return res.status(500).json(response);
    }
  };
}
