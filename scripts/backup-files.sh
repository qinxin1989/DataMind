#!/bin/bash

# AI 数据问答平台 - 文件备份脚本
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

# 检查环境
check_environment() {
    log_info "检查备份环境..."
    
    # 检查 tar
    if ! command_exists tar; then
        log_error "tar 未安装"
        exit 1
    fi
    log_info "tar 已安装 ✓"
    
    # 检查 gzip
    if ! command_exists gzip; then
        log_warn "gzip 未安装，将不压缩备份文件"
        COMPRESS=false
    else
        log_info "gzip 已安装 ✓"
        COMPRESS=true
    fi
    
    log_info "环境检查完成 ✓"
}

# 创建备份目录
create_backup_dir() {
    log_info "创建备份目录..."
    
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_DIR="backups/files/$TIMESTAMP"
    
    mkdir -p "$BACKUP_DIR"
    log_info "备份目录: $BACKUP_DIR ✓"
}

# 备份上传文件
backup_uploads() {
    log_info "备份上传文件..."
    
    if [ ! -d "uploads" ]; then
        log_warn "uploads 目录不存在，跳过"
        return
    fi
    
    local upload_count=$(find uploads -type f | wc -l)
    log_info "发现 $upload_count 个上传文件"
    
    if [ "$COMPRESS" = true ]; then
        tar -czf "$BACKUP_DIR/uploads.tar.gz" uploads/
        log_info "上传文件备份完成 (压缩) ✓"
    else
        tar -cf "$BACKUP_DIR/uploads.tar" uploads/
        log_info "上传文件备份完成 ✓"
    fi
}

# 备份日志文件
backup_logs() {
    log_info "备份日志文件..."
    
    if [ ! -d "logs" ]; then
        log_warn "logs 目录不存在，跳过"
        return
    fi
    
    local log_count=$(find logs -type f | wc -l)
    log_info "发现 $log_count 个日志文件"
    
    if [ "$COMPRESS" = true ]; then
        tar -czf "$BACKUP_DIR/logs.tar.gz" logs/
        log_info "日志文件备份完成 (压缩) ✓"
    else
        tar -cf "$BACKUP_DIR/logs.tar" logs/
        log_info "日志文件备份完成 ✓"
    fi
}

# 备份配置文件
backup_configs() {
    log_info "备份配置文件..."
    
    local config_files=(
        ".env"
        ".env.production"
        ".env.staging"
        "pm2.config.js"
        "nginx.conf"
    )
    
    local backup_list=""
    for file in "${config_files[@]}"; do
        if [ -f "$file" ]; then
            backup_list="$backup_list $file"
        fi
    done
    
    if [ -n "$backup_list" ]; then
        if [ "$COMPRESS" = true ]; then
            tar -czf "$BACKUP_DIR/configs.tar.gz" $backup_list
            log_info "配置文件备份完成 (压缩) ✓"
        else
            tar -cf "$BACKUP_DIR/configs.tar" $backup_list
            log_info "配置文件备份完成 ✓"
        fi
    else
        log_warn "未找到配置文件，跳过"
    fi
}

# 备份模块文件
backup_modules() {
    log_info "备份模块文件..."
    
    if [ ! -d "modules" ]; then
        log_warn "modules 目录不存在，跳过"
        return
    fi
    
    local module_count=$(find modules -maxdepth 1 -type d | wc -l)
    log_info "发现 $((module_count - 1)) 个模块"
    
    if [ "$COMPRESS" = true ]; then
        tar -czf "$BACKUP_DIR/modules.tar.gz" modules/
        log_info "模块文件备份完成 (压缩) ✓"
    else
        tar -cf "$BACKUP_DIR/modules.tar" modules/
        log_info "模块文件备份完成 ✓"
    fi
}

# 备份数据文件
backup_data() {
    log_info "备份数据文件..."
    
    if [ ! -d "data" ]; then
        log_warn "data 目录不存在，跳过"
        return
    fi
    
    local data_count=$(find data -type f | wc -l)
    log_info "发现 $data_count 个数据文件"
    
    if [ "$COMPRESS" = true ]; then
        tar -czf "$BACKUP_DIR/data.tar.gz" data/
        log_info "数据文件备份完成 (压缩) ✓"
    else
        tar -cf "$BACKUP_DIR/data.tar" data/
        log_info "数据文件备份完成 ✓"
    fi
}

# 生成备份信息
generate_info() {
    log_info "生成备份信息..."
    
    local info_file="$BACKUP_DIR/backup.info"
    
    cat > "$info_file" << EOF
# 文件备份信息

## 基本信息
- 备份时间: $(date '+%Y-%m-%d %H:%M:%S')
- 备份类型: 文件备份
- 压缩: $([ "$COMPRESS" = true ] && echo "是" || echo "否")

## 备份内容
EOF

    if [ -f "$BACKUP_DIR/uploads.tar"* ]; then
        echo "- uploads: 上传文件" >> "$info_file"
    fi
    
    if [ -f "$BACKUP_DIR/logs.tar"* ]; then
        echo "- logs: 日志文件" >> "$info_file"
    fi
    
    if [ -f "$BACKUP_DIR/configs.tar"* ]; then
        echo "- configs: 配置文件" >> "$info_file"
    fi
    
    if [ -f "$BACKUP_DIR/modules.tar"* ]; then
        echo "- modules: 模块文件" >> "$info_file"
    fi
    
    if [ -f "$BACKUP_DIR/data.tar"* ]; then
        echo "- data: 数据文件" >> "$info_file"
    fi
    
    cat >> "$info_file" << EOF

## 文件大小
EOF
    
    du -h "$BACKUP_DIR"/* | awk '{print "- " $2 ": " $1}' >> "$info_file"
    
    cat >> "$info_file" << EOF

## 恢复命令
\`\`\`bash
# 恢复上传文件
tar -xzf uploads.tar.gz

# 恢复日志文件
tar -xzf logs.tar.gz

# 恢复配置文件
tar -xzf configs.tar.gz

# 恢复模块文件
tar -xzf modules.tar.gz

# 恢复数据文件
tar -xzf data.tar.gz
\`\`\`

## 注意事项
- 恢复前请备份当前文件
- 配置文件可能需要根据环境调整
- 恢复后需要重启服务
EOF
    
    log_info "备份信息生成完成 ✓"
    log_debug "文件: $info_file"
}

# 清理旧备份
cleanup_old_backups() {
    log_info "清理旧备份..."
    
    # 保留最近 7 天的备份
    local retention_days=${BACKUP_RETENTION_DAYS:-7}
    
    find backups/files -type d -mtime +$retention_days -exec rm -rf {} + 2>/dev/null || true
    
    log_info "旧备份清理完成 (保留 $retention_days 天) ✓"
}

# 验证备份
verify_backup() {
    log_info "验证备份..."
    
    local backup_files=$(find "$BACKUP_DIR" -name "*.tar*" | wc -l)
    
    if [ "$backup_files" -eq 0 ]; then
        log_error "未找到备份文件"
        exit 1
    fi
    
    log_info "发现 $backup_files 个备份文件 ✓"
    
    # 验证每个备份文件
    for file in "$BACKUP_DIR"/*.tar*; do
        if [ -f "$file" ]; then
            local file_size=$(du -h "$file" | awk '{print $1}')
            log_debug "$(basename "$file"): $file_size"
            
            # 检查文件是否为空
            if [ ! -s "$file" ]; then
                log_error "备份文件为空: $file"
                exit 1
            fi
        fi
    done
    
    log_info "备份验证完成 ✓"
}

# 生成备份报告
generate_report() {
    log_info "生成备份报告..."
    
    local report_file="logs/file-backup-report-$(date +%Y%m%d_%H%M%S).txt"
    mkdir -p logs
    
    {
        echo "========================================="
        echo "文件备份报告"
        echo "========================================="
        echo ""
        echo "备份时间: $(date '+%Y-%m-%d %H:%M:%S')"
        echo "备份目录: $BACKUP_DIR"
        echo "压缩: $([ "$COMPRESS" = true ] && echo "是" || echo "否")"
        echo ""
        echo "备份文件:"
        ls -lh "$BACKUP_DIR"
        echo ""
        echo "总大小: $(du -sh "$BACKUP_DIR" | awk '{print $1}')"
        echo ""
        echo "========================================="
    } > "$report_file"
    
    log_info "备份报告: $report_file ✓"
}

# 主函数
main() {
    log_info "========================================="
    log_info "文件备份开始"
    log_info "========================================="
    
    check_environment
    create_backup_dir
    backup_uploads
    backup_logs
    backup_configs
    backup_modules
    backup_data
    generate_info
    verify_backup
    cleanup_old_backups
    generate_report
    
    log_info "========================================="
    log_info "文件备份完成 ✓"
    log_info "备份位置: $BACKUP_DIR"
    log_info "========================================="
}

# 执行主函数
main
