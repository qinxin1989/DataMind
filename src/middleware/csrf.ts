/**
 * CSRF Protection Middleware
 * 
 * 实现 CSRF (Cross-Site Request Forgery) 防护
 * 使用 Token 验证机制防止跨站请求伪造攻击
 */

import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

/**
 * CSRF Token 存储接口
 */
interface CSRFToken {
  token: string;
  expires: number;
}

/**
 * CSRF 防护类
 */
export class CSRFProtection {
  private tokens: Map<string, CSRFToken> = new Map();
  private readonly tokenExpiry: number;
  
  constructor(tokenExpiryMs: number = 3600000) { // 默认1小时
    this.tokenExpiry = tokenExpiryMs;
    
    // 定期清理过期 Token
    setInterval(() => this.cleanupExpiredTokens(), 300000); // 每5分钟清理一次
  }
  
  /**
   * 生成 CSRF Token
   */
  generateToken(sessionId: string): string {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + this.tokenExpiry;
    
    this.tokens.set(sessionId, { token, expires });
    
    return token;
  }
  
  /**
   * 验证 CSRF Token
   */
  validateToken(sessionId: string, token: string): boolean {
    const stored = this.tokens.get(sessionId);
    
    if (!stored) {
      return false;
    }
    
    // 检查是否过期
    if (stored.expires < Date.now()) {
      this.tokens.delete(sessionId);
      return false;
    }
    
    // 验证 Token
    return stored.token === token;
  }
  
  /**
   * 删除 Token
   */
  deleteToken(sessionId: string): void {
    this.tokens.delete(sessionId);
  }
  
  /**
   * 清理过期 Token
   */
  private cleanupExpiredTokens(): void {
    const now = Date.now();
    const expiredSessions: string[] = [];
    
    for (const [sessionId, token] of this.tokens.entries()) {
      if (token.expires < now) {
        expiredSessions.push(sessionId);
      }
    }
    
    for (const sessionId of expiredSessions) {
      this.tokens.delete(sessionId);
    }
    
    if (expiredSessions.length > 0) {
      console.log(`[CSRF] Cleaned up ${expiredSessions.length} expired tokens`);
    }
  }
  
  /**
   * 获取统计信息
   */
  getStats() {
    return {
      totalTokens: this.tokens.size,
      tokenExpiry: this.tokenExpiry
    };
  }
}

// 全局 CSRF 防护实例
export const csrfProtection = new CSRFProtection();

/**
 * CSRF 中间件配置
 */
export interface CSRFMiddlewareOptions {
  // 白名单路由（不需要 CSRF 验证）
  whitelist?: string[];
  // 白名单方法（默认: GET, HEAD, OPTIONS）
  whitelistMethods?: string[];
  // 自定义 Token 提取函数
  getToken?: (req: Request) => string | undefined;
  // 自定义 Session ID 提取函数
  getSessionId?: (req: Request) => string | undefined;
}

/**
 * 创建 CSRF 中间件
 */
export function createCSRFMiddleware(options: CSRFMiddlewareOptions = {}) {
  const {
    whitelist = [],
    whitelistMethods = ['GET', 'HEAD', 'OPTIONS'],
    getToken = (req) => req.headers['x-csrf-token'] as string || req.body?._csrf,
    getSessionId = (req) => req.session?.id || req.ip
  } = options;
  
  return (req: Request, res: Response, next: NextFunction) => {
    // 检查是否在白名单方法中
    if (whitelistMethods.includes(req.method)) {
      return next();
    }
    
    // 检查是否在白名单路由中
    if (whitelist.some(pattern => req.path.startsWith(pattern))) {
      return next();
    }
    
    // 获取 Token 和 Session ID
    const token = getToken(req);
    const sessionId = getSessionId(req);
    
    if (!sessionId) {
      return res.status(403).json({
        error: 'CSRF validation failed',
        message: 'Session ID missing'
      });
    }
    
    if (!token) {
      return res.status(403).json({
        error: 'CSRF validation failed',
        message: 'CSRF token missing'
      });
    }
    
    // 验证 Token
    if (!csrfProtection.validateToken(sessionId, token)) {
      return res.status(403).json({
        error: 'CSRF validation failed',
        message: 'Invalid or expired CSRF token'
      });
    }
    
    next();
  };
}

/**
 * 获取 CSRF Token 的路由处理器
 */
export function getCSRFTokenHandler(req: Request, res: Response) {
  const sessionId = req.session?.id || req.ip;
  const token = csrfProtection.generateToken(sessionId);
  
  res.json({
    token,
    expiresIn: 3600 // 秒
  });
}

/**
 * CSRF 统计信息路由处理器
 */
export function getCSRFStatsHandler(req: Request, res: Response) {
  const stats = csrfProtection.getStats();
  res.json(stats);
}
