# Task 24.4 执行计划 - 性能监控

**任务编号**: Task 24.4  
**任务名称**: 性能监控  
**优先级**: 高  
**预计耗时**: 1天  
**开始时间**: 2026-02-01

---

## 执行摘要

建立完善的性能监控体系,实现性能指标收集、监控面板、告警规则和性能报告。通过实时监控系统性能,及时发现和解决性能问题。

### 目标
- 实现性能指标收集
- 创建性能监控面板
- 设置性能告警规则
- 实现性能报告生成

---

## 实施步骤

### 步骤 1: 实现性能指标收集器

**目标**: 收集系统各项性能指标

#### 1.1 创建性能指标收集器

**文件**: `src/core/monitoring/PerformanceCollector.ts`

**功能**:
- 收集 API 响应时间
- 收集数据库查询时间
- 收集模块加载时间
- 收集前端渲染时间
- 收集内存使用情况
- 收集 CPU 使用情况

**数据结构**:
```typescript
interface PerformanceMetric {
  id: string;
  type: 'api' | 'database' | 'module' | 'frontend' | 'system';
  name: string;
  duration: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

interface SystemMetrics {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
  };
  timestamp: Date;
}
```

#### 1.2 实现中间件集成

**API 性能监控中间件**:
```typescript
// src/core/monitoring/middleware/apiPerformance.ts
export function apiPerformanceMiddleware(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    collector.recordApiMetric({
      method: req.method,
      path: req.path,
      duration,
      statusCode: res.statusCode
    });
  });
  
  next();
}
```

**数据库查询监控**:
```typescript
// 在数据库查询前后记录时间
const start = Date.now();
const result = await db.query(sql);
const duration = Date.now() - start;
collector.recordDatabaseMetric({ sql, duration });
```

---

### 步骤 2: 创建性能监控面板

**目标**: 提供可视化的性能监控界面

#### 2.1 创建后端 API

**文件**: `src/admin/modules/monitoring/routes.ts`

**API 端点**:
- `GET /api/monitoring/metrics` - 获取实时性能指标
- `GET /api/monitoring/metrics/history` - 获取历史性能数据
- `GET /api/monitoring/slow-queries` - 获取慢查询列表
- `GET /api/monitoring/system` - 获取系统资源使用情况
- `GET /api/monitoring/alerts` - 获取性能告警列表

#### 2.2 创建前端监控面板

**文件**: `admin-ui/src/views/monitoring/Performance.vue`

**功能模块**:
1. **实时性能指标卡片**
   - API 平均响应时间
   - 数据库平均查询时间
   - 当前 QPS
   - 系统资源使用率

2. **性能趋势图表**
   - API 响应时间趋势 (折线图)
   - 数据库查询时间趋势 (折线图)
   - QPS 趋势 (面积图)
   - 系统资源使用趋势 (折线图)

3. **慢查询列表**
   - 显示执行时间 > 100ms 的查询
   - 显示查询 SQL
   - 显示执行时间
   - 显示执行次数

4. **性能告警列表**
   - 显示触发的告警
   - 显示告警级别
   - 显示告警时间
   - 显示告警详情

---

### 步骤 3: 实现性能告警系统

**目标**: 自动检测性能问题并发送告警

#### 3.1 创建告警规则引擎

**文件**: `src/core/monitoring/AlertEngine.ts`

**告警规则**:
```typescript
interface AlertRule {
  id: string;
  name: string;
  type: 'api' | 'database' | 'module' | 'system';
  condition: {
    metric: string;
    operator: '>' | '<' | '=' | '>=' | '<=';
    threshold: number;
    duration?: number; // 持续时间(秒)
  };
  severity: 'info' | 'warning' | 'error' | 'critical';
  enabled: boolean;
}
```

**预定义告警规则**:
1. API 响应时间 > 200ms (持续 1 分钟) - Warning
2. API 响应时间 > 500ms (持续 30 秒) - Error
3. 数据库查询 > 100ms (持续 1 分钟) - Warning
4. 数据库查询 > 500ms (持续 30 秒) - Error
5. 模块加载 > 1s - Warning
6. 错误率 > 1% (持续 1 分钟) - Error
7. 错误率 > 5% (持续 30 秒) - Critical
8. 内存使用 > 80% (持续 5 分钟) - Warning
9. 内存使用 > 90% (持续 1 分钟) - Critical
10. CPU 使用 > 80% (持续 5 分钟) - Warning

#### 3.2 实现告警通知

**通知渠道**:
- 系统内通知 (集成通知中心模块)
- 日志记录
- (可选) 邮件通知
- (可选) Webhook 通知

---

### 步骤 4: 实现性能报告生成

**目标**: 自动生成性能分析报告

#### 4.1 创建报告生成器

**文件**: `src/core/monitoring/ReportGenerator.ts`

**报告类型**:
1. **每日性能报告**
   - 当日性能概览
   - API 性能统计
   - 数据库性能统计
   - 慢查询 Top 10
   - 性能告警汇总

2. **每周性能趋势报告**
   - 本周 vs 上周性能对比
   - 性能趋势分析
   - 性能退化识别
   - 优化建议

**报告格式**:
- Markdown 格式
- 存储到数据库
- 可导出为 PDF (可选)

#### 4.2 实现定时任务

**使用 node-cron 实现定时报告生成**:
```typescript
// 每天凌晨 1 点生成日报
cron.schedule('0 1 * * *', async () => {
  await reportGenerator.generateDailyReport();
});

// 每周一凌晨 2 点生成周报
cron.schedule('0 2 * * 1', async () => {
  await reportGenerator.generateWeeklyReport();
});
```

---

### 步骤 5: 创建性能测试

**目标**: 验证性能监控系统功能

#### 5.1 创建性能监控测试

**文件**: `tests/monitoring/performance-monitoring.test.ts`

**测试覆盖**:
1. 性能指标收集测试
   - 测试 API 性能记录
   - 测试数据库性能记录
   - 测试系统指标收集

2. 告警规则测试
   - 测试告警触发条件
   - 测试告警通知
   - 测试告警恢复

3. 报告生成测试
   - 测试日报生成
   - 测试周报生成
   - 测试报告内容完整性

4. API 端点测试
   - 测试所有监控 API
   - 测试数据格式
   - 测试权限控制

---

## 数据库设计

### 性能指标表

```sql
CREATE TABLE IF NOT EXISTS performance_metrics (
  id VARCHAR(36) PRIMARY KEY,
  type ENUM('api', 'database', 'module', 'frontend', 'system') NOT NULL,
  name VARCHAR(255) NOT NULL,
  duration DECIMAL(10, 2),
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_type_created (type, created_at),
  INDEX idx_name_created (name, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 系统指标表

```sql
CREATE TABLE IF NOT EXISTS system_metrics (
  id VARCHAR(36) PRIMARY KEY,
  memory_used BIGINT NOT NULL,
  memory_total BIGINT NOT NULL,
  memory_percentage DECIMAL(5, 2) NOT NULL,
  cpu_usage DECIMAL(5, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 性能告警表

```sql
CREATE TABLE IF NOT EXISTS performance_alerts (
  id VARCHAR(36) PRIMARY KEY,
  rule_id VARCHAR(36) NOT NULL,
  rule_name VARCHAR(255) NOT NULL,
  severity ENUM('info', 'warning', 'error', 'critical') NOT NULL,
  message TEXT NOT NULL,
  metadata JSON,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_severity_created (severity, created_at),
  INDEX idx_resolved (resolved)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 性能报告表

```sql
CREATE TABLE IF NOT EXISTS performance_reports (
  id VARCHAR(36) PRIMARY KEY,
  type ENUM('daily', 'weekly') NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_type_period (type, period_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 实施顺序

### 第1阶段: 基础设施 (2-3小时)
1. 创建数据库表
2. 实现性能指标收集器
3. 实现中间件集成

### 第2阶段: 监控面板 (3-4小时)
1. 创建后端 API
2. 创建前端监控面板
3. 实现图表展示

### 第3阶段: 告警系统 (2-3小时)
1. 实现告警规则引擎
2. 实现告警通知
3. 配置预定义规则

### 第4阶段: 报告生成 (2小时)
1. 实现报告生成器
2. 配置定时任务
3. 测试报告生成

### 第5阶段: 测试和验证 (1-2小时)
1. 编写单元测试
2. 编写集成测试
3. 验证功能完整性

---

## 验收标准

### 功能验收
- [ ] 性能指标收集已实现
- [ ] 监控面板已创建
- [ ] 告警规则已配置
- [ ] 报告生成已实现
- [ ] 所有测试通过

### 性能验收
- [ ] 指标收集开销 < 1ms
- [ ] 监控面板加载 < 2s
- [ ] 告警响应时间 < 5s
- [ ] 报告生成 < 10s

### 质量验收
- [ ] 代码清晰易懂
- [ ] API 设计合理
- [ ] 界面友好易用
- [ ] 文档完整

---

## 交付物

### 代码
- [ ] `src/core/monitoring/PerformanceCollector.ts` - 性能指标收集器
- [ ] `src/core/monitoring/AlertEngine.ts` - 告警规则引擎
- [ ] `src/core/monitoring/ReportGenerator.ts` - 报告生成器
- [ ] `src/core/monitoring/middleware/apiPerformance.ts` - API 性能中间件
- [ ] `src/admin/modules/monitoring/routes.ts` - 监控 API
- [ ] `src/admin/modules/monitoring/service.ts` - 监控服务
- [ ] `admin-ui/src/views/monitoring/Performance.vue` - 监控面板

### 数据库
- [ ] `migrations/create-performance-monitoring-tables.sql` - 监控表迁移

### 测试
- [ ] `tests/monitoring/performance-monitoring.test.ts` - 监控系统测试

### 文档
- [ ] `task-24.4-execution-plan.md` - 执行计划
- [ ] `task-24.4-completion.md` - 完成报告

---

## 技术选型

### 后端
- **性能指标收集**: 自定义实现
- **定时任务**: node-cron
- **系统指标**: os 模块 (Node.js 内置)

### 前端
- **图表库**: ECharts 或 Chart.js
- **实时更新**: WebSocket 或轮询

### 数据存储
- **短期数据**: MySQL (7天)
- **长期数据**: 聚合后存储 (可选)
- **缓存**: Redis (可选,用于实时指标)

---

## 风险和挑战

### 技术风险
1. **性能开销** - 监控本身可能影响性能
2. **数据量** - 大量指标数据可能占用存储
3. **实时性** - 实时监控可能有延迟

### 缓解措施
1. 优化指标收集,减少开销
2. 实现数据聚合和清理策略
3. 使用缓存提升实时性

---

## 优化建议

### 性能优化
1. 使用批量插入减少数据库写入
2. 实现指标采样,不记录所有请求
3. 使用 Redis 缓存实时指标

### 功能扩展
1. 支持自定义告警规则
2. 支持多种通知渠道
3. 支持性能对比分析
4. 支持性能预测

---

**创建时间**: 2026-02-01  
**创建人**: Kiro AI Assistant  
**状态**: 待执行
