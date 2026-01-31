# AI爬虫助手 - 使用指南

## 系统概述

AI爬虫助手是一个**通用、智能的网页数据采集系统**，可以爬取任何类型的网站数据：

- ✅ 政策法规文件
- ✅ 新闻资讯
- ✅ 公告通知
- ✅ 博客文章
- ✅ 产品信息
- ✅ 任何列表类型的数据

## 核心特性

### 1. 智能分析
- AI自动分析网页结构
- 生成CSS选择器
- 检测页面类型（静态/动态）
- 智能推荐字段配置

### 2. 通用爬虫
- 适用于任何网站
- 自动适配不同页面结构
- 支持动态渲染页面
- 智能兜底算法

### 3. 模板管理
- 保存和复用爬虫配置
- 31个省级政府网站预置模板
- 模板导入导出
- 一键克隆模板

### 4. 智能分类
- AI自动分类内容
- 支持：政策、解读、新闻、通知
- 提取元数据（文号、发文单位、日期）

## 快速开始

### 安装依赖

```bash
# Python依赖
pip install beautifulsoup4 requests lxml

# Node依赖已包含在package.json中
npm install
```

### 初始化数据库

```bash
# 执行数据库迁移
mysql -u root -p ai_data_platform < migrations/add_crawler_enhancements.sql
```

### 初始化省级模板

```bash
# 将31个省份配置导入数据库作为系统模板
npm run bootstrap:templates
```

## 使用方式

### 方式一：对话模式（推荐）

在AI对话中直接发送网址，AI会自动分析并生成爬虫模板：

```
你: 帮我抓取 https://news.example.com 这个网站的新闻
AI: [自动调用 crawler.analyze 技能]
AI: 我已分析该网站，这是建议的配置：
    - 容器选择器: .news-list li
    - 标题字段: a.title
    - 链接字段: a::attr(href)
    - 日期字段: .date
    - 置信度: 85%

    是否保存为模板？确认后我将开始抓取。
```

### 方式二：API调用

#### 1. 分析网页生成模板

```typescript
POST /admin/ai/crawler/analyze
{
  "url": "https://news.example.com",
  "description": "新闻列表"
}

// 返回:
{
  "success": true,
  "template": {
    "name": "新闻列表 (news.example.com)",
    "pageType": "static",
    "containerSelector": ".news-list li",
    "fields": [
      { "name": "标题", "selector": "a.title" },
      { "name": "链接", "selector": "a::attr(href)" },
      { "name": "日期", "selector": ".date" }
    ],
    "confidence": 85
  }
}
```

#### 2. 保存模板

```typescript
POST /admin/ai/crawler/template
{
  "userId": "user-123",
  "name": "示例网站新闻",
  "url": "https://news.example.com",
  "pageType": "static",
  "containerSelector": ".news-list li",
  "fields": [
    { "name": "标题", "selector": "a.title" },
    { "name": "链接", "selector": "a::attr(href)" }
  ]
}

// 返回模板ID
{
  "success": true,
  "templateId": "tpl-uuid"
}
```

#### 3. 使用模板提取数据

```typescript
POST /admin/ai/crawler/extract
{
  "url": "https://news.example.com",
  "templateId": "tpl-uuid"
}

// 返回抓取结果
{
  "success": true,
  "data": [
    { "标题": "新闻1", "链接": "...", "日期": "2024-01-01", "类型": "新闻" },
    { "标题": "新闻2", "链接": "...", "日期": "2024-01-02", "类型": "新闻" }
  ],
  "message": "成功抓取 20 条数据"
}
```

### 方式三：直接使用技能

```typescript
import { SkillsRegistry } from './src/agent/skills/registry';

// 分析网页
const result = await SkillsRegistry.execute('crawler.analyze', {
  url: 'https://news.example.com',
  description: '新闻列表'
}, {
  openai: openaiClient,
  model: 'gpt-4o'
});

// 提取数据（自动分析）
const data = await SkillsRegistry.execute('crawler.extract', {
  url: 'https://news.example.com',
  saveTemplate: true,
  templateName: '示例网站新闻'
}, {
  userId: 'user-123',
  openai: openaiClient
});
```

## 高级功能

### 1. 定时自动抓取

```typescript
// 创建定时任务
POST /admin/ai/crawler/tasks
{
  "templateId": "tpl-uuid",
  "name": "每日新闻抓取",
  "frequency": "daily",  // minutely/hourly/daily
  "userId": "user-123"
}

// 任务会自动执行，结果保存在数据库中
```

### 2. 数据变更通知

系统会在以下情况发送通知：
- 抓取到新数据
- 抓取任务失败
- 任务执行成功

```typescript
// 获取通知
GET /admin/ai/crawler/notifications?unreadOnly=true

// 标记已读
PUT /admin/ai/crawler/notifications/:id/read
```

### 3. 数据去重

```sql
-- 自动检测重复数据（基于标题哈希）
CALL sp_detect_crawler_duplicates('template-id', 'result-id');

-- 查看重复统计
SELECT * FROM v_crawler_template_stats;
```

### 4. 智能内容分类

AI会自动将内容分类为：
- 政策（通知、公告、意见、办法、规定等）
- 解读（解读、解析、问答、图解等）
- 新闻（新闻、动态、资讯等）
- 通知（公示、公告、通告等）

## 模板管理

### 预置模板

系统包含31个省级政府网站模板：

```
npm run bootstrap:templates  # 导入所有省份模板
```

### 克隆模板到用户

```bash
# 克隆所有模板
npm run bootstrap:clone user-123

# 克隆指定省份
npm run bootstrap:clone user-123 beijing shanghai guangdong
```

### 导入导出模板

```typescript
// 导出模板
GET /admin/ai/crawler/templates/export

// 导入模板
POST /admin/ai/crawler/templates/import
Content-Type: application/json

{
  "templates": [
    {
      "name": "我的爬虫模板",
      "url": "https://example.com",
      "containerSelector": ".list li",
      "fields": [...]
    }
  ]
}
```

## 支持的网站类型

系统设计了通用的识别模式，支持：

### 政府网站
- 各级政府门户网站
- 政策文件发布平台
- 公示公告系统

### 新闻媒体
- 新闻门户网站
- 资讯发布平台
- 媒体网站

### 其他网站
- 博客平台
- 论坛社区
- 产品目录
- 任何列表类型的数据

### 列表结构模式

系统自动识别以下列表结构：
- `ul li` / `ol li` - 列表项
- `.list li` - 带list类的列表
- `.news-list li` - 新闻列表
- `table tr` - 表格行
- `.doc-list li` - 文档列表
- `[class*="list"] li` - 包含list的类名

## 命令行工具

```bash
# 清理旧的测试文件
npm run crawler:clean --do

# 测试单个省份
npm run test:province beijing

# 测试多个省份
npm run test:provinces beijing tianjin shanghai

# 测试所有省份
npm run test:all

# 测试动态页面
npm run test:dynamic

# 初始化省级模板
npm run bootstrap:templates

# 克隆模板到用户
npm run bootstrap:clone <userId> [provinceCodes...]
```

## 文件结构

```
src/agent/skills/crawler/
├── index.ts                  # 技能定义（crawler.analyze, crawler.extract）
├── TemplateAnalyzer.ts       # 智能模板分析器
├── CrawlerTemplate.ts        # 模板管理类
├── service.ts                # 数据库服务
├── dynamic_engine.ts         # 动态页面渲染（Puppeteer）
├── engine.py                 # Python解析引擎（BeautifulSoup）
├── scheduler.ts              # 定时任务调度
└── provinces.config.ts       # 31个省份配置

scripts/
├── test-provinces.ts         # 省份测试工具
├── crawler-clean.ts          # 清理工具
├── bootstrap-crawler-templates.ts  # 模板初始化
├── archive/                  # 归档的旧脚本
└── debug-data/               # 调试数据

migrations/
└── add_crawler_enhancements.sql  # 数据库增强
```

## 常见问题

### Q: 如何爬取需要登录的网站？
A: 当前版本不支持登录后爬取，需要添加Cookie支持或使用浏览器自动化。

### Q: 如何处理JavaScript渲染的页面？
A: 系统会自动检测并使用Puppeteer渲染动态页面，也可以手动设置 `pageType: 'dynamic'`。

### Q: 爬取速度如何？
A: 静态页面约2-5秒，动态页面约10-20秒（包含渲染时间）。

### Q: 如何避免被封禁？
A: 系统内置随机User-Agent和请求延迟，建议配合代理使用。

### Q: 可以爬取分页数据吗？
A: 当前版本支持单页爬取，分页需要多次调用或编写自定义脚本。

## 下一步

1. 执行数据库迁移
2. 初始化省级模板
3. 通过对话测试新网站
4. 保存常用网站的模板
5. 设置定时任务自动抓取

## 技术支持

遇到问题？查看：
- [重构说明](./CRAWLER_REFACTOR.md)
- [代码结构](../src/agent/skills/crawler/README.md)
- 问题反馈：在项目仓库提Issue
