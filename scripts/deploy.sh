#!/bin/bash

# AI 数据问答平台 - 部署脚本
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

# 环境检查
check_environment() {
    log_info "检查部署环境..."
    
    # 检查 Node.js
    if ! command_exists node; then
        log_error "Node.js 未安装"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        log_error "Node.js 版本过低，需要 >= 18.x，当前版本: $(node -v)"
        exit 1
    fi
    log_info "Node.js 版本: $(node -v) ✓"
    
    # 检查 npm
    if ! command_exists npm; then
        log_error "npm 未安装"
        exit 1
    fi
    log_info "npm 版本: $(npm -v) ✓"
    
    # 检查 MySQL
    if ! command_exists mysql; then
        log_warn "MySQL 客户端未安装，跳过数据库版本检查"
    else
        log_info "MySQL 客户端已安装 ✓"
    fi
    
    # 检查环境变量文件
    if [ ! -f ".env.production" ]; then
        log_error ".env.production 文件不存在"
        exit 1
    fi
    log_info "环境配置文件存在 ✓"
    
    log_info "环境检查完成 ✓"
}

# 备份当前版本
backup_current() {
    log_info "备份当前版本..."
    
    BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    # 备份代码
    if [ -d "dist" ]; then
        cp -r dist "$BACKUP_DIR/"
        log_info "代码备份完成 ✓"
    fi
    
    # 备份数据库
    if [ -f ".env.production" ]; then
        source .env.production
        if command_exists mysqldump; then
            mysqldump -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" > "$BACKUP_DIR/database.sql"
            log_info "数据库备份完成 ✓"
        else
            log_warn "mysqldump 未安装，跳过数据库备份"
        fi
    fi
    
    echo "$BACKUP_DIR" > .last_backup
    log_info "备份完成: $BACKUP_DIR ✓"
}

# 安装依赖
install_dependencies() {
    log_info "安装依赖..."
    
    # 清理旧的 node_modules
    if [ -d "node_modules" ]; then
        log_info "清理旧的依赖..."
        rm -rf node_modules
    fi
    
    # 安装后端依赖
    npm ci --production
    log_info "后端依赖安装完成 ✓"
    
    # 安装前端依赖
    cd admin-ui
    npm ci --production
    cd ..
    log_info "前端依赖安装完成 ✓"
}

# 构建前端
build_frontend() {
    log_info "构建前端..."
    
    cd admin-ui
    npm run build
    cd ..
    
    log_info "前端构建完成 ✓"
}

# 数据库迁移
migrate_database() {
    log_info "执行数据库迁移..."
    
    # 检查是否有迁移脚本
    if [ -d "migrations" ]; then
        npm run migrate
        log_info "数据库迁移完成 ✓"
    else
        log_warn "未找到迁移脚本，跳过数据库迁移"
    fi
}

# 启动服务
start_service() {
    log_info "启动服务..."
    
    # 停止旧服务
    if command_exists pm2; then
        pm2 stop ai-data-platform || true
        pm2 delete ai-data-platform || true
    fi
    
    # 启动新服务
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
    log_info "AI 数据问答平台 - 部署开始"
    log_info "========================================="
    
    check_environment
    backup_current
    install_dependencies
    build_frontend
    migrate_database
    start_service
    health_check
    
    log_info "========================================="
    log_info "部署完成 ✓"
    log_info "========================================="
}

# 执行主函数
main
