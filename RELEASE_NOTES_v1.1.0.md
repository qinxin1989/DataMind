# 🎉 v1.1.0 发布说明

**发布日期**: 2025-01-12  
**版本**: 1.1.0  
**GitHub**: [ai-data-platform v1.1.0](https://github.com/qinxin1989/ai-data-platform/releases/tag/v1.1.0)

---

## 📋 本次更新概览

这个版本主要添加了**文件上传功能**和**完整的测试套件**，使平台更加易用和可靠。

### 核心改进

#### 1️⃣ 文件上传功能 (新增)
- 前端支持直接上传 CSV、Excel、JSON 文件
- 自动检测文件类型
- 支持最大 50MB 文件
- 上传后自动创建数据源并进行连接测试

**使用方式**:
1. 进入数据源管理页面
2. 点击 "+ 新增数据源"
3. 选择类型为 "文件 (CSV/Excel/JSON)"
4. 点击文件选择框上传文件
5. 点击保存即可

#### 2️⃣ 测试套件 (新增)
- 完整的 API 测试框架
- 13 个核心 API 端点测试
- 自动化测试报告

**运行测试**:
```bash
npm run test
```

#### 3️⃣ 后端改进
- 新增 `/api/upload` 端点
- 集成 multer 中间件
- 自动创建 uploads 目录
- 文件类型和大小验证

#### 4️⃣ 前端改进
- 数据源管理页面优化
- 文件上传界面美化
- 改进的表单交互体验
- 实时文件信息显示

---

## 📦 技术细节

### 新增依赖
```json
{
  "multer": "^2.0.2",
  "@types/multer": "^2.0.0"
}
```

### 新增文件
- `tests/run-tests.ts` - 测试运行脚本
- `tests/api.test.ts` - 测试用例集合
- `CHANGELOG.md` - 版本更新日志
- `GET_QWEN_API_KEY.md` - 千问 API 获取指南
- `QWEN_SETUP.md` - 千问配置指南

### 修改文件
- `src/index.ts` - 添加文件上传 API
- `public/datasource.html` - 前端文件上传界面
- `package.json` - 版本更新和依赖添加

---

## 🧪 测试覆盖

新增的测试套件覆盖以下功能:

| 测试项 | 状态 | 说明 |
|--------|------|------|
| 健康检查 | ✅ | 服务器可用性检查 |
| 获取数据源列表 | ✅ | 数据源列表 API |
| 添加 MySQL 数据源 | ✅ | 数据源创建 |
| 测试连接 | ✅ | 连接验证 |
| 获取 Schema | ✅ | 数据库结构获取 |
| AI 分析 Schema | ✅ | AI 智能分析 |
| 自然语言问答 | ✅ | 核心问答功能 |
| 会话管理 | ✅ | 对话历史 |
| Agent 能力 | ✅ | 技能和工具 |
| 删除数据源 | ✅ | 清理操作 |

---

## 🚀 快速开始

### 安装依赖
```bash
npm install
```

### 启动开发服务器
```bash
npm run dev
```

### 运行测试
```bash
npm run test
```

### 构建生产版本
```bash
npm run build
npm start
```

---

## 📝 使用示例

### 上传 CSV 文件
```javascript
const formData = new FormData();
formData.append('file', csvFile);
formData.append('name', '销售数据');
formData.append('fileType', 'csv');

const response = await fetch('/api/upload', {
  method: 'POST',
  body: formData
});
```

### 运行测试
```bash
$ npm run test

╔════════════════════════════════════════╗
║   AI 数据问答平台 - API 测试套件      ║
╚════════════════════════════════════════╝

✓ 1. 健康检查 - 获取首页
✓ 2. API - 获取数据源列表
✓ 3. API - 获取 Agent 能力
...

总计: 13 | 通过: 13 | 失败: 0

🎉 所有测试通过！
```

---

## 🐛 已知问题

- 无

---

## 📚 文档

- [README.md](./README.md) - 项目说明
- [CHANGELOG.md](./CHANGELOG.md) - 完整更新日志
- [GET_QWEN_API_KEY.md](./GET_QWEN_API_KEY.md) - 千问 API 获取指南
- [QWEN_SETUP.md](./QWEN_SETUP.md) - 千问配置指南

---

## 🔄 升级指南

### 从 v1.0.0 升级到 v1.1.0

1. **拉取最新代码**
   ```bash
   git pull origin main
   ```

2. **安装新依赖**
   ```bash
   npm install
   ```

3. **重启服务**
   ```bash
   npm run dev
   ```

4. **运行测试验证**
   ```bash
   npm run test
   ```

---

## 🙏 致谢

感谢所有贡献者和用户的支持！

---

## 📞 反馈

如有问题或建议，欢迎提交 Issue 或 Pull Request。

- GitHub Issues: [ai-data-platform/issues](https://github.com/qinxin1989/ai-data-platform/issues)
- GitHub Discussions: [ai-data-platform/discussions](https://github.com/qinxin1989/ai-data-platform/discussions)

---

**Happy Coding! 🚀**
