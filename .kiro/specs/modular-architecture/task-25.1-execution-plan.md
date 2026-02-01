# Task 25.1 执行计划 - 代码安全审计

**任务**: Task 25.1 - 代码安全审计  
**开始时间**: 2026-02-01  
**预计耗时**: 1天  
**优先级**: P0 (最高)

---

## 执行摘要

修复所有已知的安全漏洞，实现缺失的安全机制，并进行全面的代码安全审计。

---

## 工作清单

### 阶段1: 修复依赖漏洞 (4小时)

#### 1.1 升级 sm-crypto (严重) ⏳
**状态**: 进行中  
**优先级**: P0  
**预计时间**: 2小时

**漏洞详情**:
- SM2-DSA签名伪造 (GHSA-hpwg-xg7m-3p6m)
- SM2-DSA签名可塑性 (GHSA-qv7w-v773-3xqm)
- SM2-PKE私钥恢复 (GHSA-pgx9-497m-6c4v)

**修复步骤**:
1. [ ] 备份当前版本
2. [ ] 升级到 sm-crypto@0.4.0
3. [ ] 检查破坏性更新
4. [ ] 更新相关代码
5. [ ] 运行测试验证
6. [ ] 验证加密功能正常

**命令**:
```bash
npm install sm-crypto@0.4.0
```

**影响评估**:
- 破坏性更新: 是
- 需要代码修改: 可能
- 测试范围: 加密相关功能

---

#### 1.2 修复 tar 漏洞 (高危) ⏳
**状态**: 待开始  
**优先级**: P1  
**预计时间**: 30分钟

**漏洞详情**:
- 任意文件覆盖 (GHSA-8qq5-rm4j-mr97)
- 竞态条件 (GHSA-r6q2-hw4h-h46w)
- 硬链接路径遍历 (GHSA-34x7-hfp2-rc4v)

**修复步骤**:
1. [ ] 运行 npm audit fix
2. [ ] 验证文件操作功能
3. [ ] 运行相关测试

**命令**:
```bash
npm audit fix
```

**影响评估**:
- 破坏性更新: 否
- 需要代码修改: 否
- 测试范围: 文件上传/下载功能

---

#### 1.3 评估 xlsx 替代方案 (高危) ⏳
**状态**: 待开始  
**优先级**: P1  
**预计时间**: 4小时

**漏洞详情**:
- 原型污染 (GHSA-4r6h-8v6p-xvw6)
- 正则表达式拒绝服务 (GHSA-5pgg-2g8v-p4x9)

**评估选项**:

**选项1: 等待上游修复**
- 优点: 无需修改代码
- 缺点: 时间不确定
- 风险: 高

**选项2: 使用 exceljs 替代**
- 优点: 活跃维护，无已知漏洞
- 缺点: 需要修改代码
- 风险: 中
- 工作量: 4-6小时

**选项3: 限制 xlsx 功能使用**
- 优点: 快速实施
- 缺点: 功能受限
- 风险: 中
- 工作量: 2小时

**推荐方案**: 选项2 - 使用 exceljs 替代

**实施步骤**:
1. [ ] 安装 exceljs
2. [ ] 识别所有使用 xlsx 的代码
3. [ ] 迁移到 exceljs API
4. [ ] 运行测试验证
5. [ ] 卸载 xlsx

**命令**:
```bash
npm install exceljs
npm uninstall xlsx
```

---

### 阶段2: 实现 CSRF 防护 (4小时)

#### 2.1 后端实现 ⏳
**状态**: 待开始  
**预计时间**: 2小时

**实现内容**:

**2.1.1 CSRF Token 生成器**
```typescript
// src/middleware/csrf.ts
import crypto from 'crypto';

export class CSRFProtection {
  private tokens: Map<string, { token: string; expires: number }> = new Map();
  
  generateToken(sessionId: string): string {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + 3600000; // 1小时
    this.tokens.set(sessionId, { token, expires });
    return token;
  }
  
  validateToken(sessionId: string, token: string): boolean {
    const stored = this.tokens.get(sessionId);
    if (!stored) return false;
    if (stored.expires < Date.now()) {
      this.tokens.delete(sessionId);
      return false;
    }
    return stored.token === token;
  }
}
```

**2.1.2 CSRF 中间件**
```typescript
// src/middleware/csrf.ts
export function csrfMiddleware(req: Request, res: Response, next: NextFunction) {
  // 白名单路由（GET、HEAD、OPTIONS 不需要验证）
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // 获取 Token
  const token = req.headers['x-csrf-token'] || req.body._csrf;
  const sessionId = req.session?.id;
  
  if (!sessionId || !token) {
    return res.status(403).json({ error: 'CSRF token missing' });
  }
  
  // 验证 Token
  if (!csrfProtection.validateToken(sessionId, token)) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  
  next();
}
```

**2.1.3 集成到应用**
```typescript
// src/index.ts
import { csrfMiddleware } from './middleware/csrf';

app.use(csrfMiddleware);
```

---

#### 2.2 前端实现 ⏳
**状态**: 待开始  
**预计时间**: 1小时

**实现内容**:

**2.2.1 获取 CSRF Token**
```typescript
// admin-ui/src/utils/csrf.ts
export async function getCSRFToken(): Promise<string> {
  const response = await fetch('/api/csrf-token');
  const data = await response.json();
  return data.token;
}
```

**2.2.2 Axios 拦截器**
```typescript
// admin-ui/src/api/index.ts
import axios from 'axios';
import { getCSRFToken } from '@/utils/csrf';

// 请求拦截器
axios.interceptors.request.use(async (config) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(config.method?.toUpperCase() || '')) {
    const token = await getCSRFToken();
    config.headers['X-CSRF-Token'] = token;
  }
  return config;
});

// 响应拦截器（处理 Token 过期）
axios.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 403 && error.response?.data?.error === 'Invalid CSRF token') {
      // Token 过期，重新获取并重试
      const token = await getCSRFToken();
      error.config.headers['X-CSRF-Token'] = token;
      return axios.request(error.config);
    }
    return Promise.reject(error);
  }
);
```

---

#### 2.3 测试 CSRF 防护 ⏳
**状态**: 待开始  
**预计时间**: 1小时

**测试内容**:

**2.3.1 单元测试**
```typescript
// tests/security/csrf.test.ts
import { describe, it, expect } from 'vitest';
import { CSRFProtection } from '@/middleware/csrf';

describe('CSRF Protection', () => {
  it('should generate valid token', () => {
    const csrf = new CSRFProtection();
    const token = csrf.generateToken('session-123');
    expect(token).toBeTruthy();
    expect(token.length).toBe(64);
  });
  
  it('should validate correct token', () => {
    const csrf = new CSRFProtection();
    const token = csrf.generateToken('session-123');
    expect(csrf.validateToken('session-123', token)).toBe(true);
  });
  
  it('should reject invalid token', () => {
    const csrf = new CSRFProtection();
    csrf.generateToken('session-123');
    expect(csrf.validateToken('session-123', 'invalid-token')).toBe(false);
  });
  
  it('should reject expired token', async () => {
    const csrf = new CSRFProtection();
    const token = csrf.generateToken('session-123');
    
    // 模拟时间流逝
    await new Promise(resolve => setTimeout(resolve, 3700000)); // 超过1小时
    
    expect(csrf.validateToken('session-123', token)).toBe(false);
  });
});
```

**2.3.2 集成测试**
```typescript
// tests/security/csrf-integration.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '@/index';

describe('CSRF Integration', () => {
  it('should allow GET requests without token', async () => {
    const response = await request(app).get('/api/users');
    expect(response.status).not.toBe(403);
  });
  
  it('should reject POST without token', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({ username: 'test' });
    expect(response.status).toBe(403);
    expect(response.body.error).toBe('CSRF token missing');
  });
  
  it('should allow POST with valid token', async () => {
    // 获取 Token
    const tokenResponse = await request(app).get('/api/csrf-token');
    const token = tokenResponse.body.token;
    
    // 使用 Token 发送请求
    const response = await request(app)
      .post('/api/users')
      .set('X-CSRF-Token', token)
      .send({ username: 'test' });
    expect(response.status).not.toBe(403);
  });
});
```

---

### 阶段3: 实现请求频率限制 (3小时)

#### 3.1 实现 Rate Limiter ⏳
**状态**: 待开始  
**预计时间**: 2小时

**实现内容**:

**3.1.1 Rate Limiter 类**
```typescript
// src/middleware/rateLimiter.ts
export interface RateLimitConfig {
  windowMs: number;  // 时间窗口（毫秒）
  maxRequests: number;  // 最大请求数
  message?: string;  // 错误消息
}

export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  
  constructor(private config: RateLimitConfig) {}
  
  check(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    
    // 获取该 key 的请求记录
    let timestamps = this.requests.get(key) || [];
    
    // 清理过期记录
    timestamps = timestamps.filter(t => t > windowStart);
    
    // 检查是否超过限制
    if (timestamps.length >= this.config.maxRequests) {
      return false;
    }
    
    // 记录本次请求
    timestamps.push(now);
    this.requests.set(key, timestamps);
    
    return true;
  }
  
  reset(key: string): void {
    this.requests.delete(key);
  }
}
```

**3.1.2 Rate Limit 中间件**
```typescript
// src/middleware/rateLimiter.ts
export function createRateLimitMiddleware(config: RateLimitConfig) {
  const limiter = new RateLimiter(config);
  
  return (req: Request, res: Response, next: NextFunction) => {
    // 基于 IP 或用户 ID 限制
    const key = req.user?.id || req.ip;
    
    if (!limiter.check(key)) {
      return res.status(429).json({
        error: config.message || 'Too many requests',
        retryAfter: Math.ceil(config.windowMs / 1000)
      });
    }
    
    next();
  };
}
```

**3.1.3 应用到 API**
```typescript
// src/index.ts
import { createRateLimitMiddleware } from './middleware/rateLimiter';

// 全局限制：每分钟100个请求
app.use(createRateLimitMiddleware({
  windowMs: 60000,
  maxRequests: 100,
  message: 'Too many requests from this IP'
}));

// API 特定限制：登录接口每分钟5次
app.post('/api/auth/login', 
  createRateLimitMiddleware({
    windowMs: 60000,
    maxRequests: 5,
    message: 'Too many login attempts'
  }),
  loginHandler
);
```

---

#### 3.2 测试 Rate Limiter ⏳
**状态**: 待开始  
**预计时间**: 1小时

**测试内容**:

```typescript
// tests/security/rateLimiter.test.ts
import { describe, it, expect } from 'vitest';
import { RateLimiter } from '@/middleware/rateLimiter';

describe('Rate Limiter', () => {
  it('should allow requests within limit', () => {
    const limiter = new RateLimiter({
      windowMs: 60000,
      maxRequests: 5
    });
    
    for (let i = 0; i < 5; i++) {
      expect(limiter.check('test-key')).toBe(true);
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
    expect(limiter.check('test-key')).toBe(false);
  });
  
  it('should reset after time window', async () => {
    const limiter = new RateLimiter({
      windowMs: 100,  // 100ms 窗口
      maxRequests: 2
    });
    
    // 使用完限额
    limiter.check('test-key');
    limiter.check('test-key');
    expect(limiter.check('test-key')).toBe(false);
    
    // 等待窗口过期
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // 应该可以再次请求
    expect(limiter.check('test-key')).toBe(true);
  });
});
```

---

### 阶段4: 代码安全审计 (4小时)

#### 4.1 SQL 注入审计 ⏳
**状态**: 待开始  
**预计时间**: 1.5小时

**审计范围**:
- [ ] src/admin/modules/*/service.ts
- [ ] src/datasource/*.ts
- [ ] modules/*/backend/service.ts

**审计清单**:
- [ ] 所有数据库查询使用参数化
- [ ] 无动态 SQL 拼接
- [ ] 输入验证完整

**工具**:
```bash
# 搜索可能的 SQL 注入点
grep -r "query.*\${" src/
grep -r "query.*\+" src/
grep -r "execute.*\${" src/
```

---

#### 4.2 XSS 审计 ⏳
**状态**: 待开始  
**预计时间**: 1.5小时

**审计范围**:
- [ ] admin-ui/src/views/**/*.vue
- [ ] admin-ui/src/components/**/*.vue

**审计清单**:
- [ ] 所有用户输入经过验证
- [ ] 所有输出经过转义
- [ ] v-html 使用受限
- [ ] 无 eval() 或 Function() 使用

**工具**:
```bash
# 搜索可能的 XSS 点
grep -r "v-html" admin-ui/src/
grep -r "innerHTML" admin-ui/src/
grep -r "eval(" src/
```

---

#### 4.3 权限控制审计 ⏳
**状态**: 待开始  
**预计时间**: 1小时

**审计范围**:
- [ ] src/admin/modules/*/routes.ts
- [ ] modules/*/backend/routes.ts

**审计清单**:
- [ ] 所有 API 端点有权限验证
- [ ] 权限检查在业务逻辑之前
- [ ] 无权限绕过漏洞

**工具**:
```bash
# 搜索没有权限检查的路由
grep -r "router\\.post" src/ | grep -v "checkPermission"
grep -r "router\\.put" src/ | grep -v "checkPermission"
grep -r "router\\.delete" src/ | grep -v "checkPermission"
```

---

## 验收标准

### 必须完成
- [ ] sm-crypto 已升级到 0.4.0
- [ ] tar 漏洞已修复
- [ ] xlsx 已替换为 exceljs
- [ ] CSRF 防护已实现并测试
- [ ] 请求频率限制已实现并测试
- [ ] SQL 注入审计已完成
- [ ] XSS 审计已完成
- [ ] 权限控制审计已完成
- [ ] 所有测试通过

### 质量标准
- [ ] 无高危漏洞
- [ ] 无 SQL 注入风险
- [ ] 无 XSS 风险
- [ ] 所有 API 有权限验证
- [ ] CSRF 测试覆盖率 100%
- [ ] Rate Limiter 测试覆盖率 100%

---

## 输出文档

1. **dependency-fix-report.md** - 依赖漏洞修复报告
2. **csrf-implementation.md** - CSRF 防护实现文档
3. **rate-limiter-implementation.md** - 频率限制实现文档
4. **code-audit-report.md** - 代码审计报告
5. **task-25.1-completion.md** - Task 25.1 完成报告

---

**创建时间**: 2026-02-01  
**创建人**: Kiro AI Assistant  
**版本**: 1.0
