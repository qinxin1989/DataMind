# 阿里云千问 AI 模型配置指南

## 快速开始

### 1. 获取 API Key

详见 [GET_QWEN_API_KEY.md](./GET_QWEN_API_KEY.md) 文件的完整步骤。

简单来说：
- 访问 [DashScope 控制台](https://dashscope.console.aliyun.com/)
- 在 "API-KEY 管理" 中创建新的 API Key
- 复制生成的 Key（格式：`sk-` 开头）

### 2. 配置环境变量

在项目根目录的 `.env` 文件中添加：

```env
QWEN_API_KEY=sk-your_api_key_here
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

### 3. 启动应用

```bash
npm run dev
```

看到以下日志说明配置成功：
```
AI数据问答平台运行在 http://localhost:3000
```

## 支持的模型

| 模型 | 说明 | 推荐用途 |
|------|------|--------|
| `qwen-plus` | 性能和成本平衡 | 通用场景（默认） |
| `qwen-turbo` | 更快的响应 | 实时交互 |
| `qwen-max` | 最强能力 | 复杂推理 |
| `qwen-long` | 长上下文 | 长文本处理 |

## 功能特性

✅ 自然语言转 SQL  
✅ 智能数据分析  
✅ 自动生成 BI 大屏  
✅ 多数据源支持  
✅ 对话历史管理  

## 与 OpenAI 的区别

| 特性 | 千问 | OpenAI |
|------|------|--------|
| 中文优化 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| 成本 | 较低 | 较高 |
| 响应速度 | 快 | 快 |
| 上下文长度 | 支持长上下文 | 有限制 |

## 常见问题

### Q: 如何切换模型？
A: 修改 `.env` 中的 `QWEN_API_KEY` 对应的模型名称，或在代码中指定。

### Q: 支持流式输出吗？
A: 支持，API 兼容 OpenAI 的流式接口。

### Q: 如何监控 API 使用情况？
A: 登录 DashScope 控制台，在 "用量统计" 中查看。

### Q: 如何切换回 OpenAI？
A: 注释掉 `QWEN_API_KEY`，系统会自动使用 `OPENAI_API_KEY`。

## 定价信息

详见 [阿里云 DashScope 定价](https://help.aliyun.com/zh/dashscope/billing-and-pricing)

## 更多资源

- [DashScope 官方文档](https://help.aliyun.com/zh/dashscope/)
- [通义千问 API 参考](https://help.aliyun.com/zh/dashscope/developer-reference/quick-start)
- [OpenAI 兼容接口](https://help.aliyun.com/zh/dashscope/developer-reference/compatibility-of-openai-with-dashscope/)
