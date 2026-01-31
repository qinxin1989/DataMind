#!/bin/bash

# 采集模板配置增强 - 部署脚本
# 用途：自动化部署流程

set -e  # 遇到错误立即退出

echo "========================================="
echo "采集模板配置增强 - 部署脚本"
echo "========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查环境
check_environment() {
    echo "检查部署环境..."
    
    # 检查Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}错误: 未安装Node.js${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Node.js 版本: $(node -v)${NC}"
    
    # 检查npm
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}错误: 未安装npm${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ npm 版本: $(npm -v)${NC}"
    
    # 检查MySQL
    if ! command -v mysql &> /dev/null; then
        echo -e "${YELLOW}警告: 未安装MySQL客户端，跳过数据库检查${NC}"
    else
        echo -e "${GREEN}✓ MySQL 已安装${NC}"
    fi
    
    echo ""
}

# 安装依赖
install_dependencies() {
    echo "安装项目依赖..."
    
    # 安装后端依赖
    echo "安装后端依赖..."
    npm ci --only=production
    echo -e "${GREEN}✓ 后端依赖安装完成${NC}"
    
    # 安装前端依赖
    echo "安装前端依赖..."
    cd admin-ui
    npm ci --only=production
    cd ..
    echo -e "${GREEN}✓ 前端依赖安装完成${NC}"
    
    echo ""
}

# 运行测试
run_tests() {
    echo "运行测试..."
    
    # 运行单元测试
    npm run test
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ 所有测试通过${NC}"
    else
        echo -e "${RED}✗ 测试失败，部署中止${NC}"
        exit 1
    fi
    
    echo ""
}

# 构建项目
build_project() {
    echo "构建项目..."
    
    # 构建前端
    echo "构建前端..."
    cd admin-ui
    npm run build
    cd ..
    echo -e "${GREEN}✓ 前端构建完成${NC}"
    
    # 构建后端
    echo "构建后端..."
    npm run build
    echo -e "${GREEN}✓ 后端构建完成${NC}"
    
    echo ""
}

# 数据库迁移
migrate_database() {
    echo "执行数据库迁移..."
    
    if [ -f "migrations/add_pagination_fields.sql" ]; then
        echo "发现迁移文件，准备执行..."
        
        # 读取数据库配置
        if [ -f ".env.production" ]; then
            source .env.production
            
            # 执行迁移
            mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < migrations/add_pagination_fields.sql
            
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}✓ 数据库迁移完成${NC}"
            else
                echo -e "${RED}✗ 数据库迁移失败${NC}"
                exit 1
            fi
        else
            echo -e "${YELLOW}警告: 未找到.env.production文件，跳过数据库迁移${NC}"
        fi
    else
        echo -e "${YELLOW}警告: 未找到迁移文件，跳过数据库迁移${NC}"
    fi
    
    echo ""
}

# 备份当前版本
backup_current() {
    echo "备份当前版本..."
    
    BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    # 备份关键文件
    if [ -d "dist" ]; then
        cp -r dist "$BACKUP_DIR/"
        echo -e "${GREEN}✓ 已备份dist目录${NC}"
    fi
    
    if [ -d "admin-ui/dist" ]; then
        cp -r admin-ui/dist "$BACKUP_DIR/admin-ui-dist"
        echo -e "${GREEN}✓ 已备份admin-ui/dist目录${NC}"
    fi
    
    echo -e "${GREEN}✓ 备份完成: $BACKUP_DIR${NC}"
    echo ""
}

# 部署应用
deploy_application() {
    echo "部署应用..."
    
    # 停止现有服务
    echo "停止现有服务..."
    if [ -f "pids/app.pid" ]; then
        PID=$(cat pids/app.pid)
        if ps -p $PID > /dev/null; then
            kill $PID
            echo -e "${GREEN}✓ 已停止现有服务 (PID: $PID)${NC}"
        fi
    fi
    
    # 启动新服务
    echo "启动新服务..."
    NODE_ENV=production npm start &
    NEW_PID=$!
    
    # 保存PID
    mkdir -p pids
    echo $NEW_PID > pids/app.pid
    
    echo -e "${GREEN}✓ 服务已启动 (PID: $NEW_PID)${NC}"
    echo ""
}

# 健康检查
health_check() {
    echo "执行健康检查..."
    
    # 等待服务启动
    sleep 5
    
    # 检查服务是否运行
    if [ -f "pids/app.pid" ]; then
        PID=$(cat pids/app.pid)
        if ps -p $PID > /dev/null; then
            echo -e "${GREEN}✓ 服务运行正常 (PID: $PID)${NC}"
            
            # 检查HTTP响应
            if command -v curl &> /dev/null; then
                HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health || echo "000")
                if [ "$HTTP_CODE" = "200" ]; then
                    echo -e "${GREEN}✓ HTTP健康检查通过${NC}"
                else
                    echo -e "${YELLOW}警告: HTTP健康检查失败 (状态码: $HTTP_CODE)${NC}"
                fi
            fi
        else
            echo -e "${RED}✗ 服务启动失败${NC}"
            exit 1
        fi
    else
        echo -e "${RED}✗ 未找到PID文件${NC}"
        exit 1
    fi
    
    echo ""
}

# 清理临时文件
cleanup() {
    echo "清理临时文件..."
    
    # 清理node_modules中的缓存
    npm cache clean --force > /dev/null 2>&1
    
    echo -e "${GREEN}✓ 清理完成${NC}"
    echo ""
}

# 显示部署信息
show_deployment_info() {
    echo "========================================="
    echo "部署完成！"
    echo "========================================="
    echo ""
    echo "服务信息："
    echo "  - 端口: 3000"
    echo "  - 环境: production"
    echo "  - PID: $(cat pids/app.pid 2>/dev/null || echo '未知')"
    echo ""
    echo "访问地址："
    echo "  - http://localhost:3000"
    echo ""
    echo "日志文件："
    echo "  - 应用日志: logs/app.log"
    echo "  - 错误日志: logs/error.log"
    echo ""
    echo "管理命令："
    echo "  - 查看日志: tail -f logs/app.log"
    echo "  - 停止服务: kill \$(cat pids/app.pid)"
    echo "  - 重启服务: ./deploy.sh"
    echo ""
}

# 主流程
main() {
    # 解析命令行参数
    SKIP_TESTS=false
    SKIP_BACKUP=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            --skip-backup)
                SKIP_BACKUP=true
                shift
                ;;
            --help)
                echo "用法: ./deploy.sh [选项]"
                echo ""
                echo "选项:"
                echo "  --skip-tests    跳过测试"
                echo "  --skip-backup   跳过备份"
                echo "  --help          显示帮助信息"
                exit 0
                ;;
            *)
                echo -e "${RED}未知选项: $1${NC}"
                exit 1
                ;;
        esac
    done
    
    # 执行部署流程
    check_environment
    install_dependencies
    
    if [ "$SKIP_TESTS" = false ]; then
        run_tests
    else
        echo -e "${YELLOW}跳过测试${NC}"
        echo ""
    fi
    
    if [ "$SKIP_BACKUP" = false ]; then
        backup_current
    else
        echo -e "${YELLOW}跳过备份${NC}"
        echo ""
    fi
    
    build_project
    migrate_database
    deploy_application
    health_check
    cleanup
    show_deployment_info
}

# 运行主流程
main "$@"
