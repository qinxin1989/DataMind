/**
 * CSRF Protection Tests
 * 
 * 测试 CSRF 防护功能
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CSRFProtection } from '../../src/middleware/csrf';

describe('CSRF Protection', () => {
  let csrf: CSRFProtection;
  
  beforeEach(() => {
    csrf = new CSRFProtection(3600000); // 1小时过期
  });
  
  describe('Token Generation', () => {
    it('should generate valid token', () => {
      const token = csrf.generateToken('session-123');
      
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64); // 32 bytes = 64 hex chars
    });
    
    it('should generate different tokens for different sessions', () => {
      const token1 = csrf.generateToken('session-1');
      const token2 = csrf.generateToken('session-2');
      
      expect(token1).not.toBe(token2);
    });
    
    it('should generate different tokens for same session', () => {
      const token1 = csrf.generateToken('session-1');
      const token2 = csrf.generateToken('session-1');
      
      expect(token1).not.toBe(token2);
    });
  });
  
  describe('Token Validation', () => {
    it('should validate correct token', () => {
      const sessionId = 'session-123';
      const token = csrf.generateToken(sessionId);
      
      expect(csrf.validateToken(sessionId, token)).toBe(true);
    });
    
    it('should reject invalid token', () => {
      const sessionId = 'session-123';
      csrf.generateToken(sessionId);
      
      expect(csrf.validateToken(sessionId, 'invalid-token')).toBe(false);
    });
    
    it('should reject token for wrong session', () => {
      const token = csrf.generateToken('session-1');
      
      expect(csrf.validateToken('session-2', token)).toBe(false);
    });
    
    it('should reject token for non-existent session', () => {
      expect(csrf.validateToken('non-existent', 'any-token')).toBe(false);
    });
    
    it('should reject expired token', async () => {
      const csrf = new CSRFProtection(100); // 100ms 过期
      const sessionId = 'session-123';
      const token = csrf.generateToken(sessionId);
      
      // 等待 Token 过期
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(csrf.validateToken(sessionId, token)).toBe(false);
    });
    
    it('should allow token to be used multiple times before expiry', () => {
      const sessionId = 'session-123';
      const token = csrf.generateToken(sessionId);
      
      expect(csrf.validateToken(sessionId, token)).toBe(true);
      expect(csrf.validateToken(sessionId, token)).toBe(true);
      expect(csrf.validateToken(sessionId, token)).toBe(true);
    });
  });
  
  describe('Token Management', () => {
    it('should delete token', () => {
      const sessionId = 'session-123';
      const token = csrf.generateToken(sessionId);
      
      csrf.deleteToken(sessionId);
      
      expect(csrf.validateToken(sessionId, token)).toBe(false);
    });
    
    it('should overwrite old token when generating new one', () => {
      const sessionId = 'session-123';
      const token1 = csrf.generateToken(sessionId);
      const token2 = csrf.generateToken(sessionId);
      
      expect(csrf.validateToken(sessionId, token1)).toBe(false);
      expect(csrf.validateToken(sessionId, token2)).toBe(true);
    });
  });
  
  describe('Statistics', () => {
    it('should return correct stats', () => {
      csrf.generateToken('session-1');
      csrf.generateToken('session-2');
      csrf.generateToken('session-3');
      
      const stats = csrf.getStats();
      
      expect(stats.totalTokens).toBe(3);
      expect(stats.tokenExpiry).toBe(3600000);
    });
    
    it('should update stats after deletion', () => {
      csrf.generateToken('session-1');
      csrf.generateToken('session-2');
      csrf.deleteToken('session-1');
      
      const stats = csrf.getStats();
      
      expect(stats.totalTokens).toBe(1);
    });
  });
  
  describe('Cleanup', () => {
    it('should cleanup expired tokens automatically', async () => {
      // 创建一个清理间隔很短的实例用于测试
      const csrf = new CSRFProtection(100); // 100ms 过期
      
      // 手动触发清理（因为自动清理间隔是5分钟）
      csrf.generateToken('session-1');
      csrf.generateToken('session-2');
      csrf.generateToken('session-3');
      
      expect(csrf.getStats().totalTokens).toBe(3);
      
      // 等待 Token 过期
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // 手动验证一个过期 Token 会触发删除
      csrf.validateToken('session-1', 'any-token');
      csrf.validateToken('session-2', 'any-token');
      csrf.validateToken('session-3', 'any-token');
      
      // 验证后过期的 Token 应该被删除
      expect(csrf.getStats().totalTokens).toBe(0);
    });
  });
});
