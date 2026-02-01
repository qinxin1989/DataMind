-- 性能监控系统数据库表
-- 创建时间: 2026-02-01
-- 用途: 存储性能指标、告警和报告数据

-- 性能指标表
CREATE TABLE IF NOT EXISTS performance_metrics (
  id VARCHAR(36) PRIMARY KEY COMMENT '指标ID',
  type ENUM('api', 'database', 'module', 'frontend', 'system') NOT NULL COMMENT '指标类型',
  name VARCHAR(255) NOT NULL COMMENT '指标名称',
  duration DECIMAL(10, 2) COMMENT '执行时长(ms)',
  metadata JSON COMMENT '元数据',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_type_created (type, created_at),
  INDEX idx_name_created (name, created_at),
  INDEX idx_duration (duration)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='性能指标表';

-- 系统指标表
CREATE TABLE IF NOT EXISTS system_metrics (
  id VARCHAR(36) PRIMARY KEY COMMENT '指标ID',
  memory_used BIGINT NOT NULL COMMENT '已用内存(bytes)',
  memory_total BIGINT NOT NULL COMMENT '总内存(bytes)',
  memory_percentage DECIMAL(5, 2) NOT NULL COMMENT '内存使用率(%)',
  cpu_usage DECIMAL(5, 2) NOT NULL COMMENT 'CPU使用率(%)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统指标表';

-- 性能告警表
CREATE TABLE IF NOT EXISTS performance_alerts (
  id VARCHAR(36) PRIMARY KEY COMMENT '告警ID',
  rule_id VARCHAR(36) NOT NULL COMMENT '规则ID',
  rule_name VARCHAR(255) NOT NULL COMMENT '规则名称',
  severity ENUM('info', 'warning', 'error', 'critical') NOT NULL COMMENT '严重程度',
  message TEXT NOT NULL COMMENT '告警消息',
  metadata JSON COMMENT '元数据',
  resolved BOOLEAN DEFAULT FALSE COMMENT '是否已解决',
  resolved_at TIMESTAMP NULL COMMENT '解决时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_severity_created (severity, created_at),
  INDEX idx_resolved (resolved),
  INDEX idx_rule (rule_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='性能告警表';

-- 性能报告表
CREATE TABLE IF NOT EXISTS performance_reports (
  id VARCHAR(36) PRIMARY KEY COMMENT '报告ID',
  type ENUM('daily', 'weekly') NOT NULL COMMENT '报告类型',
  period_start DATE NOT NULL COMMENT '周期开始日期',
  period_end DATE NOT NULL COMMENT '周期结束日期',
  content TEXT NOT NULL COMMENT '报告内容(Markdown)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_type_period (type, period_start),
  UNIQUE KEY uk_type_period (type, period_start, period_end)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='性能报告表';

-- 告警规则表
CREATE TABLE IF NOT EXISTS alert_rules (
  id VARCHAR(36) PRIMARY KEY COMMENT '规则ID',
  name VARCHAR(255) NOT NULL COMMENT '规则名称',
  type ENUM('api', 'database', 'module', 'system') NOT NULL COMMENT '监控类型',
  metric VARCHAR(100) NOT NULL COMMENT '监控指标',
  operator ENUM('>', '<', '=', '>=', '<=') NOT NULL COMMENT '比较运算符',
  threshold DECIMAL(10, 2) NOT NULL COMMENT '阈值',
  duration INT DEFAULT 0 COMMENT '持续时间(秒)',
  severity ENUM('info', 'warning', 'error', 'critical') NOT NULL COMMENT '严重程度',
  enabled BOOLEAN DEFAULT TRUE COMMENT '是否启用',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_type_enabled (type, enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='告警规则表';

-- 插入预定义告警规则
INSERT INTO alert_rules (id, name, type, metric, operator, threshold, duration, severity, enabled) VALUES
('rule-001', 'API响应时间过长(Warning)', 'api', 'response_time', '>', 200, 60, 'warning', TRUE),
('rule-002', 'API响应时间过长(Error)', 'api', 'response_time', '>', 500, 30, 'error', TRUE),
('rule-003', '数据库查询过慢(Warning)', 'database', 'query_time', '>', 100, 60, 'warning', TRUE),
('rule-004', '数据库查询过慢(Error)', 'database', 'query_time', '>', 500, 30, 'error', TRUE),
('rule-005', '模块加载过慢', 'module', 'load_time', '>', 1000, 0, 'warning', TRUE),
('rule-006', 'API错误率过高(Error)', 'api', 'error_rate', '>', 1, 60, 'error', TRUE),
('rule-007', 'API错误率过高(Critical)', 'api', 'error_rate', '>', 5, 30, 'critical', TRUE),
('rule-008', '内存使用率过高(Warning)', 'system', 'memory_usage', '>', 80, 300, 'warning', TRUE),
('rule-009', '内存使用率过高(Critical)', 'system', 'memory_usage', '>', 90, 60, 'critical', TRUE),
('rule-010', 'CPU使用率过高', 'system', 'cpu_usage', '>', 80, 300, 'warning', TRUE);
