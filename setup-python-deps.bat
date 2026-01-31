@echo off
echo ========================================
echo AI 数据平台 - Python 依赖安装脚本
echo ========================================
echo.

REM 检查 Python 是否安装
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 Python，请先安装 Python 3.8+
    echo 下载地址: https://www.python.org/downloads/
    pause
    exit /b 1
)

echo [1/3] 检测到 Python 版本:
python --version
echo.

REM 检查虚拟环境是否存在
if exist .venv (
    echo [2/3] 虚拟环境已存在，跳过创建
) else (
    echo [2/3] 创建 Python 虚拟环境...
    python -m venv .venv
    if errorlevel 1 (
        echo [错误] 创建虚拟环境失败
        pause
        exit /b 1
    )
    echo 虚拟环境创建成功
)
echo.

echo [3/3] 安装 Python 依赖包...
.venv\Scripts\python.exe -m pip install -r requirements.txt
if errorlevel 1 (
    echo [错误] 安装依赖失败
    pause
    exit /b 1
)

echo.
echo ========================================
echo ✓ Python 依赖安装完成！
echo ========================================
echo.
echo 后续步骤:
echo 1. 配置 .env 文件
echo 2. 运行 npm run dev 启动后端服务
echo 3. AI 爬虫功能现在可以正常使用了
echo.
pause
