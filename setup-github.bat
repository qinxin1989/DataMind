@echo off
chcp 65001 >nul
echo ========================================
echo   GitHub 仓库设置脚本
echo ========================================
echo.

REM 检查是否已有git仓库
if exist .git (
    echo [✓] 检测到已有Git仓库
) else (
    echo [!] 初始化Git仓库...
    git init
    if errorlevel 1 (
        echo [✗] Git初始化失败,请确保已安装Git
        pause
        exit /b 1
    )
    echo [✓] Git仓库初始化成功
)

echo.
echo ========================================
echo   请输入您的GitHub信息
echo ========================================
echo.

REM 获取用户输入
set /p GITHUB_USERNAME="请输入您的GitHub用户名: "
set /p REPO_NAME="请输入仓库名称 (推荐: DataMind): "

REM 如果没有输入仓库名,使用默认值
if "%REPO_NAME%"=="" set REPO_NAME=DataMind

echo.
echo [i] 将使用以下配置:
echo     用户名: %GITHUB_USERNAME%
echo     仓库名: %REPO_NAME%
echo     远程地址: https://github.com/%GITHUB_USERNAME%/%REPO_NAME%.git
echo.

set /p CONFIRM="确认继续? (Y/N): "
if /i not "%CONFIRM%"=="Y" (
    echo [!] 操作已取消
    pause
    exit /b 0
)

echo.
echo ========================================
echo   开始配置...
echo ========================================
echo.

REM 检查是否已有远程仓库
git remote get-url origin >nul 2>&1
if not errorlevel 1 (
    echo [!] 检测到已有远程仓库,正在移除...
    git remote remove origin
)

REM 添加所有文件
echo [1/5] 添加文件到Git...
git add .
if errorlevel 1 (
    echo [✗] 添加文件失败
    pause
    exit /b 1
)
echo [✓] 文件添加成功

REM 创建提交
echo [2/5] 创建初始提交...
git commit -m "Initial commit: AI Data Query Platform v1.2.3"
if errorlevel 1 (
    echo [!] 提交失败或没有需要提交的更改
)
echo [✓] 提交创建成功

REM 重命名分支为main
echo [3/5] 设置主分支为main...
git branch -M main
echo [✓] 分支设置成功

REM 添加远程仓库
echo [4/5] 添加远程仓库...
git remote add origin https://github.com/%GITHUB_USERNAME%/%REPO_NAME%.git
if errorlevel 1 (
    echo [✗] 添加远程仓库失败
    pause
    exit /b 1
)
echo [✓] 远程仓库添加成功

REM 推送到GitHub
echo [5/5] 推送代码到GitHub...
echo.
echo [!] 注意: 如果提示认证,请使用Personal Access Token而不是密码
echo     获取Token: https://github.com/settings/tokens
echo.
git push -u origin main
if errorlevel 1 (
    echo.
    echo [✗] 推送失败,可能的原因:
    echo     1. 仓库不存在 - 请先在GitHub创建仓库
    echo     2. 认证失败 - 请使用Personal Access Token
    echo     3. 网络问题 - 请检查网络连接
    echo.
    echo [i] 您可以稍后手动执行: git push -u origin main
    pause
    exit /b 1
)

echo.
echo ========================================
echo   ✓ 设置完成!
echo ========================================
echo.
echo [✓] 代码已成功推送到GitHub
echo [i] 仓库地址: https://github.com/%GITHUB_USERNAME%/%REPO_NAME%
echo.
echo 后续步骤:
echo   1. 访问您的GitHub仓库
echo   2. 添加Topics标签: ai, data-query, nlp, typescript, vue
echo   3. 编辑About部分添加项目描述
echo   4. 考虑添加LICENSE文件
echo.
pause
