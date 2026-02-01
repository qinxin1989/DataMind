#!/bin/bash

###############################################################################
# AI 数据问答平台 - 监控检查脚本
# 版本: 1.0.0
# 日期: 2026-02-01
# 
# 用途: 检查监控系统运行状态
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
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# 统计变量
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNINGS=0

# 检查函数
check() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    if [ $1 -eq 0 ]; then
        log_success "$2"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        return 0
    else
        log_error "$2"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        return 1
    fi
}

check_warn() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    if [ $1 -eq 0 ]; then
        log_success "$2"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        return 0
    else
        log_warn "$2"
        WARNINGS=$((WARNINGS + 1))
        return 1
    fi
}

###############################################################################
# 开始检查
###############################################################################

log_info "========================================="
log_info "AI 数据问答平台 - 监控系统检查"
log_info "========================================="
log_info "检查时间: $(date '+%Y-%m-%d %H:%M:%S')"
log_info ""

# 加载环境变量
if [ -f .env.production ]; then
    source .env.production
else
    log_error ".env.production 文件不存在"
    exit 1
fi

###############################################################################
# 1. 数据库检查
###############################################################################

log_info "1. 数据库检查"
log_info "-------------------------------------------"

# 检查数据库连接
mysql -h"${DB_HOST}" -P"${DB_PORT}" -u"${DB_USER}" -p"${DB_PASSWORD}" -e "SELECT 1" &> /dev/null
check $? "数据库连接正常"

# 检查监控表
TABLES=(
    "performance_metrics"
    "system_metrics"
    "performance_alerts"
    "performance_reports"
    "alert_rules"
)

for TABLE in "${TABLES[@]}"; do
    mysql -h"${DB_HOST}" -P"${DB_PORT}" -u"${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" -e "DESC $TABLE" &> /dev/null
    check $? "表 $TABLE 存在"
done

# 检查告警规则
RULE_COUNT=$(mysql -h"${DB_HOST}" -P"${DB_PORT}" -u"${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" -N -e "SELECT COUNT(*) FROM alert_rules WHERE enabled = TRUE" 2>/dev/null)
if [ "$RULE_COUNT" -gt 0 ]; then
    log_success "告警规则: $RULE_COUNT 个已启用"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    log_error "没有启用的告警规则"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

# 检查性能指标数据
METRIC_COUNT=$(mysql -h"${DB_HOST}" -P"${DB_PORT}" -u"${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" -N -e "SELECT COUNT(*) FROM performance_metrics WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)" 2>/dev/null)
if [ "$METRIC_COUNT" -gt 0 ]; then
    log_success "最近1小时性能指标: $METRIC_COUNT 条"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    log_warn "最近1小时没有性能指标数据"
    WARNINGS=$((WARNINGS + 1))
fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

# 检查系统指标数据
SYSTEM_METRIC_COUNT=$(mysql -h"${DB_HOST}" -P"${DB_PORT}" -u"${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" -N -e "SELECT COUNT(*) FROM system_metrics WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)" 2>/dev/null)
if [ "$SYSTEM_METRIC_COUNT" -gt 0 ]; then
    log_success "最近1小时系统指标: $SYSTEM_METRIC_COUNT 条"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    log_warn "最近1小时没有系统指标数据"
    WARNINGS=$((WARNINGS + 1))
fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

# 检查未解决的告警
ALERT_COUNT=$(mysql -h"${DB_HOST}" -P"${DB_PORT}" -u"${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" -N -e "SELECT COUNT(*) FROM performance_alerts WHERE resolved = FALSE" 2>/dev/null)
if [ "$ALERT_COUNT" -eq 0 ]; then
    log_success "未解决的告警: 0 个"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    log_warn "未解决的告警: $ALERT_COUNT 个"
    WARNINGS=$((WARNINGS + 1))
fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

log_info ""

###############################################################################
# 2. 应用检查
###############################################################################

log_info "2. 应用检查"
log_info "-------------------------------------------"

# 检查 PM2 进程
if command -v pm2 &> /dev/null; then
    pm2 list | grep -q "ai-qa-platform"
    check $? "PM2 进程运行中"
    
    # 检查进程状态
    if pm2 list | grep "ai-qa-platform" | grep -q "online"; then
        log_success "进程状态: online"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        log_error "进程状态异常"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
    fi
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    # 检查进程重启次数
    RESTART_COUNT=$(pm2 jlist | grep -A 20 "ai-qa-platform" | grep "restart_time" | awk -F: '{print $2}' | tr -d ' ,')
    if [ "$RESTART_COUNT" -lt 5 ]; then
        log_success "进程重启次数: $RESTART_COUNT (正常)"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        log_warn "进程重启次数: $RESTART_COUNT (频繁重启)"
        WARNINGS=$((WARNINGS + 1))
    fi
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
else
    log_warn "PM2 未安装"
    WARNINGS=$((WARNINGS + 1))
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
fi

# 检查应用端口
PORT=${PORT:-3000}
if nc -z localhost $PORT 2>/dev/null; then
    log_success "应用端口 $PORT 可访问"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    log_error "应用端口 $PORT 不可访问"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

# 检查健康端点
if command -v curl &> /dev/null; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/health 2>/dev/null)
    if [ "$HTTP_CODE" = "200" ]; then
        log_success "健康检查端点正常 (HTTP $HTTP_CODE)"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        log_warn "健康检查端点异常 (HTTP $HTTP_CODE)"
        WARNINGS=$((WARNINGS + 1))
    fi
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
fi

log_info ""

###############################################################################
# 3. 日志检查
###############################################################################

log_info "3. 日志检查"
log_info "-------------------------------------------"

# 检查日志目录
if [ -d "logs" ]; then
    log_success "日志目录存在"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    log_error "日志目录不存在"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

# 检查日志文件
if [ -f "logs/app-$(date +%Y-%m-%d).log" ]; then
    log_success "今日应用日志存在"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
    
    # 检查日志大小
    LOG_SIZE=$(du -h "logs/app-$(date +%Y-%m-%d).log" | awk '{print $1}')
    log_info "  日志大小: $LOG_SIZE"
else
    log_warn "今日应用日志不存在"
    WARNINGS=$((WARNINGS + 1))
fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

# 检查错误日志
if [ -f "logs/error-$(date +%Y-%m-%d).log" ]; then
    ERROR_COUNT=$(wc -l < "logs/error-$(date +%Y-%m-%d).log")
    if [ "$ERROR_COUNT" -lt 10 ]; then
        log_success "今日错误日志: $ERROR_COUNT 条 (正常)"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        log_warn "今日错误日志: $ERROR_COUNT 条 (较多)"
        WARNINGS=$((WARNINGS + 1))
    fi
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
fi

# 检查日志轮转配置
if [ -f "/etc/logrotate.d/ai-qa-platform" ]; then
    log_success "日志轮转已配置"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    log_warn "日志轮转未配置"
    WARNINGS=$((WARNINGS + 1))
fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

log_info ""

###############################################################################
# 4. 系统资源检查
###############################################################################

log_info "4. 系统资源检查"
log_info "-------------------------------------------"

# 检查磁盘空间
DISK_USAGE=$(df -h . | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 80 ]; then
    log_success "磁盘使用率: ${DISK_USAGE}% (正常)"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
elif [ "$DISK_USAGE" -lt 90 ]; then
    log_warn "磁盘使用率: ${DISK_USAGE}% (偏高)"
    WARNINGS=$((WARNINGS + 1))
else
    log_error "磁盘使用率: ${DISK_USAGE}% (过高)"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

# 检查内存使用
if command -v free &> /dev/null; then
    MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100}')
    if [ "$MEMORY_USAGE" -lt 80 ]; then
        log_success "内存使用率: ${MEMORY_USAGE}% (正常)"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    elif [ "$MEMORY_USAGE" -lt 90 ]; then
        log_warn "内存使用率: ${MEMORY_USAGE}% (偏高)"
        WARNINGS=$((WARNINGS + 1))
    else
        log_error "内存使用率: ${MEMORY_USAGE}% (过高)"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
    fi
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
fi

# 检查 CPU 负载
if command -v uptime &> /dev/null; then
    LOAD_AVG=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    CPU_COUNT=$(nproc)
    LOAD_PERCENT=$(echo "scale=0; $LOAD_AVG * 100 / $CPU_COUNT" | bc)
    
    if [ "$LOAD_PERCENT" -lt 80 ]; then
        log_success "CPU 负载: $LOAD_AVG ($LOAD_PERCENT%, 正常)"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    elif [ "$LOAD_PERCENT" -lt 100 ]; then
        log_warn "CPU 负载: $LOAD_AVG ($LOAD_PERCENT%, 偏高)"
        WARNINGS=$((WARNINGS + 1))
    else
        log_error "CPU 负载: $LOAD_AVG ($LOAD_PERCENT%, 过高)"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
    fi
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
fi

log_info ""

###############################################################################
# 5. 监控 API 检查
###############################################################################

log_info "5. 监控 API 检查"
log_info "-------------------------------------------"

if command -v curl &> /dev/null; then
    # 检查实时指标 API
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/api/monitoring/metrics/realtime 2>/dev/null)
    if [ "$HTTP_CODE" = "200" ]; then
        log_success "实时指标 API 正常 (HTTP $HTTP_CODE)"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        log_warn "实时指标 API 异常 (HTTP $HTTP_CODE)"
        WARNINGS=$((WARNINGS + 1))
    fi
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    # 检查告警 API
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/api/monitoring/alerts 2>/dev/null)
    if [ "$HTTP_CODE" = "200" ]; then
        log_success "告警 API 正常 (HTTP $HTTP_CODE)"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        log_warn "告警 API 异常 (HTTP $HTTP_CODE)"
        WARNINGS=$((WARNINGS + 1))
    fi
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    # 检查系统指标 API
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/api/monitoring/system 2>/dev/null)
    if [ "$HTTP_CODE" = "200" ]; then
        log_success "系统指标 API 正常 (HTTP $HTTP_CODE)"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        log_warn "系统指标 API 异常 (HTTP $HTTP_CODE)"
        WARNINGS=$((WARNINGS + 1))
    fi
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
fi

log_info ""

###############################################################################
# 6. 生成检查报告
###############################################################################

log_info "========================================="
log_info "检查报告"
log_info "========================================="
log_info "总检查项: $TOTAL_CHECKS"
log_success "通过: $PASSED_CHECKS"
log_warn "警告: $WARNINGS"
log_error "失败: $FAILED_CHECKS"
log_info "========================================="

# 计算通过率
PASS_RATE=$(echo "scale=1; $PASSED_CHECKS * 100 / $TOTAL_CHECKS" | bc)
log_info "通过率: ${PASS_RATE}%"

# 判断整体状态
if [ "$FAILED_CHECKS" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
    log_success "监控系统状态: 优秀 ✓"
    EXIT_CODE=0
elif [ "$FAILED_CHECKS" -eq 0 ]; then
    log_warn "监控系统状态: 良好 (有警告)"
    EXIT_CODE=0
else
    log_error "监控系统状态: 异常 (有失败)"
    EXIT_CODE=1
fi

log_info "========================================="

# 保存报告
REPORT_FILE="logs/monitoring-check-$(date +%Y%m%d-%H%M%S).txt"
{
    echo "========================================="
    echo "AI 数据问答平台 - 监控系统检查报告"
    echo "========================================="
    echo "检查时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    echo "检查结果:"
    echo "- 总检查项: $TOTAL_CHECKS"
    echo "- 通过: $PASSED_CHECKS"
    echo "- 警告: $WARNINGS"
    echo "- 失败: $FAILED_CHECKS"
    echo "- 通过率: ${PASS_RATE}%"
    echo ""
    echo "系统状态: $([ $EXIT_CODE -eq 0 ] && echo "正常" || echo "异常")"
    echo "========================================="
} > "$REPORT_FILE"

log_info "检查报告已保存: $REPORT_FILE"
log_info ""

exit $EXIT_CODE
