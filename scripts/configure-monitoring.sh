#!/bin/bash

###############################################################################
# AI 数据问答平台 - 监控配置脚本
# 版本: 1.0.0
# 日期: 2026-02-01
# 
# 用途: 自动配置监控系统和告警规则
###############################################################################

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 错误处理
set -e
trap 'log_error "脚本执行失败，请检查错误信息"' ERR

###############################################################################
# 1. 环境检查
###############################################################################

log_info "========================================="
log_info "AI 数据问答平台 - 监控配置"
log_info "========================================="

log_info "检查环境..."

# 检查 Node.js
if ! command -v node &> /dev/null; then
    log_error "Node.js 未安装"
    exit 1
fi
log_success "Node.js 已安装: $(node --version)"

# 检查 npm
if ! command -v npm &> /dev/null; then
    log_error "npm 未安装"
    exit 1
fi
log_success "npm 已安装: $(npm --version)"

# 检查 MySQL
if ! command -v mysql &> /dev/null; then
    log_error "MySQL 未安装"
    exit 1
fi
log_success "MySQL 已安装"

# 检查 PM2
if ! command -v pm2 &> /dev/null; then
    log_warn "PM2 未安装，正在安装..."
    npm install -g pm2
    log_success "PM2 安装完成"
else
    log_success "PM2 已安装: $(pm2 --version)"
fi

###############################################################################
# 2. 数据库配置
###############################################################################

log_info ""
log_info "配置数据库..."

# 加载环境变量
if [ -f .env.production ]; then
    source .env.production
else
    log_error ".env.production 文件不存在"
    exit 1
fi

# 检查数据库连接
log_info "检查数据库连接..."
if mysql -h"${DB_HOST}" -P"${DB_PORT}" -u"${DB_USER}" -p"${DB_PASSWORD}" -e "SELECT 1" &> /dev/null; then
    log_success "数据库连接成功"
else
    log_error "数据库连接失败，请检查配置"
    exit 1
fi

# 创建监控表
log_info "创建监控表..."
if [ -f migrations/create-performance-monitoring-tables.sql ]; then
    mysql -h"${DB_HOST}" -P"${DB_PORT}" -u"${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" < migrations/create-performance-monitoring-tables.sql
    log_success "监控表创建成功"
else
    log_error "监控表创建脚本不存在"
    exit 1
fi

# 验证表创建
log_info "验证表创建..."
TABLE_COUNT=$(mysql -h"${DB_HOST}" -P"${DB_PORT}" -u"${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '${DB_NAME}' AND table_name LIKE 'performance_%' OR table_name = 'system_metrics' OR table_name = 'alert_rules'")

if [ "$TABLE_COUNT" -ge 5 ]; then
    log_success "监控表验证成功 ($TABLE_COUNT 个表)"
else
    log_error "监控表验证失败，只找到 $TABLE_COUNT 个表"
    exit 1
fi

# 配置慢查询日志
log_info "配置 MySQL 慢查询日志..."
mysql -h"${DB_HOST}" -P"${DB_PORT}" -u"${DB_USER}" -p"${DB_PASSWORD}" -e "
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 0.1;
SET GLOBAL log_queries_not_using_indexes = 'ON';
" 2>/dev/null || log_warn "慢查询日志配置失败（可能需要 root 权限）"

log_success "数据库配置完成"

###############################################################################
# 3. 日志配置
###############################################################################

log_info ""
log_info "配置日志系统..."

# 创建日志目录
if [ ! -d "logs" ]; then
    mkdir -p logs
    log_success "日志目录创建成功"
fi

# 配置日志轮转
log_info "配置日志轮转..."
LOGROTATE_CONF="/etc/logrotate.d/ai-qa-platform"

if [ -w "/etc/logrotate.d" ]; then
    cat > "$LOGROTATE_CONF" << EOF
$(pwd)/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    notifempty
    create 0640 $(whoami) $(whoami)
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
EOF
    log_success "日志轮转配置成功"
else
    log_warn "无法配置日志轮转（需要 sudo 权限）"
    log_info "请手动执行: sudo vi /etc/logrotate.d/ai-qa-platform"
fi

log_success "日志配置完成"

###############################################################################
# 4. PM2 配置
###############################################################################

log_info ""
log_info "配置 PM2..."

# 检查 PM2 配置文件
if [ ! -f "pm2.config.js" ]; then
    log_error "pm2.config.js 文件不存在"
    exit 1
fi

# 配置 PM2 自动启动
log_info "配置 PM2 自动启动..."
pm2 startup | grep -o 'sudo .*' | sh || log_warn "PM2 自动启动配置失败（可能需要 sudo 权限）"

log_success "PM2 配置完成"

###############################################################################
# 5. 监控系统配置
###############################################################################

log_info ""
log_info "配置监控系统..."

# 检查环境变量
log_info "检查监控环境变量..."
REQUIRED_VARS=(
    "MONITORING_ENABLED"
    "MONITORING_BATCH_SIZE"
    "MONITORING_BATCH_INTERVAL"
    "MONITORING_ALERT_CHECK_INTERVAL"
)

MISSING_VARS=()
for VAR in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!VAR}" ]; then
        MISSING_VARS+=("$VAR")
    fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    log_warn "以下环境变量未配置: ${MISSING_VARS[*]}"
    log_info "添加默认配置到 .env.production..."
    
    cat >> .env.production << EOF

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
EOF
    
    log_success "默认配置已添加"
else
    log_success "监控环境变量配置完整"
fi

log_success "监控系统配置完成"

###############################################################################
# 6. 验证配置
###############################################################################

log_info ""
log_info "验证配置..."

# 验证数据库表
log_info "验证数据库表..."
TABLES=(
    "performance_metrics"
    "system_metrics"
    "performance_alerts"
    "performance_reports"
    "alert_rules"
)

for TABLE in "${TABLES[@]}"; do
    if mysql -h"${DB_HOST}" -P"${DB_PORT}" -u"${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" -e "DESC $TABLE" &> /dev/null; then
        log_success "表 $TABLE 存在"
    else
        log_error "表 $TABLE 不存在"
        exit 1
    fi
done

# 验证告警规则
log_info "验证告警规则..."
RULE_COUNT=$(mysql -h"${DB_HOST}" -P"${DB_PORT}" -u"${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" -N -e "SELECT COUNT(*) FROM alert_rules WHERE enabled = TRUE")

if [ "$RULE_COUNT" -gt 0 ]; then
    log_success "告警规则配置成功 ($RULE_COUNT 个规则)"
else
    log_error "没有启用的告警规则"
    exit 1
fi

# 验证日志目录
if [ -d "logs" ] && [ -w "logs" ]; then
    log_success "日志目录可写"
else
    log_error "日志目录不可写"
    exit 1
fi

log_success "配置验证完成"

###############################################################################
# 7. 生成配置报告
###############################################################################

log_info ""
log_info "生成配置报告..."

REPORT_FILE="logs/monitoring-config-report.txt"

cat > "$REPORT_FILE" << EOF
========================================
AI 数据问答平台 - 监控配置报告
========================================
配置时间: $(date '+%Y-%m-%d %H:%M:%S')

1. 环境信息
   - Node.js: $(node --version)
   - npm: $(npm --version)
   - PM2: $(pm2 --version)
   - MySQL: $(mysql --version | awk '{print $5}' | sed 's/,//')

2. 数据库配置
   - 主机: ${DB_HOST}
   - 端口: ${DB_PORT}
   - 数据库: ${DB_NAME}
   - 监控表: $TABLE_COUNT 个
   - 告警规则: $RULE_COUNT 个

3. 监控配置
   - 批量大小: ${MONITORING_BATCH_SIZE:-100}
   - 批量间隔: ${MONITORING_BATCH_INTERVAL:-5000}ms
   - 告警检查间隔: ${MONITORING_ALERT_CHECK_INTERVAL:-30000}ms
   - 系统指标间隔: ${MONITORING_SYSTEM_METRICS_INTERVAL:-60000}ms

4. 日志配置
   - 日志目录: $(pwd)/logs
   - 日志级别: ${LOG_LEVEL:-info}
   - 日志轮转: $([ -f "$LOGROTATE_CONF" ] && echo "已配置" || echo "未配置")

5. PM2 配置
   - 配置文件: pm2.config.js
   - 自动启动: $(pm2 list | grep -q "ai-qa-platform" && echo "已配置" || echo "未配置")

========================================
配置状态: 成功 ✓
========================================
EOF

log_success "配置报告已保存: $REPORT_FILE"

###############################################################################
# 8. 完成
###############################################################################

log_info ""
log_info "========================================="
log_success "监控配置完成 ✓"
log_info "========================================="
log_info ""
log_info "下一步操作:"
log_info "1. 启动应用: pm2 start pm2.config.js --env production"
log_info "2. 查看监控: pm2 monit"
log_info "3. 查看日志: pm2 logs ai-qa-platform"
log_info "4. 查看报告: cat $REPORT_FILE"
log_info ""
log_info "监控 API:"
log_info "- 实时指标: GET /api/monitoring/metrics/realtime"
log_info "- 告警列表: GET /api/monitoring/alerts"
log_info "- 性能报告: GET /api/monitoring/reports"
log_info ""
log_info "详细文档: docs/deployment/monitoring-guide.md"
log_info "========================================="

exit 0
