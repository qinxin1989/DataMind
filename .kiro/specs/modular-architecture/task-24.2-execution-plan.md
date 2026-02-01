# Task 24.2 执行计划 - 优化数据库查询

**任务编号**: Task 24.2  
**任务名称**: 优化数据库查询  
**开始时间**: 2026-02-01  
**预计耗时**: 1天  
**优先级**: 高

---

## 执行摘要

基于 Task 23.2 的性能测试结果,当前数据库查询性能已经非常优秀(所有查询 < 5ms),但仍需要:
1. 分析慢查询日志,识别潜在问题
2. 检查索引覆盖情况
3. 优化复杂查询
4. 实现查询缓存机制

### 当前性能基线 (Task 23.2)
- 权限检查: 0.35ms ✅
- 菜单查询: 1.82ms ✅
- 用户查询: 2.45ms ✅
- 用户创建: 73.89ms ✅
- 批量操作: < 5ms ✅

### 优化目标
- 保持所有查询 < 50ms
- 添加必要索引
- 实现查询缓存
- 建立慢查询监控

---

## 实施步骤

### 步骤 1: 分析慢查询 (30分钟)

#### 1.1 启用 MySQL 慢查询日志

创建脚本启用慢查询日志:

```sql
-- 启用慢查询日志
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 0.05; -- 50ms
SET GLOBAL log_queries_not_using_indexes = 'ON';

-- 查看慢查询日志配置
SHOW VARIABLES LIKE 'slow_query%';
SHOW VARIABLES LIKE 'long_query_time';
```

#### 1.2 分析现有查询

检查所有核心服务的查询语句:
- PermissionService 的查询
- MenuService 的查询
- UserService 的查询
- RoleService 的查询
- ModuleRegistry 的查询

#### 1.3 使用 EXPLAIN 分析查询计划

对每个查询执行 EXPLAIN 分析:
```sql
EXPLAIN SELECT * FROM sys_permissions WHERE id = ?;
EXPLAIN SELECT * FROM sys_menus WHERE parent_id = ?;
EXPLAIN SELECT * FROM sys_users WHERE username = ?;
```

---

### 步骤 2: 检查和添加索引 (1小时)

#### 2.1 检查现有索引

```sql
-- 检查所有表的索引
SELECT 
  TABLE_NAME,
  INDEX_NAME,
  COLUMN_NAME,
  SEQ_IN_INDEX,
  INDEX_TYPE
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;
```

#### 2.2 识别缺失的索引

基于查询分析,识别需要添加的索引:

**sys_permissions 表**:
- [x] id (主键) - 已存在
- [ ] code (唯一索引) - 需要添加
- [ ] parent_id (普通索引) - 需要添加
- [ ] status (普通索引) - 需要添加

**sys_menus 表**:
- [x] id (主键) - 已存在
- [ ] parent_id (普通索引) - 需要添加
- [ ] path (唯一索引) - 需要添加
- [ ] status (普通索引) - 需要添加
- [ ] sort_order (普通索引) - 需要添加

**sys_users 表**:
- [x] id (主键) - 已存在
- [x] username (唯一索引) - 已存在
- [ ] email (唯一索引) - 需要添加
- [ ] status (普通索引) - 需要添加
- [ ] created_at (普通索引) - 需要添加

**sys_roles 表**:
- [x] id (主键) - 已存在
- [ ] code (唯一索引) - 需要添加
- [ ] status (普通索引) - 需要添加

**sys_modules 表**:
- [x] id (主键) - 已存在
- [x] name (唯一索引) - 已存在
- [ ] status (普通索引) - 需要添加
- [ ] enabled (普通索引) - 需要添加

#### 2.3 创建索引迁移脚本

创建 SQL 脚本添加缺失的索引:

```sql
-- 添加索引迁移脚本
-- migrations/add-performance-indexes.sql

-- sys_permissions 表索引
CREATE INDEX idx_permissions_code ON sys_permissions(code);
CREATE INDEX idx_permissions_parent_id ON sys_permissions(parent_id);
CREATE INDEX idx_permissions_status ON sys_permissions(status);

-- sys_menus 表索引
CREATE INDEX idx_menus_parent_id ON sys_menus(parent_id);
CREATE INDEX idx_menus_path ON sys_menus(path);
CREATE INDEX idx_menus_status ON sys_menus(status);
CREATE INDEX idx_menus_sort_order ON sys_menus(sort_order);

-- sys_users 表索引
CREATE INDEX idx_users_email ON sys_users(email);
CREATE INDEX idx_users_status ON sys_users(status);
CREATE INDEX idx_users_created_at ON sys_users(created_at);

-- sys_roles 表索引
CREATE INDEX idx_roles_code ON sys_roles(code);
CREATE INDEX idx_roles_status ON sys_roles(status);

-- sys_modules 表索引
CREATE INDEX idx_modules_status ON sys_modules(status);
CREATE INDEX idx_modules_enabled ON sys_modules(enabled);
```

---

### 步骤 3: 优化查询语句 (1小时)

#### 3.1 避免 SELECT *

检查所有服务代码,将 `SELECT *` 改为明确的字段列表:

```typescript
// 不好的做法
const users = await db.query('SELECT * FROM sys_users');

// 好的做法
const users = await db.query(`
  SELECT id, username, email, status, created_at 
  FROM sys_users
`);
```

#### 3.2 优化 JOIN 查询

检查并优化所有 JOIN 查询:

```typescript
// 优化前
const result = await db.query(`
  SELECT * FROM sys_users u
  LEFT JOIN sys_roles r ON u.role_id = r.id
  WHERE u.status = 'active'
`);

// 优化后
const result = await db.query(`
  SELECT 
    u.id, u.username, u.email,
    r.id as role_id, r.name as role_name
  FROM sys_users u
  LEFT JOIN sys_roles r ON u.role_id = r.id
  WHERE u.status = 'active'
  AND r.status = 'active'
`);
```

#### 3.3 优化分页查询

使用高效的分页策略:

```typescript
// 优化前 - 使用 OFFSET
const result = await db.query(`
  SELECT * FROM sys_users
  LIMIT 10 OFFSET 1000
`);

// 优化后 - 使用游标分页
const result = await db.query(`
  SELECT * FROM sys_users
  WHERE id > ?
  ORDER BY id
  LIMIT 10
`, [lastId]);
```

---

### 步骤 4: 实现查询缓存 (2小时)

#### 4.1 设计缓存策略

**缓存层级**:
1. 内存缓存 (Map) - 用于进程内缓存
2. Redis缓存 - 用于跨进程缓存

**缓存对象**:
- 权限列表 (TTL: 5分钟)
- 菜单树 (TTL: 5分钟)
- 用户信息 (TTL: 10分钟)
- 角色信息 (TTL: 10分钟)
- 模块列表 (TTL: 30分钟)

#### 4.2 实现缓存管理器

创建通用的缓存管理器:

```typescript
// src/core/cache/CacheManager.ts
export class CacheManager {
  private memoryCache: Map<string, CacheEntry>;
  private redis?: Redis;
  
  async get<T>(key: string): Promise<T | null>;
  async set<T>(key: string, value: T, ttl: number): Promise<void>;
  async delete(key: string): Promise<void>;
  async clear(pattern?: string): Promise<void>;
}
```

#### 4.3 集成到服务中

在核心服务中集成缓存:

```typescript
// src/admin/services/PermissionService.ts
export class PermissionService {
  private cache: CacheManager;
  
  async getAll(): Promise<Permission[]> {
    const cacheKey = 'permissions:all';
    
    // 尝试从缓存获取
    let permissions = await this.cache.get<Permission[]>(cacheKey);
    if (permissions) {
      return permissions;
    }
    
    // 从数据库查询
    permissions = await this.db.query('SELECT * FROM sys_permissions');
    
    // 写入缓存
    await this.cache.set(cacheKey, permissions, 300); // 5分钟
    
    return permissions;
  }
}
```

---

### 步骤 5: 创建性能测试 (1小时)

#### 5.1 创建数据库性能测试

```typescript
// tests/performance/database.perf.test.ts
describe('数据库查询性能测试', () => {
  test('权限查询性能', async () => {
    const start = performance.now();
    await permissionService.getAll();
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(50);
  });
  
  test('菜单查询性能', async () => {
    const start = performance.now();
    await menuService.getTree();
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(50);
  });
  
  test('用户查询性能', async () => {
    const start = performance.now();
    await userService.findById(1);
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(50);
  });
});
```

#### 5.2 创建缓存性能测试

```typescript
describe('缓存性能测试', () => {
  test('缓存命中性能', async () => {
    // 第一次查询 - 未命中
    const start1 = performance.now();
    await permissionService.getAll();
    const duration1 = performance.now() - start1;
    
    // 第二次查询 - 命中
    const start2 = performance.now();
    await permissionService.getAll();
    const duration2 = performance.now() - start2;
    
    // 缓存命中应该快至少10倍
    expect(duration2).toBeLessThan(duration1 / 10);
  });
});
```

---

## 验收标准

### 性能指标
- [ ] 所有查询 < 50ms
- [ ] 缓存命中率 > 80%
- [ ] 缓存查询 < 1ms
- [ ] 无慢查询 (> 50ms)

### 功能验收
- [ ] 慢查询日志已启用
- [ ] 必要索引已添加
- [ ] 查询语句已优化
- [ ] 查询缓存已实现
- [ ] 性能测试已通过

### 质量验收
- [ ] 索引使用率 > 90%
- [ ] 缓存失效策略正确
- [ ] 无数据一致性问题

---

## 交付物

### 代码
- [ ] `migrations/add-performance-indexes.sql` - 索引迁移脚本
- [ ] `src/core/cache/CacheManager.ts` - 缓存管理器
- [ ] `tests/performance/database.perf.test.ts` - 数据库性能测试

### 脚本
- [ ] `scripts/enable-slow-query-log.sql` - 启用慢查询日志
- [ ] `scripts/analyze-slow-queries.ts` - 分析慢查询
- [ ] `scripts/check-indexes.sql` - 检查索引

### 文档
- [ ] `task-24.2-completion.md` - 完成报告
- [ ] `database-optimization-guide.md` - 数据库优化指南

---

## 风险和挑战

### 技术风险
1. **索引开销** - 过多索引可能影响写入性能
2. **缓存一致性** - 缓存失效策略需要正确设计
3. **Redis依赖** - 需要确保Redis可用性

### 缓解措施
1. 只为高频查询添加索引,定期监控写入性能
2. 使用版本号或时间戳管理缓存,实现自动失效
3. 实现降级策略,Redis不可用时使用内存缓存

---

## 实施时间表

| 时间 | 任务 | 预计耗时 |
|------|------|---------|
| 09:00-09:30 | 分析慢查询 | 30分钟 |
| 09:30-10:30 | 检查和添加索引 | 1小时 |
| 10:30-11:30 | 优化查询语句 | 1小时 |
| 11:30-12:00 | 午休 | 30分钟 |
| 12:00-14:00 | 实现查询缓存 | 2小时 |
| 14:00-15:00 | 创建性能测试 | 1小时 |
| 15:00-15:30 | 测试和验证 | 30分钟 |
| 15:30-16:00 | 生成完成报告 | 30分钟 |

**总计**: 约6小时

---

**创建时间**: 2026-02-01  
**创建人**: Kiro AI Assistant  
**状态**: 待执行
