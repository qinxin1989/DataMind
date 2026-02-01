/**
 * Rate Limiter Middleware
 * 
 * 实现请求频率限制，防止 DDoS 攻击和暴力破解
 */

import type { Request, Response, NextFunction } from 'express';

/**
 * Rate Limiter 配置
 */
export interface RateLimitConfig {
  windowMs: number;      // 时间窗口（毫秒）
  maxRequests: number;   // 最大请求数
  message?: string;      // 错误消息
  skipSuccessfulRequests?: boolean;  // 是否跳过成功的请求
  skipFailedRequests?: boolean;      // 是否跳过失败的请求
  keyGenerator?: (req: Request) => string;  // 自定义 key 生成器
}

/**
 * Rate Limiter 类
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private config: Required<RateLimitConfig>;
  
  constructor(config: RateLimitConfig) {
    this.config = {
      windowMs: config.windowMs,
      maxRequests: config.maxRequests,
      message: config.message || 'Too many requests',
      skipSuccessfulRequests: config.skipSuccessfulRequests || false,
      skipFailedRequests: config.skipFailedRequests || false,
      keyGenerator: config.keyGenerator || ((req) => req.user?.id || req.ip)
    };
    
    // 定期清理过期记录
    setInterval(() => this.cleanup(), this.config.windowMs);
  }
  
  /**
   * 检查是否超过限制
   */
  check(key: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    
    // 获取该 key 的请求记录
    let timestamps = this.requests.get(key) || [];
    
    // 清理过期记录
    timestamps = timestamps.filter(t => t > windowStart);
    
    // 检查是否超过限制
    const allowed = timestamps.length < this.config.maxRequests;
    
    // 如果允许，先记录本次请求，然后计算 remaining
    if (allowed) {
      timestamps.push(now);
      this.requests.set(key, timestamps);
    }
    
    // 计算剩余请求数（已经包含了本次请求）
    const remaining = Math.max(0, this.config.maxRequests - timestamps.length);
    const resetTime = timestamps.length > 0 
      ? timestamps[0] + this.config.windowMs 
      : now + this.config.windowMs;
    
    return { allowed, remaining, resetTime };
  }
  
  /**
   * 重置某个 key 的限制
   */
  reset(key: string): void {
    this.requests.delete(key);
  }
  
  /**
   * 清理所有过期记录
   */
  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    let cleanedCount = 0;
    
    for (const [key, timestamps] of this.requests.entries()) {
      const validTimestamps = timestamps.filter(t => t > windowStart);
      
      if (validTimestamps.length === 0) {
        this.requests.delete(key);
        cleanedCount++;
      } else if (validTimestamps.length < timestamps.length) {
        this.requests.set(key, validTimestamps);
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`[RateLimiter] Cleaned up ${cleanedCount} expired keys`);
    }
  }
  
  /**
   * 获取统计信息
   */
  getStats() {
    return {
      totalKeys: this.requests.size,
      windowMs: this.config.windowMs,
      maxRequests: this.config.maxRequests
    };
  }
}

/**
 * 创建 Rate Limit 中间件
 */
export function createRateLimitMiddleware(config: RateLimitConfig) {
  const limiter = new RateLimiter(config);
  
  return (req: Request, res: Response, next: NextFunction) => {
    const key = config.keyGenerator ? config.keyGenerator(req) : (req.user?.id || req.ip);
    const result = limiter.check(key);
    
    // 设置响应头
    res.setHeader('X-RateLimit-Limit', config.maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
    res.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());
    
    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());
      
      return res.status(429).json({
        error: 'Too many requests',
        message: config.message || 'Too many requests from this IP',
        retryAfter,
        resetTime: new Date(result.resetTime).toISOString()
      });
    }
    
    // 如果配置了跳过成功/失败请求，需要在响应后处理
    if (config.skipSuccessfulRequests || config.skipFailedRequests) {
      const originalSend = res.send;
      res.send = function(data: any) {
        const statusCode = res.statusCode;
        
        // 根据状态码决定是否计数
        const shouldSkip = 
          (config.skipSuccessfulRequests && statusCode >= 200 && statusCode < 300) ||
          (config.skipFailedRequests && (statusCode < 200 || statusCode >= 400));
        
        if (shouldSkip) {
          limiter.reset(key);
        }
        
        return originalSend.call(this, data);
      };
    }
    
    next();
  };
}

/**
 * 预定义的 Rate Limiter 配置
 */
export const RateLimitPresets = {
  // 全局限制：每分钟100个请求
  global: {
    windowMs: 60000,
    maxRequests: 100,
    message: 'Too many requests from this IP'
  },
  
  // 登录限制：每分钟5次
  login: {
    windowMs: 60000,
    maxRequests: 5,
    message: 'Too many login attempts',
    skipSuccessfulRequests: true  // 成功登录不计数
  },
  
  // API 限制：每分钟60个请求
  api: {
    windowMs: 60000,
    maxRequests: 60,
    message: 'API rate limit exceeded'
  },
  
  // 严格限制：每分钟10个请求
  strict: {
    windowMs: 60000,
    maxRequests: 10,
    message: 'Rate limit exceeded'
  },
  
  // 宽松限制：每分钟200个请求
  lenient: {
    windowMs: 60000,
    maxRequests: 200,
    message: 'Rate limit exceeded'
  }
};

/**
 * Rate Limiter 统计信息路由处理器
 */
export function getRateLimitStatsHandler(limiter: RateLimiter) {
  return (req: Request, res: Response) => {
    const stats = limiter.getStats();
    res.json(stats);
  };
}
