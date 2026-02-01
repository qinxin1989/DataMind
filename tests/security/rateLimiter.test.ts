/**
 * Rate Limiter Tests
 * 
 * 测试请求频率限制功能
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RateLimiter } from '../../src/middleware/rateLimiter';

describe('Rate Limiter', () => {
  describe('Basic Functionality', () => {
    it('should allow requests within limit', () => {
      const limiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 5
      });
      
      for (let i = 0; i < 5; i++) {
        const result = limiter.check('test-key');
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(4 - i);
      }
    });
    
    it('should block requests exceeding limit', () => {
      const limiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 5
      });
      
      // 前5个请求应该通过
      for (let i = 0; i < 5; i++) {
        limiter.check('test-key');
      }
      
      // 第6个请求应该被阻止
      const result = limiter.check('test-key');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });
    
    it('should track different keys separately', () => {
      const limiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 3
      });
      
      // Key 1: 使用完限额
      limiter.check('key-1');
      limiter.check('key-1');
      limiter.check('key-1');
      
      // Key 2: 应该还有限额
      const result = limiter.check('key-2');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });
  });
  
  describe('Time Window', () => {
    it('should reset after time window', async () => {
      const limiter = new RateLimiter({
        windowMs: 100,  // 100ms 窗口
        maxRequests: 2
      });
      
      // 使用完限额
      limiter.check('test-key');
      limiter.check('test-key');
      expect(limiter.check('test-key').allowed).toBe(false);
      
      // 等待窗口过期
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // 应该可以再次请求
      const result = limiter.check('test-key');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1);
    });
    
    it('should use sliding window', async () => {
      const limiter = new RateLimiter({
        windowMs: 200,  // 200ms 窗口
        maxRequests: 3
      });
      
      // T=0: 第1个请求
      limiter.check('test-key');
      
      // T=50: 第2个请求
      await new Promise(resolve => setTimeout(resolve, 50));
      limiter.check('test-key');
      
      // T=100: 第3个请求
      await new Promise(resolve => setTimeout(resolve, 50));
      limiter.check('test-key');
      
      // T=100: 第4个请求应该被阻止
      expect(limiter.check('test-key').allowed).toBe(false);
      
      // T=250: 第1个请求已过期，应该可以再次请求
      await new Promise(resolve => setTimeout(resolve, 150));
      const result = limiter.check('test-key');
      expect(result.allowed).toBe(true);
    });
  });
  
  describe('Reset', () => {
    it('should reset key limit', () => {
      const limiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 2
      });
      
      // 使用完限额
      limiter.check('test-key');
      limiter.check('test-key');
      expect(limiter.check('test-key').allowed).toBe(false);
      
      // 重置
      limiter.reset('test-key');
      
      // 应该可以再次请求
      const result = limiter.check('test-key');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1);
    });
    
    it('should not affect other keys when resetting', () => {
      const limiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 2
      });
      
      limiter.check('key-1');
      limiter.check('key-2');
      
      limiter.reset('key-1');
      
      // Key 1 应该被重置
      expect(limiter.check('key-1').remaining).toBe(1);
      
      // Key 2 应该不受影响
      expect(limiter.check('key-2').remaining).toBe(0);
    });
  });
  
  describe('Remaining Count', () => {
    it('should return correct remaining count', () => {
      const limiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 5
      });
      
      expect(limiter.check('test-key').remaining).toBe(4);
      expect(limiter.check('test-key').remaining).toBe(3);
      expect(limiter.check('test-key').remaining).toBe(2);
      expect(limiter.check('test-key').remaining).toBe(1);
      expect(limiter.check('test-key').remaining).toBe(0);
      expect(limiter.check('test-key').remaining).toBe(0);
    });
  });
  
  describe('Reset Time', () => {
    it('should return correct reset time', () => {
      const limiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 5
      });
      
      const now = Date.now();
      const result = limiter.check('test-key');
      
      expect(result.resetTime).toBeGreaterThan(now);
      expect(result.resetTime).toBeLessThanOrEqual(now + 60000);
    });
    
    it('should update reset time based on oldest request', async () => {
      const limiter = new RateLimiter({
        windowMs: 1000,
        maxRequests: 5
      });
      
      const result1 = limiter.check('test-key');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const result2 = limiter.check('test-key');
      
      // resetTime 基于第一个请求，所以应该相同或非常接近
      // 允许1ms的误差
      expect(Math.abs(result2.resetTime - result1.resetTime)).toBeLessThan(2);
    });
  });
  
  describe('Statistics', () => {
    it('should return correct stats', () => {
      const limiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 10
      });
      
      limiter.check('key-1');
      limiter.check('key-2');
      limiter.check('key-3');
      
      const stats = limiter.getStats();
      
      expect(stats.totalKeys).toBe(3);
      expect(stats.windowMs).toBe(60000);
      expect(stats.maxRequests).toBe(10);
    });
  });
  
  describe('Cleanup', () => {
    it('should cleanup expired keys automatically', async () => {
      const limiter = new RateLimiter({
        windowMs: 100,  // 100ms 窗口
        maxRequests: 5
      });
      
      limiter.check('key-1');
      limiter.check('key-2');
      limiter.check('key-3');
      
      expect(limiter.getStats().totalKeys).toBe(3);
      
      // 等待窗口过期和清理
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // 清理后应该没有 key 了
      expect(limiter.getStats().totalKeys).toBe(0);
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle zero max requests', () => {
      const limiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 0
      });
      
      const result = limiter.check('test-key');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });
    
    it('should handle very short time window', async () => {
      const limiter = new RateLimiter({
        windowMs: 10,  // 10ms 窗口
        maxRequests: 2
      });
      
      limiter.check('test-key');
      limiter.check('test-key');
      
      expect(limiter.check('test-key').allowed).toBe(false);
      
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(limiter.check('test-key').allowed).toBe(true);
    });
    
    it('should handle very large max requests', () => {
      const limiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 1000000
      });
      
      for (let i = 0; i < 100; i++) {
        const result = limiter.check('test-key');
        expect(result.allowed).toBe(true);
      }
    });
  });
});
