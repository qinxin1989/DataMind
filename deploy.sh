#!/bin/bash

# AI 数据问答平台部署脚本

set -e  # 遇到错误立即退出

echo "🚀 开始部署 AI 数据问答平台..."

# 检查 Docker 和 Docker Compose
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose 未安装，请先安装 Docker Compose"
    exit 1
fi

# 创建必要的目录
echo "📁 创建目录结构..."
mkdir -p uploads data/audit-logs data/backups data/conversations data/notifications public/downloads ssl

# 设置权限
chmod 755 uploads data public/downloads
chmod -R 755 data/

# 检查环境变量文件
if [ ! -f .env ]; then
    echo "⚠️  .env 文件不存在，从 .env.example 复制..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "✅ 已创建 .env 文件，请编辑其中的配置"
    else
        echo "❌ .env.example 文件不存在"
        exit 1
    fi
fi

# 构建前端
echo "🔨 构建前端..."
cd admin-ui
npm ci
npm run build
cd ..

# 编译 TypeScript
echo "🔨 编译 TypeScript..."
npm run build

# 停止现有容器
echo "🛑 停止现有容器..."
docker-compose down

# 构建并启动服务
echo "🐳 构建并启动 Docker 容器..."
docker-compose up -d --build

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 30

# 检查服务状态
echo "🔍 检查服务状态..."
docker-compose ps

# 显示日志
echo "📋 显示应用日志..."
docker-compose logs app --tail=20

echo "✅ 部署完成！"
echo ""
echo "🌐 访问地址："
echo "  - HTTP:  http://localhost:3000"
echo "  - HTTPS: https://localhost (需要配置 SSL 证书)"
echo ""
echo "📊 管理命令："
echo "  - 查看日志: docker-compose logs -f app"
echo "  - 重启服务: docker-compose restart app"
echo "  - 停止服务: docker-compose down"
echo "  - 更新代码: git pull && ./deploy.sh"