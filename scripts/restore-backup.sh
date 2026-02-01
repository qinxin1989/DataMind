#!/bin/bash

# AI 数据问答平台 - 备份恢复脚本
# 版本: 1.0.0
# 日期: 2026-02-01

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

log_debug() {
    echo -e "${BLUE}[DEBUG]${NC} $1"
}

# 检查命令是否存在
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 显示使用说明
show_usage() {
    cat << EOF
使用方法: $0 [选项]

选项:
  -t, --type TYPE       恢复类型: database, files, all (默认: all)
  -d, --dir DIR         备份目录 (如果不指定，使用最新备份)
  -h, --help            显示此帮助信息

示例:
  $0                                    # 恢复所有最新备份
  $0 -t database                        # 仅恢复数据库
  $0 -t files                           # 仅恢复文件
  $0 -d backups/database/20260201_120000  # 恢复指定备份

EOF
}

# 解析命令行参数
parse_args() {
    RESTORE_TYPE="all"
    BACKUP_DIR=""
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -t|--type)
                RESTORE_TYPE="$2"
                shift 2
                ;;
            -d|--dir)
                BACKUP_DIR="$2"
                shift 2
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            *)
                log_error "未知选项: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # 验证恢复类型
    if [[ ! "$RESTORE_TYPE" =~ ^(database|files|all)$ ]]; then
        log_error "无效的恢复类型: $RESTORE_TYPE"
        show_usage
        exit 1
    fi
}

# 加载环境变量
load_env() {
    log_info "加载环境变量..."
    
    if [ -f ".env.production" ]; then
        source .env.production
        log_info "已加载 .env.production ✓"
    elif [ -f ".env" ]; then
        source .env
        log_info "已加载 .env ✓"
    else
        log_error "未找到环境变量文件"
        exit 1
    fi
}

# 检查环境
check_environment() {
    log_info "检查恢复环境..."
    
    if [[ "$RESTORE_TYPE" == "database" || "$RESTORE_TYPE" == "all" ]]; then
        # 检查 mysql
        if ! command_exists mysql; then
            log_error "mysql 客户端未安装"
            exit 1
        fi
        log_info "mysql 客户端已安装 ✓"
    fi
    
    if [[ "$RESTORE_TYPE" == "files" || "$RESTORE_TYPE" == "all" ]]; then
        # 检查 tar
        if ! command_exists tar; then
            log_error "tar 未安装"
            exit 1
        fi
        log_info "tar 已安装 ✓"
    fi
    
    log_info "环境检查完成 ✓"
}

# 查找最新备份
find_latest_backup() {
    local backup_type=$1
    
    if [ -n "$BACKUP_DIR" ]; then
        if [ ! -d "$BACKUP_DIR" ]; then
            log_error "备份目录不存在: $BACKUP_DIR"
            exit 1
        fi
        echo "$BACKUP_DIR"
        return
    fi
    
    local latest_dir=$(find "backups/$backup_type" -maxdepth 1 -type d | sort -r | head -n 2 | tail -n 1)
    
    if [ -z "$latest_dir" ]; then
        log_error "未找到 $backup_type 备份"
        exit 1
    fi
    
    echo "$latest_dir"
}

# 显示备份信息
show_backup_info() {
    local backup_dir=$1
    
    log_info "========================================="
    log_info "备份信息"
    log_info "========================================="
    
    if [ -f "$backup_dir/backup.info" ]; then
        cat "$backup_dir/backup.info"
    else
        log_warn "未找到备份信息文件"
        log_info "备份目录: $backup_dir"
        log_info "备份文件:"
        ls -lh "$backup_dir"
    fi
    
    log_info "========================================="
}

# 确认恢复
confirm_restore() {
    log_warn "========================================="
    log_warn "警告: 恢复操作将覆盖当前数据!"
    log_warn "========================================="
    
    read -p "确认恢复? (yes/no): " -r
    echo
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log_info "恢复已取消"
        exit 0
    fi
}

# 停止服务
stop_service() {
    log_info "停止服务..."
    
    if command_exists pm2; then
        pm2 stop all || true
        log_info "PM2 服务已停止 ✓"
    else
        pkill -f "node.*dist/index.js" || true
        log_info "Node 服务已停止 ✓"
    fi
}

# 恢复数据库
restore_database() {
    local backup_dir=$1
    
    log_info "恢复数据库..."
    
    # 查找备份文件
    local full_file=""
    if [ -f "$backup_dir/full.sql.gz" ]; then
        full_file="$backup_dir/full.sql.gz"
    elif [ -f "$backup_dir/full.sql" ]; then
        full_file="$backup_dir/full.sql"
    else
        log_error "未找到数据库备份文件"
        exit 1
    fi
    
    log_info "使用备份文件: $(basename "$full_file")"
    
    # 恢复数据库
    if [[ "$full_file" == *.gz ]]; then
        gunzip -c "$full_file" | mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME"
    else
        mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < "$full_file"
    fi
    
    log_info "数据库恢复完成 ✓"
}

# 恢复文件
restore_files() {
    local backup_dir=$1
    
    log_info "恢复文件..."
    
    # 恢复上传文件
    if [ -f "$backup_dir/uploads.tar.gz" ]; then
        log_info "恢复上传文件..."
        tar -xzf "$backup_dir/uploads.tar.gz"
        log_info "上传文件恢复完成 ✓"
    elif [ -f "$backup_dir/uploads.tar" ]; then
        log_info "恢复上传文件..."
        tar -xf "$backup_dir/uploads.tar"
        log_info "上传文件恢复完成 ✓"
    fi
    
    # 恢复日志文件
    if [ -f "$backup_dir/logs.tar.gz" ]; then
        log_info "恢复日志文件..."
        tar -xzf "$backup_dir/logs.tar.gz"
        log_info "日志文件恢复完成 ✓"
    elif [ -f "$backup_dir/logs.tar" ]; then
        log_info "恢复日志文件..."
        tar -xf "$backup_dir/logs.tar"
        log_info "日志文件恢复完成 ✓"
    fi
    
    # 恢复配置文件
    if [ -f "$backup_dir/configs.tar.gz" ]; then
        log_warn "发现配置文件备份，是否恢复? (可能覆盖当前配置)"
        read -p "恢复配置文件? (yes/no): " -r
        echo
        if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            tar -xzf "$backup_dir/configs.tar.gz"
            log_info "配置文件恢复完成 ✓"
        else
            log_info "跳过配置文件恢复"
        fi
    elif [ -f "$backup_dir/configs.tar" ]; then
        log_warn "发现配置文件备份，是否恢复? (可能覆盖当前配置)"
        read -p "恢复配置文件? (yes/no): " -r
        echo
        if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            tar -xf "$backup_dir/configs.tar"
            log_info "配置文件恢复完成 ✓"
        else
            log_info "跳过配置文件恢复"
        fi
    fi
    
    # 恢复模块文件
    if [ -f "$backup_dir/modules.tar.gz" ]; then
        log_info "恢复模块文件..."
        tar -xzf "$backup_dir/modules.tar.gz"
        log_info "模块文件恢复完成 ✓"
    elif [ -f "$backup_dir/modules.tar" ]; then
        log_info "恢复模块文件..."
        tar -xf "$backup_dir/modules.tar"
        log_info "模块文件恢复完成 ✓"
    fi
    
    # 恢复数据文件
    if [ -f "$backup_dir/data.tar.gz" ]; then
        log_info "恢复数据文件..."
        tar -xzf "$backup_dir/data.tar.gz"
        log_info "数据文件恢复完成 ✓"
    elif [ -f "$backup_dir/data.tar" ]; then
        log_info "恢复数据文件..."
        tar -xf "$backup_dir/data.tar"
        log_info "数据文件恢复完成 ✓"
    fi
}

# 启动服务
start_service() {
    log_info "启动服务..."
    
    if command_exists pm2; then
        pm2 start pm2.config.js
        pm2 save
        log_info "PM2 服务已启动 ✓"
    else
        npm start &
        log_info "Node 服务已启动 ✓"
    fi
}

# 验证恢复
verify_restore() {
    log_info "验证恢复..."
    
    # 等待服务启动
    sleep 5
    
    # 检查服务状态
    if command_exists pm2; then
        if pm2 list | grep -q "online"; then
            log_info "服务运行正常 ✓"
        else
            log_error "服务启动失败"
            exit 1
        fi
    else
        if curl -f http://localhost:3000/health >/dev/null 2>&1; then
            log_info "服务运行正常 ✓"
        else
            log_warn "服务健康检查失败，请手动检查"
        fi
    fi
    
    log_info "恢复验证完成 ✓"
}

# 生成恢复报告
generate_report() {
    log_info "生成恢复报告..."
    
    local report_file="logs/restore-report-$(date +%Y%m%d_%H%M%S).txt"
    mkdir -p logs
    
    {
        echo "========================================="
        echo "备份恢复报告"
        echo "========================================="
        echo ""
        echo "恢复时间: $(date '+%Y-%m-%d %H:%M:%S')"
        echo "恢复类型: $RESTORE_TYPE"
        echo ""
        if [[ "$RESTORE_TYPE" == "database" || "$RESTORE_TYPE" == "all" ]]; then
            echo "数据库备份: $DB_BACKUP_DIR"
        fi
        if [[ "$RESTORE_TYPE" == "files" || "$RESTORE_TYPE" == "all" ]]; then
            echo "文件备份: $FILE_BACKUP_DIR"
        fi
        echo ""
        echo "恢复状态: 成功"
        echo ""
        echo "========================================="
    } > "$report_file"
    
    log_info "恢复报告: $report_file ✓"
}

# 主函数
main() {
    log_info "========================================="
    log_info "备份恢复开始"
    log_info "========================================="
    
    parse_args "$@"
    load_env
    check_environment
    
    # 查找备份
    if [[ "$RESTORE_TYPE" == "database" || "$RESTORE_TYPE" == "all" ]]; then
        DB_BACKUP_DIR=$(find_latest_backup "database")
        log_info "数据库备份: $DB_BACKUP_DIR"
        show_backup_info "$DB_BACKUP_DIR"
    fi
    
    if [[ "$RESTORE_TYPE" == "files" || "$RESTORE_TYPE" == "all" ]]; then
        FILE_BACKUP_DIR=$(find_latest_backup "files")
        log_info "文件备份: $FILE_BACKUP_DIR"
        show_backup_info "$FILE_BACKUP_DIR"
    fi
    
    # 确认恢复
    confirm_restore
    
    # 停止服务
    stop_service
    
    # 执行恢复
    if [[ "$RESTORE_TYPE" == "database" || "$RESTORE_TYPE" == "all" ]]; then
        restore_database "$DB_BACKUP_DIR"
    fi
    
    if [[ "$RESTORE_TYPE" == "files" || "$RESTORE_TYPE" == "all" ]]; then
        restore_files "$FILE_BACKUP_DIR"
    fi
    
    # 启动服务
    start_service
    
    # 验证恢复
    verify_restore
    
    # 生成报告
    generate_report
    
    log_info "========================================="
    log_info "备份恢复完成 ✓"
    log_info "========================================="
}

# 执行主函数
main "$@"
