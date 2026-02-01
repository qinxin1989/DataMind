#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "========================================"
echo "  GitHub 仓库设置脚本"
echo "========================================"
echo ""

# 检查是否已有git仓库
if [ -d .git ]; then
    echo -e "${GREEN}[✓]${NC} 检测到已有Git仓库"
else
    echo -e "${YELLOW}[!]${NC} 初始化Git仓库..."
    git init
    if [ $? -ne 0 ]; then
        echo -e "${RED}[✗]${NC} Git初始化失败,请确保已安装Git"
        exit 1
    fi
    echo -e "${GREEN}[✓]${NC} Git仓库初始化成功"
fi

echo ""
echo "========================================"
echo "  请输入您的GitHub信息"
echo "========================================"
echo ""

# 获取用户输入
read -p "请输入您的GitHub用户名: " GITHUB_USERNAME
read -p "请输入仓库名称 (推荐: DataMind): " REPO_NAME

# 如果没有输入仓库名,使用默认值
if [ -z "$REPO_NAME" ]; then
    REPO_NAME="DataMind"
fi

echo ""
echo -e "${BLUE}[i]${NC} 将使用以下配置:"
echo "    用户名: $GITHUB_USERNAME"
echo "    仓库名: $REPO_NAME"
echo "    远程地址: https://github.com/$GITHUB_USERNAME/$REPO_NAME.git"
echo ""

read -p "确认继续? (Y/N): " CONFIRM
if [ "$CONFIRM" != "Y" ] && [ "$CONFIRM" != "y" ]; then
    echo -e "${YELLOW}[!]${NC} 操作已取消"
    exit 0
fi

echo ""
echo "========================================"
echo "  开始配置..."
echo "========================================"
echo ""

# 检查是否已有远程仓库
if git remote get-url origin &> /dev/null; then
    echo -e "${YELLOW}[!]${NC} 检测到已有远程仓库,正在移除..."
    git remote remove origin
fi

# 添加所有文件
echo -e "${BLUE}[1/5]${NC} 添加文件到Git..."
git add .
if [ $? -ne 0 ]; then
    echo -e "${RED}[✗]${NC} 添加文件失败"
    exit 1
fi
echo -e "${GREEN}[✓]${NC} 文件添加成功"

# 创建提交
echo -e "${BLUE}[2/5]${NC} 创建初始提交..."
git commit -m "Initial commit: AI Data Query Platform v1.2.3"
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}[!]${NC} 提交失败或没有需要提交的更改"
fi
echo -e "${GREEN}[✓]${NC} 提交创建成功"

# 重命名分支为main
echo -e "${BLUE}[3/5]${NC} 设置主分支为main..."
git branch -M main
echo -e "${GREEN}[✓]${NC} 分支设置成功"

# 添加远程仓库
echo -e "${BLUE}[4/5]${NC} 添加远程仓库..."
git remote add origin https://github.com/$GITHUB_USERNAME/$REPO_NAME.git
if [ $? -ne 0 ]; then
    echo -e "${RED}[✗]${NC} 添加远程仓库失败"
    exit 1
fi
echo -e "${GREEN}[✓]${NC} 远程仓库添加成功"

# 推送到GitHub
echo -e "${BLUE}[5/5]${NC} 推送代码到GitHub..."
echo ""
echo -e "${YELLOW}[!]${NC} 注意: 如果提示认证,请使用Personal Access Token而不是密码"
echo "    获取Token: https://github.com/settings/tokens"
echo ""
git push -u origin main
if [ $? -ne 0 ]; then
    echo ""
    echo -e "${RED}[✗]${NC} 推送失败,可能的原因:"
    echo "    1. 仓库不存在 - 请先在GitHub创建仓库"
    echo "    2. 认证失败 - 请使用Personal Access Token"
    echo "    3. 网络问题 - 请检查网络连接"
    echo ""
    echo -e "${BLUE}[i]${NC} 您可以稍后手动执行: git push -u origin main"
    exit 1
fi

echo ""
echo "========================================"
echo -e "  ${GREEN}✓ 设置完成!${NC}"
echo "========================================"
echo ""
echo -e "${GREEN}[✓]${NC} 代码已成功推送到GitHub"
echo -e "${BLUE}[i]${NC} 仓库地址: https://github.com/$GITHUB_USERNAME/$REPO_NAME"
echo ""
echo "后续步骤:"
echo "  1. 访问您的GitHub仓库"
echo "  2. 添加Topics标签: ai, data-query, nlp, typescript, vue"
echo "  3. 编辑About部分添加项目描述"
echo "  4. 考虑添加LICENSE文件"
echo ""
