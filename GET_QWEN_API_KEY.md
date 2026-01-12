# 获取阿里云通义千问 API Key 完整指南

## 第一步：注册阿里云账户

1. 访问 [阿里云官网](https://www.aliyun.com/)
2. 点击右上角 "登录" 或 "注册"
3. 如果没有账户，按照提示完成注册（需要手机验证）
4. 登录你的阿里云账户

## 第二步：开通 DashScope 服务

1. 访问 [阿里云 DashScope 控制台](https://dashscope.console.aliyun.com/)
2. 如果是第一次访问，会提示开通服务
3. 点击 "立即开通" 或 "开通服务"
4. 阅读服务协议，勾选同意
5. 点击 "确认开通"

## 第三步：创建 API Key

### 方法一：通过 DashScope 控制台（推荐）

1. 登录 [DashScope 控制台](https://dashscope.console.aliyun.com/)
2. 在左侧菜单找到 **"API-KEY 管理"** 或 **"密钥管理"**
3. 点击 **"创建新的 API-KEY"** 或 **"新建密钥"**
4. 输入密钥名称（例如：`my-qwen-key`）
5. 点击 **"创建"** 按钮
6. 复制生成的 API Key（格式通常为 `sk-` 开头）

> ⚠️ **重要**：API Key 只会显示一次，请立即复制并妥善保管！

### 方法二：通过百炼控制台

1. 访问 [阿里云百炼控制台](https://bailian.console.aliyun.com/)
2. 在左侧菜单找到 **"密钥管理"**
3. 点击 **"新建密钥"**
4. 输入密钥名称
5. 点击 **"创建"**
6. 复制 API Key

## 第四步：配置到项目

### 方式一：修改 .env 文件（推荐用于开发）

在项目根目录的 `.env` 文件中添加：

```env
QWEN_API_KEY=sk-your_api_key_here
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

### 方式二：环境变量（推荐用于生产）

**Windows 系统：**
1. 右键点击 "此电脑" → "属性"
2. 点击 "高级系统设置"
3. 点击 "环境变量"
4. 在 "系统变量" 中点击 "新建"
5. 变量名：`QWEN_API_KEY`
6. 变量值：`sk-your_api_key_here`
7. 点击 "确定"

**Mac/Linux 系统：**
```bash
export QWEN_API_KEY="sk-your_api_key_here"
```

## 第五步：验证配置

启动应用后，查看日志输出：

```bash
npm run dev
```

如果看到以下日志说明配置成功：
```
AI数据问答平台运行在 http://localhost:3000
```

## 支持的模型列表

| 模型名称 | 说明 | 推荐场景 |
|---------|------|--------|
| `qwen-plus` | 性能和成本平衡 | 通用场景（推荐） |
| `qwen-turbo` | 更快的响应速度 | 实时交互 |
| `qwen-max` | 最强的模型 | 复杂推理任务 |
| `qwen-long` | 支持长上下文 | 长文本处理 |

## 常见问题

### Q1: 如何查看我的 API Key？
A: API Key 只在创建时显示一次。如果丢失，需要创建新的 API Key。

### Q2: API Key 泄露了怎么办？
A: 立即在控制台删除该 API Key，然后创建新的。

### Q3: 如何切换不同的 API Key？
A: 修改 `.env` 文件中的 `QWEN_API_KEY` 值，然后重启应用。

### Q4: 支持免费额度吗？
A: 新用户通常有免费额度。具体详见 [DashScope 定价页面](https://help.aliyun.com/zh/dashscope/billing-and-pricing)

### Q5: 如何查看 API 调用记录和费用？
A: 登录 DashScope 控制台，在 "用量统计" 或 "账单" 中查看。

### Q6: 如何切换回 OpenAI？
A: 注释掉 `.env` 中的 `QWEN_API_KEY` 配置，系统会自动使用 `OPENAI_API_KEY`。

## 获取帮助

- [DashScope 官方文档](https://help.aliyun.com/zh/dashscope/)
- [通义千问 API 参考](https://help.aliyun.com/zh/dashscope/developer-reference/quick-start)
- [阿里云开发者社区](https://developer.aliyun.com/)

## 安全建议

1. ✅ 不要在代码中硬编码 API Key
2. ✅ 不要将 `.env` 文件提交到 Git
3. ✅ 定期轮换 API Key
4. ✅ 为不同的应用使用不同的 API Key
5. ✅ 监控 API 使用情况和费用
