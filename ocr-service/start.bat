@echo off
echo ========================================
echo PaddleOCR GPU 轻量版服务启动脚本
echo ========================================

REM 检查 Python 环境
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 Python，请先安装 Python 3.8+
    pause
    exit /b 1
)

REM 检查是否已安装依赖
pip show paddleocr >nul 2>&1
if errorlevel 1 (
    echo [信息] 首次运行，安装依赖...
    pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
)

echo [信息] 启动 PaddleOCR 服务...
python app.py
