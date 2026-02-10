# GitHub 仓库设置指南

## 项目名称推荐

- **DataMind** (首选) - AI数据智能平台
- QueryMind - 智能查询平台
- DataTalk - 对话式数据查询
- SmartQuery - 智能查询
- DataGenie - 数据精灵

## 上传到GitHub步骤

### 1. 在GitHub创建新仓库

访问: https://github.com/new

配置:
- **Repository name**: `DataMind` (或您选择的名称)
- **Description**: `AI-powered data query platform with natural language support | 支持自然语言的AI数据查询平台`
- **Visibility**: Public 或 Private
- **不要勾选**: "Initialize this repository with a README"

### 2. 初始化本地Git仓库

```bash
# 检查是否已有git仓库
git status

# 如果没有,初始化git仓库
git init

# 添加所有文件
git add .

# 创建首次提交
git commit -m "Initial commit: AI Data Query Platform v1.2.3"
```

### 3. 连接到GitHub远程仓库

**替换 `YOUR_USERNAME` 和 `REPO_NAME` 为您的实际值**

```bash
# 添加远程仓库
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git

# 或使用SSH (如果已配置SSH密钥)
git remote add origin git@github.com:YOUR_USERNAME/REPO_NAME.git

# 查看远程仓库
git remote -v
```

### 4. 推送代码到GitHub

```bash
# 推送到main分支
git branch -M main
git push -u origin main
```

### 5. 验证上传

访问您的GitHub仓库页面,确认代码已成功上传。

## 后续维护

### 日常提交流程

```bash
# 查看修改
git status

# 添加修改的文件
git add .

# 提交修改
git commit -m "描述您的修改"

# 推送到GitHub
git push
```

### 创建分支

```bash
# 创建并切换到新分支
git checkout -b feature/new-feature

# 推送新分支到GitHub
git push -u origin feature/new-feature
```

### 标签管理

```bash
# 创建版本标签
git tag -a v1.2.3 -m "Release version 1.2.3"

# 推送标签到GitHub
git push origin v1.2.3

# 推送所有标签
git push origin --tags
```

## 常见问题

### Q: 如果已经有.git目录怎么办?

```bash
# 删除现有的远程仓库配置
git remote remove origin

# 添加新的远程仓库
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git

# 推送代码
git push -u origin main
```

### Q: 推送时提示认证失败?

GitHub已不支持密码认证,需要使用:
1. **Personal Access Token (PAT)**: Settings → Developer settings → Personal access tokens
2. **SSH密钥**: 更安全,推荐使用

### Q: 文件太大无法推送?

```bash
# 查看大文件
find . -type f -size +50M

# 将大文件添加到.gitignore
echo "path/to/large/file" >> .gitignore

# 如果已经提交,需要从历史中删除
git rm --cached path/to/large/file
git commit -m "Remove large file"
```

## 推荐的README徽章

在README.md顶部添加:

```markdown
![Version](https://img.shields.io/badge/version-1.2.3-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-green)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)
```

## 安全提醒

⚠️ **重要**: 确保以下文件不会被上传:
- `.env` (包含敏感信息)
- `node_modules/` (依赖包)
- `.venv/` (Python虚拟环境)
- `uploads/` (用户上传的文件)
- 数据库文件

这些已在 `.gitignore` 中配置,请勿修改。

## 完成后

1. 在GitHub仓库页面添加Topics标签: `ai`, `data-query`, `nlp`, `typescript`, `vue`
2. 编辑About部分,添加项目描述和网站链接
3. 考虑添加LICENSE文件 (推荐MIT)
4. 启用GitHub Issues和Discussions (如果是公开项目)

---

**创建时间**: 2026-02-01
**项目版本**: v1.2.3
