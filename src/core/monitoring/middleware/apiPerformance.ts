/**
 * API 性能监控中间件
 * 自动记录所有 API 请求的性能指标
 */

import { Request, Response, NextFunction } from 'express';
import { performanceCollector } from '../PerformanceCollector';

/**
 * API 性能监控中间件
 */
export function apiPerformanceMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  // 监听响应完成事件
  res.on('finish', () => {
    const duration = Date.now() - start;

    // 记录 API 性能指标
    performanceCollector.recordApiMetric({
      method: req.method,
      path: req.path,
      duration,
      statusCode: res.statusCode,
      userId: (req as any).user?.id
    });
  });

  next();
}
