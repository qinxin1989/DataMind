import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';
import { User } from '../types';

// 扩展Express Request类型
declare global {
  namespace Express {
    interface Request {
      user?: User;
      token?: string;
    }
  }
}

export function createAuthMiddleware(authService: AuthService) {
  return (req: Request, res: Response, next: NextFunction) => {
    // 从Authorization header获取token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '缺少认证token' });
    }

    const token = authHeader.substring(7);

    try {
      const user = authService.verifyToken(token);
      req.user = user;
      req.token = token;
      next();
    } catch (error: any) {
      res.status(401).json({ error: error.message });
    }
  };
}

/**
 * 检查用户是否为管理员
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: '未认证' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限' });
  }

  next();
}

/**
 * 检查用户是否拥有数据源
 */
export function requireDataSourceOwnership(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: '未认证' });
  }

  // 这个中间件需要在路由处理器中检查，因为需要访问数据源信息
  // 这里只是标记，实际检查在路由处理器中进行
  next();
}
