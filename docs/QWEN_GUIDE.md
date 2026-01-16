# 阿里云通义千问 API 配置指南

## 快速开始

### 1. 获取 API Key

1. 访问 [DashScope 控制台](https://dashscope.console.aliyun.com/)
2. 登录阿里云账户（没有则注册）
3. 开通 DashScope 服务
4. 在 **API-KEY 管理** 中创建新密钥
5. 复制 API Key（格式：`sk-` 开头）

> ⚠️ API Key 只显示一次，请立即保存！

### 2. 配置环境变量

在 `.env` 文件中添加：

```env
QWEN_API_KEY=sk-your_api_key_here
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

### 3. 启动应用

```bash
npm run dev
```

## 支持的模型

| 模型 | 说明 | 推荐用途 |
|------|------|--------|
| `qwen-plus` | 性能和成本平衡 | 通用场景（默认） |
| `qwen-turbo` | 更快的响应 | 实时交互 |
| `qwen-max` | 最强能力 | 复杂推理 |
| `qwen-long` | 长上下文 | 长文本处理 |

## 功能特性

- ✅ 自然语言转 SQL
- ✅ 智能数据分析
- ✅ 自动生成 BI 大屏
- ✅ 多数据源支持
- ✅ 对话历史管理
- ✅ 中文优化

## 与 OpenAI 对比

| 特性 | 千问 | OpenAI |
|------|------|--------|
| 中文优化 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| 成本 | 较低 | 较高 |
| 响应速度 | 快 | 快 |

## 常见问题

### Q: 如何切换回 OpenAI？
A: 注释掉 `.env` 中的 `QWEN_API_KEY`，系统会自动使用 `OPENAI_API_KEY`。

### Q: 如何查看 API 使用情况？
A: 登录 DashScope 控制台，在"用量统计"中查看。

### Q: API Key 泄露了怎么办？
A: 立即在控制台删除该 Key，然后创建新的。

## 安全建议

1. ✅ 不要在代码中硬编码 API Key
2. ✅ 不要将 `.env` 文件提交到 Git
3. ✅ 定期轮换 API Key
4. ✅ 监控 API 使用情况和费用

## 相关链接

- [DashScope 官方文档](https://help.aliyun.com/zh/dashscope/)
- [通义千问 API 参考](https://help.aliyun.com/zh/dashscope/developer-reference/quick-start)
- [定价信息](https://help.aliyun.com/zh/dashscope/billing-and-pricing)
