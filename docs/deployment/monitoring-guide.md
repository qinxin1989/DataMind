# AI 数据问答平台 - 监控和告警配置指南

**版本**: 1.0.0  
**日期**: 2026-02-01  
**适用范围**: 生产环境监控配置

---

## 目录

1. [监控概述](#监控概述)
2. [监控架构](#监控架构)
3. [配置步骤](#配置步骤)
4. [告警规则](#告警规则)
5. [日志收集](#日志收集)
6. [监控面板](#监控面板)
7. [常见问题](#常见问题)
8. [最佳实践](#最佳实践)

---

## 监控概述

### 监控目标

系统监控旨在实时掌握系统运行状态,及时发现和解决性能问题,确保系统稳定运行。

### 监控范围

- ✅ **API 性能监控**: 响应时间、错误率、吞吐量
- ✅ **数据库监控**: 查询性能、连接数、慢查询
- ✅ **模块监控**: 加载时间、启用状态、错误日志
- ✅ **系统资源监控**: CPU、内存、磁盘、网络
- ✅ **业务指标监控**: 用户活跃度、数据量、任务执行

### 监控工具

| 工具 | 用途 | 状态 |
|------|------|------|
| 内置监控系统 | 性能指标收集和告警 | ✅ 已实现 |
| PM2 监控 | 进程监控和管理 | ✅ 推荐使用 |
| MySQL 慢查询日志 | 数据库性能分析 | ✅ 需配置 |
| 系统日志 | 错误追踪和调试 | ✅ 已实现 |
| Grafana (可选) | 可视化监控面板 | ⏳ 可选 |

---

## 监控架构

### 系统架构图

```
┌─────────────────────────────────────────────────────────┐
│                      应用层                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │ API 服务 │  │ 模块系统 │  │ 数据库   │             │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘             │
│       │             │             │                     │
│       └─────────────┴─────────────┘                     │
│                     │                                   │
└─────────────────────┼───────────────────────────────────┘
                      │
┌─────────────────────┼───────────────────────────────────┐
│                监控层                                    │
│  ┌──────────────────▼────────────────────┐             │
│  │      性能指标收集器                    │             │
│  │  (PerformanceCollector)               │             │
│  └──────────────────┬────────────────────┘             │
│                     │                                   │
│  ┌──────────────────▼────────────────────┐             │
│  │      数据库存储                        │             │
│  │  - performance_metrics                │             │
│  │  - system_metrics                     │             │
│  │  - performance_alerts                 │             │
│  └──────────────────┬────────────────────┘             │
│                     │                                   │
│  ┌──────────────────▼────────────────────┐             │
│  │      告警规则引擎                      │             │
│  │  (AlertEngine)                        │             │
│  └──────────────────┬────────────────────┘             │
│                     │                                   │
└─────────────────────┼───────────────────────────────────┘
                      │
┌─────────────────────┼───────────────────────────────────┐
│                通知层                                    │
│  ┌──────────────────▼────────────────────┐             │
│  │      通知中心                          │             │
│  │  - 系统通知                            │             │
│  │  - 邮件通知 (可选)                     │             │
│  │  - Webhook (可选)                     │             │
│  └────────────────────────────────────────┘             │
└─────────────────────────────────────────────────────────┘
```

### 数据流

1. **指标收集**: 应用层产生性能数据 → 收集器批量收集
2. **数据存储**: 收集器 → 数据库 (批量插入,5秒刷新)
3. **告警检查**: 告警引擎定期查询数据库 (30秒周期)
4. **告警触发**: 检测到异常 → 创建告警记录 → 发送通知
5. **报告生成**: 定时任务 → 生成日报/周报 → 存储到数据库

---

## 配置步骤

### 1. 数据库配置

#### 1.1 创建监控表

```bash
# 执行监控表创建脚本
mysql -u root -p ai_qa_platform < migrations/create-performance-monitoring-tables.sql
```

#### 1.2 验证表创建

```sql
-- 检查表是否创建成功
SHOW TABLES LIKE 'performance_%';
SHOW TABLES LIKE 'system_metrics';
SHOW TABLES LIKE 'alert_rules';

-- 检查预定义告警规则
SELECT id, name, type, metric, threshold, severity, enabled 
FROM alert_rules;
```

#### 1.3 配置慢查询日志

```sql
-- 启用慢查询日志
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 0.1; -- 100ms

-- 设置慢查询日志文件
SET GLOBAL slow_query_log_file = '/var/log/mysql/slow-query.log';

-- 记录未使用索引的查询
SET GLOBAL log_queries_not_using_indexes = 'ON';
```

---

### 2. 应用配置

#### 2.1 环境变量配置

在 `.env.production` 中添加监控配置:

```bash
# 监控配置
MONITORING_ENABLED=true
MONITORING_BATCH_SIZE=100
MONITORING_BATCH_INTERVAL=5000
MONITORING_ALERT_CHECK_INTERVAL=30000
MONITORING_SYSTEM_METRICS_INTERVAL=60000

# 告警配置
ALERT_COOLDOWN_PERIOD=300000
ALERT_NOTIFICATION_ENABLED=true

# 日志配置
LOG_LEVEL=info
LOG_FILE_PATH=./logs/app.log
LOG_MAX_SIZE=10m
LOG_MAX_FILES=7
```

#### 2.2 集成监控中间件

在 `src/app.ts` 中添加:

```typescript
import { apiPerformanceMiddleware } from './core/monitoring/middleware/apiPerformance';
import './core/monitoring/scheduler'; // 启动定时任务

// 添加性能监控中间件
app.use(apiPerformanceMiddleware);
```

#### 2.3 启动监控系统

```typescript
// 在应用启动时初始化
import { performanceCollector } from './core/monitoring/PerformanceCollector';
import { alertEngine } from './core/monitoring/AlertEngine';

// 启动系统指标收集 (每分钟)
performanceCollector.startSystemMetricsCollection(60000);

// 启动告警检查 (每30秒)
alertEngine.startAlertChecking();

console.log('监控系统已启动');
```

---

### 3. PM2 监控配置

#### 3.1 安装 PM2

```bash
npm install -g pm2
```

#### 3.2 配置 PM2

`pm2.config.js` 已包含监控配置:

```javascript
module.exports = {
  apps: [{
    name: 'ai-qa-platform',
    script: './dist/app.js',
    instances: 'max',
    exec_mode: 'cluster',
    
    // 监控配置
    max_memory_restart: '1G',
    max_restarts: 10,
    min_uptime: '10s',
    
    // 日志配置
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // 环境变量
    env_production: {
      NODE_ENV: 'production',
      MONITORING_ENABLED: true
    }
  }]
};
```

#### 3.3 启动 PM2 监控

```bash
# 启动应用
pm2 start pm2.config.js --env production

# 查看监控信息
pm2 monit

# 查看详细信息
pm2 show ai-qa-platform

# 查看日志
pm2 logs ai-qa-platform
```

#### 3.4 配置 PM2 Web 监控 (可选)

```bash
# 安装 PM2 Plus
pm2 install pm2-server-monit

# 或使用 PM2 Plus 云服务
pm2 link <secret_key> <public_key>
```

---

### 4. 日志收集配置

#### 4.1 配置日志轮转

创建 `logrotate` 配置文件 `/etc/logrotate.d/ai-qa-platform`:

```
/path/to/ai-qa-platform/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

#### 4.2 配置应用日志

在 `src/utils/logger.ts` 中配置:

```typescript
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    // 控制台输出
    new winston.transports.Console({
      format: winston.format.simple()
    }),
    
    // 文件输出 (按日期轮转)
    new DailyRotateFile({
      filename: 'logs/app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '10m',
      maxFiles: '7d'
    }),
    
    // 错误日志单独记录
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '10m',
      maxFiles: '14d'
    })
  ]
});

export default logger;
```

---

## 告警规则

### 预定义告警规则

系统已预置 10 个告警规则:

| ID | 规则名称 | 类型 | 指标 | 阈值 | 持续时间 | 严重程度 |
|----|---------|------|------|------|---------|---------|
| rule-001 | API响应时间过长(Warning) | API | response_time | > 200ms | 60s | Warning |
| rule-002 | API响应时间过长(Error) | API | response_time | > 500ms | 30s | Error |
| rule-003 | 数据库查询过慢(Warning) | Database | query_time | > 100ms | 60s | Warning |
| rule-004 | 数据库查询过慢(Error) | Database | query_time | > 500ms | 30s | Error |
| rule-005 | 模块加载过慢 | Module | load_time | > 1000ms | 0s | Warning |
| rule-006 | API错误率过高(Error) | API | error_rate | > 1% | 60s | Error |
| rule-007 | API错误率过高(Critical) | API | error_rate | > 5% | 30s | Critical |
| rule-008 | 内存使用率过高(Warning) | System | memory_usage | > 80% | 300s | Warning |
| rule-009 | 内存使用率过高(Critical) | System | memory_usage | > 90% | 60s | Critical |
| rule-010 | CPU使用率过高 | System | cpu_usage | > 80% | 300s | Warning |

### 自定义告警规则

#### 添加新规则

```sql
INSERT INTO alert_rules (
  id, name, type, metric, operator, threshold, duration, severity, enabled
) VALUES (
  'rule-011',
  '数据库连接数过多',
  'database',
  'connection_count',
  '>',
  80,
  60,
  'warning',
  TRUE
);
```

#### 修改规则

```sql
-- 修改阈值
UPDATE alert_rules 
SET threshold = 300 
WHERE id = 'rule-001';

-- 禁用规则
UPDATE alert_rules 
SET enabled = FALSE 
WHERE id = 'rule-005';

-- 修改严重程度
UPDATE alert_rules 
SET severity = 'critical' 
WHERE id = 'rule-002';
```

#### 删除规则

```sql
DELETE FROM alert_rules WHERE id = 'rule-011';
```

### 告警通知配置

#### 配置邮件通知 (可选)

在 `.env.production` 中添加:

```bash
# 邮件配置
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=alerts@example.com
SMTP_PASSWORD=your_password
SMTP_FROM=AI QA Platform <alerts@example.com>
ALERT_EMAIL_TO=admin@example.com,ops@example.com
```

#### 配置 Webhook 通知 (可选)

```bash
# Webhook 配置
ALERT_WEBHOOK_URL=https://hooks.example.com/alerts
ALERT_WEBHOOK_SECRET=your_webhook_secret
```

---

## 日志收集

### 日志类型

| 日志类型 | 文件路径 | 保留时间 | 说明 |
|---------|---------|---------|------|
| 应用日志 | logs/app-YYYY-MM-DD.log | 7天 | 应用运行日志 |
| 错误日志 | logs/error-YYYY-MM-DD.log | 14天 | 错误和异常日志 |
| PM2 日志 | logs/pm2-out.log | 7天 | PM2 标准输出 |
| PM2 错误日志 | logs/pm2-error.log | 14天 | PM2 错误输出 |
| 慢查询日志 | /var/log/mysql/slow-query.log | 30天 | MySQL 慢查询 |
| 迁移日志 | logs/migration-report.json | 永久 | 数据迁移记录 |

### 日志查看

#### 查看应用日志

```bash
# 查看最新日志
tail -f logs/app-$(date +%Y-%m-%d).log

# 查看错误日志
tail -f logs/error-$(date +%Y-%m-%d).log

# 搜索特定错误
grep "ERROR" logs/app-*.log

# 查看 PM2 日志
pm2 logs ai-qa-platform --lines 100
```

#### 查看慢查询日志

```bash
# 查看慢查询
tail -f /var/log/mysql/slow-query.log

# 分析慢查询
mysqldumpslow -s t -t 10 /var/log/mysql/slow-query.log
```

### 日志分析

#### 使用 grep 分析

```bash
# 统计错误数量
grep -c "ERROR" logs/app-*.log

# 查找特定错误
grep "Database connection failed" logs/error-*.log

# 统计 API 请求
grep "GET /api" logs/app-*.log | wc -l
```

#### 使用 awk 分析

```bash
# 统计响应时间分布
awk '/duration:/ {print $NF}' logs/app-*.log | sort -n | uniq -c

# 统计错误类型
awk '/ERROR/ {print $5}' logs/error-*.log | sort | uniq -c
```

---

## 监控面板

### 内置监控 API

系统提供 8 个监控 API 端点:

#### 1. 获取实时性能指标

```bash
curl http://localhost:3000/api/monitoring/metrics/realtime
```

响应示例:
```json
{
  "api": {
    "totalRequests": 1234,
    "avgResponseTime": 145,
    "errorRate": 0.5
  },
  "database": {
    "totalQueries": 5678,
    "avgQueryTime": 23,
    "slowQueries": 12
  },
  "system": {
    "memoryUsage": 65,
    "cpuUsage": 45
  }
}
```

#### 2. 获取历史性能数据

```bash
curl "http://localhost:3000/api/monitoring/metrics/history?type=api&start=2026-02-01&end=2026-02-02"
```

#### 3. 获取慢查询列表

```bash
curl "http://localhost:3000/api/monitoring/slow-queries?limit=10"
```

#### 4. 获取系统资源使用

```bash
curl http://localhost:3000/api/monitoring/system
```

#### 5. 获取性能告警列表

```bash
curl "http://localhost:3000/api/monitoring/alerts?severity=error&resolved=false"
```

#### 6. 解决告警

```bash
curl -X POST http://localhost:3000/api/monitoring/alerts/{alertId}/resolve
```

#### 7. 获取性能报告

```bash
curl "http://localhost:3000/api/monitoring/reports?type=daily&limit=7"
```

### PM2 监控面板

```bash
# 启动 PM2 监控
pm2 monit

# 查看进程列表
pm2 list

# 查看详细信息
pm2 show ai-qa-platform

# 查看实时日志
pm2 logs ai-qa-platform --lines 50
```

### Grafana 集成 (可选)

#### 安装 Grafana

```bash
# Ubuntu/Debian
sudo apt-get install -y grafana

# 启动 Grafana
sudo systemctl start grafana-server
sudo systemctl enable grafana-server
```

#### 配置数据源

1. 访问 http://localhost:3000 (默认用户名/密码: admin/admin)
2. 添加 MySQL 数据源
3. 配置连接信息

#### 导入仪表板

创建自定义仪表板,添加以下面板:

- API 响应时间趋势
- 数据库查询性能
- 系统资源使用率
- 告警统计
- 错误率趋势

---

## 常见问题

### 1. 监控数据未收集

**问题**: 数据库中没有性能指标数据

**原因**:
- 监控系统未启动
- 数据库表未创建
- 环境变量配置错误

**解决方案**:

```bash
# 检查监控表
mysql -u root -p -e "SHOW TABLES LIKE 'performance_%'" ai_qa_platform

# 检查环境变量
grep MONITORING .env.production

# 检查应用日志
grep "监控系统" logs/app-*.log

# 重启应用
pm2 restart ai-qa-platform
```

### 2. 告警未触发

**问题**: 性能超过阈值但未收到告警

**原因**:
- 告警规则未启用
- 告警引擎未启动
- 冷却期内

**解决方案**:

```sql
-- 检查告警规则
SELECT * FROM alert_rules WHERE enabled = TRUE;

-- 检查告警历史
SELECT * FROM performance_alerts ORDER BY created_at DESC LIMIT 10;

-- 启用规则
UPDATE alert_rules SET enabled = TRUE WHERE id = 'rule-001';
```

### 3. 日志文件过大

**问题**: 日志文件占用大量磁盘空间

**原因**:
- 日志轮转未配置
- 日志级别过低
- 保留时间过长

**解决方案**:

```bash
# 配置日志轮转
sudo vi /etc/logrotate.d/ai-qa-platform

# 手动清理旧日志
find logs/ -name "*.log" -mtime +7 -delete

# 调整日志级别
# 在 .env.production 中设置
LOG_LEVEL=warn
```

### 4. PM2 监控异常

**问题**: PM2 监控显示异常数据

**原因**:
- PM2 版本过旧
- 进程状态异常
- 内存泄漏

**解决方案**:

```bash
# 更新 PM2
npm install -g pm2@latest

# 重启 PM2
pm2 kill
pm2 start pm2.config.js --env production

# 检查内存使用
pm2 show ai-qa-platform

# 重置监控数据
pm2 reset ai-qa-platform
```

### 5. 慢查询日志未生成

**问题**: MySQL 慢查询日志为空

**原因**:
- 慢查询日志未启用
- 阈值设置过高
- 日志文件权限问题

**解决方案**:

```sql
-- 检查慢查询配置
SHOW VARIABLES LIKE 'slow_query%';
SHOW VARIABLES LIKE 'long_query_time';

-- 启用慢查询日志
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 0.1;

-- 检查日志文件
SHOW VARIABLES LIKE 'slow_query_log_file';
```

```bash
# 检查文件权限
ls -l /var/log/mysql/slow-query.log

# 修改权限
sudo chown mysql:mysql /var/log/mysql/slow-query.log
sudo chmod 644 /var/log/mysql/slow-query.log
```

---

## 最佳实践

### 1. 监控配置

- ✅ **合理设置阈值**: 根据实际业务调整告警阈值
- ✅ **分级告警**: 使用不同严重程度区分问题紧急度
- ✅ **避免告警疲劳**: 设置冷却期,避免重复告警
- ✅ **定期审查**: 每月审查告警规则,优化配置

### 2. 日志管理

- ✅ **日志轮转**: 配置自动日志轮转,避免磁盘占满
- ✅ **日志级别**: 生产环境使用 info 或 warn 级别
- ✅ **结构化日志**: 使用 JSON 格式,便于分析
- ✅ **敏感信息**: 避免记录密码、密钥等敏感信息

### 3. 性能优化

- ✅ **批量处理**: 使用批量插入减少数据库负载
- ✅ **异步处理**: 监控操作异步执行,不阻塞主流程
- ✅ **智能过滤**: 过滤不重要的指标,减少数据量
- ✅ **定期清理**: 定期清理历史数据,保持性能

### 4. 告警响应

- ✅ **快速响应**: 收到告警后及时处理
- ✅ **根因分析**: 分析告警原因,而非仅解决表象
- ✅ **记录处理**: 记录告警处理过程和结果
- ✅ **持续改进**: 根据告警优化系统

### 5. 监控覆盖

- ✅ **全面监控**: 覆盖API、数据库、系统、业务指标
- ✅ **关键路径**: 重点监控关键业务路径
- ✅ **用户体验**: 监控用户实际体验指标
- ✅ **趋势分析**: 关注长期趋势,而非短期波动

---

## 监控检查清单

### 部署前检查

- [ ] 数据库监控表已创建
- [ ] 预定义告警规则已配置
- [ ] 环境变量已配置
- [ ] 监控中间件已集成
- [ ] PM2 配置已完成
- [ ] 日志轮转已配置
- [ ] 慢查询日志已启用

### 部署后验证

- [ ] 监控系统正常启动
- [ ] 性能指标正常收集
- [ ] 告警规则正常工作
- [ ] 日志正常输出
- [ ] PM2 监控正常
- [ ] API 端点可访问
- [ ] 报告正常生成

### 日常检查

- [ ] 检查告警列表
- [ ] 查看性能报告
- [ ] 分析慢查询日志
- [ ] 检查系统资源使用
- [ ] 审查错误日志
- [ ] 验证备份完整性

---

## 附录

### A. 监控 API 完整列表

| 端点 | 方法 | 说明 |
|------|------|------|
| /api/monitoring/metrics/realtime | GET | 获取实时性能指标 |
| /api/monitoring/metrics/history | GET | 获取历史性能数据 |
| /api/monitoring/slow-queries | GET | 获取慢查询列表 |
| /api/monitoring/system | GET | 获取系统资源使用 |
| /api/monitoring/alerts | GET | 获取性能告警列表 |
| /api/monitoring/alerts/:id | GET | 获取告警详情 |
| /api/monitoring/alerts/:id/resolve | POST | 解决告警 |
| /api/monitoring/reports | GET | 获取性能报告列表 |

### B. 告警严重程度说明

| 级别 | 说明 | 响应时间 | 处理方式 |
|------|------|---------|---------|
| Info | 信息提示 | 24小时内 | 记录,定期审查 |
| Warning | 警告 | 4小时内 | 分析原因,计划优化 |
| Error | 错误 | 1小时内 | 立即分析,尽快修复 |
| Critical | 严重 | 15分钟内 | 紧急处理,必要时回滚 |

### C. 相关文档

- [部署指南](./deployment-guide.md)
- [数据迁移指南](./migration-guide.md)
- [备份恢复指南](./backup-guide.md)
- [故障排查指南](./troubleshooting.md)

---

## 支持

如有问题,请联系:

- **技术支持**: support@example.com
- **文档**: https://docs.example.com
- **问题反馈**: https://github.com/example/ai-qa-platform/issues

---

**文档版本**: 1.0.0  
**最后更新**: 2026-02-01  
**维护者**: AI QA Platform Team
