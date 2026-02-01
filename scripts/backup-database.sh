#!/bin/bash

# AI 数据问答平台 - 数据库备份脚本
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
    
    # 验证必要的环境变量
    if [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ -z "$DB_NAME" ]; then
        log_error "缺少必要的数据库配置"
        exit 1
    fi
}

# 检查环境
check_environment() {
    log_info "检查备份环境..."
    
    # 检查 mysqldump
    if ! command_exists mysqldump; then
        log_error "mysqldump 未安装"
        exit 1
    fi
    log_info "mysqldump 已安装 ✓"
    
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
    BACKUP_DIR="backups/database/$TIMESTAMP"
    
    mkdir -p "$BACKUP_DIR"
    log_info "备份目录: $BACKUP_DIR ✓"
}

# 备份数据库结构
backup_schema() {
    log_info "备份数据库结构..."
    
    local schema_file="$BACKUP_DIR/schema.sql"
    
    mysqldump \
        -h"$DB_HOST" \
        -u"$DB_USER" \
        -p"$DB_PASSWORD" \
        --no-data \
        --routines \
        --triggers \
        --events \
        "$DB_NAME" > "$schema_file"
    
    log_info "数据库结构备份完成 ✓"
    log_debug "文件: $schema_file"
}

# 备份数据库数据
backup_data() {
    log_info "备份数据库数据..."
    
    local data_file="$BACKUP_DIR/data.sql"
    
    mysqldump \
        -h"$DB_HOST" \
        -u"$DB_USER" \
        -p"$DB_PASSWORD" \
        --no-create-info \
        --skip-triggers \
        --single-transaction \
        --quick \
        "$DB_NAME" > "$data_file"
    
    log_info "数据库数据备份完成 ✓"
    log_debug "文件: $data_file"
}

# 备份完整数据库
backup_full() {
    log_info "备份完整数据库..."
    
    local full_file="$BACKUP_DIR/full.sql"
    
    mysqldump \
        -h"$DB_HOST" \
        -u"$DB_USER" \
        -p"$DB_PASSWORD" \
        --routines \
        --triggers \
        --events \
        --single-transaction \
        --quick \
        "$DB_NAME" > "$full_file"
    
    log_info "完整数据库备份完成 ✓"
    log_debug "文件: $full_file"
}

# 压缩备份文件
compress_backup() {
    if [ "$COMPRESS" = true ]; then
        log_info "压缩备份文件..."
        
        cd "$BACKUP_DIR"
        gzip -9 *.sql
        cd - > /dev/null
        
        log_info "备份文件压缩完成 ✓"
    fi
}

# 生成备份信息
generate_info() {
    log_info "生成备份信息..."
    
    local info_file="$BACKUP_DIR/backup.info"
    
    cat > "$info_file" << EOF
# 数据库备份信息

## 基本信息
- 备份时间: $(date '+%Y-%m-%d %H:%M:%S')
- 数据库主机: $DB_HOST
- 数据库名称: $DB_NAME
- 备份类型: 完整备份

## 备份文件
EOF

    if [ "$COMPRESS" = true ]; then
        cat >> "$info_file" << EOF
- schema.sql.gz: 数据库结构
- data.sql.gz: 数据库数据
- full.sql.gz: 完整备份
EOF
    else
        cat >> "$info_file" << EOF
- schema.sql: 数据库结构
- data.sql: 数据库数据
- full.sql: 完整备份
EOF
    fi
    
    cat >> "$info_file" << EOF

## 文件大小
EOF
    
    du -h "$BACKUP_DIR"/* | awk '{print "- " $2 ": " $1}' >> "$info_file"
    
    cat >> "$info_file" << EOF

## 恢复命令
EOF
    
    if [ "$COMPRESS" = true ]; then
        cat >> "$info_file" << EOF
\`\`\`bash
# 恢复完整数据库
gunzip -c full.sql.gz | mysql -h\$DB_HOST -u\$DB_USER -p\$DB_PASSWORD \$DB_NAME

# 或分别恢复结构和数据
gunzip -c schema.sql.gz | mysql -h\$DB_HOST -u\$DB_USER -p\$DB_PASSWORD \$DB_NAME
gunzip -c data.sql.gz | mysql -h\$DB_HOST -u\$DB_USER -p\$DB_PASSWORD \$DB_NAME
\`\`\`
EOF
    else
        cat >> "$info_file" << EOF
\`\`\`bash
# 恢复完整数据库
mysql -h\$DB_HOST -u\$DB_USER -p\$DB_PASSWORD \$DB_NAME < full.sql

# 或分别恢复结构和数据
mysql -h\$DB_HOST -u\$DB_USER -p\$DB_PASSWORD \$DB_NAME < schema.sql
mysql -h\$DB_HOST -u\$DB_USER -p\$DB_PASSWORD \$DB_NAME < data.sql
\`\`\`
EOF
    fi
    
    log_info "备份信息生成完成 ✓"
    log_debug "文件: $info_file"
}

# 清理旧备份
cleanup_old_backups() {
    log_info "清理旧备份..."
    
    # 保留最近 7 天的备份
    local retention_days=${BACKUP_RETENTION_DAYS:-7}
    
    find backups/database -type d -mtime +$retention_days -exec rm -rf {} + 2>/dev/null || true
    
    log_info "旧备份清理完成 (保留 $retention_days 天) ✓"
}

# 验证备份
verify_backup() {
    log_info "验证备份..."
    
    local full_file="$BACKUP_DIR/full.sql"
    if [ "$COMPRESS" = true ]; then
        full_file="$full_file.gz"
    fi
    
    if [ ! -f "$full_file" ]; then
        log_error "备份文件不存在"
        exit 1
    fi
    
    local file_size=$(du -h "$full_file" | awk '{print $1}')
    log_info "备份文件大小: $file_size ✓"
    
    # 检查文件是否为空
    if [ ! -s "$full_file" ]; then
        log_error "备份文件为空"
        exit 1
    fi
    
    log_info "备份验证完成 ✓"
}

# 生成备份报告
generate_report() {
    log_info "生成备份报告..."
    
    local report_file="logs/backup-report-$(date +%Y%m%d_%H%M%S).txt"
    mkdir -p logs
    
    {
        echo "========================================="
        echo "数据库备份报告"
        echo "========================================="
        echo ""
        echo "备份时间: $(date '+%Y-%m-%d %H:%M:%S')"
        echo "备份目录: $BACKUP_DIR"
        echo "数据库: $DB_NAME@$DB_HOST"
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
    log_info "数据库备份开始"
    log_info "========================================="
    
    load_env
    check_environment
    create_backup_dir
    backup_schema
    backup_data
    backup_full
    compress_backup
    generate_info
    verify_backup
    cleanup_old_backups
    generate_report
    
    log_info "========================================="
    log_info "数据库备份完成 ✓"
    log_info "备份位置: $BACKUP_DIR"
    log_info "========================================="
}

# 执行主函数
main
