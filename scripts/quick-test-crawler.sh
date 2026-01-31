#!/bin/bash
# AI爬虫助手 - 快速测试脚本

echo "========================================"
echo "AI爬虫助手 - 后端测试"
echo "========================================"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. 编译TypeScript
echo -e "\n${YELLOW}[1/5] 编译TypeScript...${NC}"
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}✗ 编译失败${NC}"
    exit 1
fi
echo -e "${GREEN}✓ 编译成功${NC}"

# 2. 测试后端功能
echo -e "\n${YELLOW}[2/5] 测试后端功能...${NC}"
npx tsx scripts/test-crawler-backend.ts
if [ $? -ne 0 ]; then
    echo -e "${RED}✗ 后端测试失败${NC}"
    exit 1
fi
echo -e "${GREEN}✓ 后端测试通过${NC}"

# 3. 检查Python环境
echo -e "\n${YELLOW}[3/5] 检查Python环境...${NC}"
if [ -f ".venv/Scripts/python.exe" ]; then
    .venv/Scripts/python.exe --version
    .venv/Scripts/python.exe -c "import bs4, requests; print('BeautifulSoup:', bs4.__version__); print('Requests: OK')"
    echo -e "${GREEN}✓ Python环境正常${NC}"
else
    echo -e "${RED}✗ Python环境未找到${NC}"
    echo "请运行: python -m venv .venv"
    exit 1
fi

# 4. 检查数据库连接（可选）
echo -e "\n${YELLOW}[4/5] 数据库状态...${NC}"
echo "提示: 请确保数据库已运行，如需初始化请执行:"
echo "  mysql -u root -p ai_data_platform < migrations/add_crawler_enhancements.sql"

# 5. 测试总结
echo -e "\n${YELLOW}[5/5] 测试总结${NC}"
echo "========================================"
echo -e "${GREEN}✓ 所有组件检查完成！${NC}"
echo "========================================"
echo ""
echo "后端功能已就绪，可以开始使用："
echo ""
echo "1. 初始化数据库（首次使用）："
echo "   mysql -u root -p ai_data_platform < migrations/add_crawler_enhancements.sql"
echo ""
echo "2. 初始化省级模板："
echo "   npm run bootstrap:templates"
echo ""
echo "3. 启动服务器："
echo "   npm run dev"
echo ""
echo "4. 测试爬虫功能："
echo "   # 在AI对话中发送网址"
echo "   # 或使用API测试"
echo ""
echo "测试命令："
echo "  npm run test:province beijing   # 测试单个省份"
echo "  npm run test:all                 # 测试所有省份"
echo ""
echo "文档："
echo "  docs/CRAWLER_GUIDE.md  - 完整使用指南"
echo "  docs/CRAWLER_README.md - 快速参考"
echo ""
