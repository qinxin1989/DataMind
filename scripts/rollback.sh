#!/bin/bash

# AI 数据问答平台 - 回滚脚本
# 版本: 1.0.0
# 日期: 2026-02-01

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查命令是否存在
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 获取最后一次备份
get_last_backup() {
    if [ -f ".last_backup" ]; then
        BACKUP_DIR=$(cat .last_backup)
        if [ -d "$BACKUP_DIR" ]; then
            echo "$BACKUP_DIR"
        else
            log_error "备份目录不存在: $BACKUP_DIR"
            exit 1
        fi
    else
        log_error "未找到备份记录"
        exit 1
    fi
}

# 停止服务
stop_service() {
    log_info "停止服务..."
    
    if command_exists pm2; then
        pm2 stop ai-data-platform || true
        pm2 delete ai-data-platform || true
        log_info "服务已停止 (PM2) ✓"
    else
        pkill -f "node.*dist/index.js" || true
        log_info "服务已停止 ✓"
    fi
}

# 恢复代码
restore_code() {
    local backup_dir=$1
    log_info "恢复代码..."
    
    if [ -d "$backup_dir/dist" ]; then
        rm -rf dist
        cp -r "$backup_dir/dist" .
        log_info "代码恢复完成 ✓"
    else
        log_warn "备份中未找到代码，跳过代码恢复"
    fi
}

# 恢复数据库
restore_database() {
    local backup_dir=$1
    log_info "恢复数据库..."
    
    if [ -f "$backup_dir/database.sql" ]; then
        if [ -f ".env.production" ]; then
            source .env.production
            if command_exists mysql; then
                mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < "$backup_dir/database.sql"
                log_info "数据库恢复完成 ✓"
            else
                log_error "mysql 客户端未安装，无法恢复数据库"
                exit 1
            fi
        else
            log_error ".env.production 文件不存在"
            exit 1
        fi
    else
        log_warn "备份中未找到数据库，跳过数据库恢复"
    fi
}

# 启动服务
start_service() {
    log_info "启动服务..."
    
    if command_exists pm2; then
        pm2 start pm2.config.js
        pm2 save
        log_info "服务启动完成 (PM2) ✓"
    else
        npm start &
        log_info "服务启动完成 (npm) ✓"
    fi
}

# 健康检查
health_check() {
    log_info "执行健康检查..."
    
    # 等待服务启动
    sleep 5
    
    # 检查服务是否运行
    if command_exists pm2; then
        if pm2 list | grep -q "ai-data-platform.*online"; then
            log_info "服务运行正常 ✓"
        else
            log_error "服务启动失败"
            exit 1
        fi
    else
        if curl -f http://localhost:3000/health >/dev/null 2>&1; then
            log_info "服务运行正常 ✓"
        else
            log_error "服务健康检查失败"
            exit 1
        fi
    fi
}

# 主函数
main() {
    log_info "========================================="
    log_info "AI 数据问答平台 - 回滚开始"
    log_info "========================================="
    
    # 获取备份目录
    BACKUP_DIR=$(get_last_backup)
    log_info "使用备份: $BACKUP_DIR"
    
    # 确认回滚
    read -p "确认回滚到 $BACKUP_DIR? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "回滚已取消"
        exit 0
    fi
    
    stop_service
    restore_code "$BACKUP_DIR"
    restore_database "$BACKUP_DIR"
    start_service
    health_check
    
    log_info "========================================="
    log_info "回滚完成 ✓"
    log_info "========================================="
}

# 执行主函数
main
