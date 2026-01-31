# 省份爬虫使用指南

## 📦 新的代码结构

```
src/agent/skills/crawler/
├── engine.py              # Python 解析引擎（BeautifulSoup）
├── dynamic_engine.ts      # 动态页面渲染（Puppeteer）
├── service.ts             # 数据库服务
├── scheduler.ts           # 定时任务调度
├── provinces.config.ts    # ✨ 全国省份配置
└── ProvincesCrawler.ts    # ✨ 统一爬虫工具

scripts/
├── test-provinces.ts      # ✨ 统一测试脚本
└── crawler-clean.ts       # ✨ 清理脚本
```

## 🚀 快速开始

### 1. 测试单个省份

```bash
npm run test:province beijing
```

### 2. 测试多个省份

```bash
npm run test:provinces beijing tianjin shanghai
```

### 3. 测试所有省份

```bash
npm run test:all
```

### 4. 只测试需要动态渲染的省份

```bash
npm run test:dynamic
```

## 📋 省份代码列表

| 代码 | 省份 | 是否需要动态渲染 |
|------|------|------------------|
| nda | 国家国防科技工业局 | ❌ |
| beijing | 北京 | ❌ |
| tianjin | 天津 | ❌ |
| shanghai | 上海 | ✅ |
| chongqing | 重庆 | ❌ |
| hebei | 河北 | ❌ |
| shanxi | 山西 | ❌ |
| neimenggu | 内蒙古 | ❌ |
| liaoning | 辽宁 | ❌ |
| jilin | 吉林 | ❌ |
| heilongjiang | 黑龙江 | ❌ |
| jiangsu | 江苏 | ❌ |
| zhejiang | 浙江 | ❌ |
| anhui | 安徽 | ❌ |
| fujian | 福建 | ❌ |
| jiangxi | 江西 | ❌ |
| shandong | 山东 | ❌ |
| henan | 河南 | ❌ |
| hubei | 湖北 | ✅ |
| hunan | 湖南 | ❌ |
| guangdong | 广东 | ❌ |
| guangxi | 广西 | ❌ |
| hainan | 海南 | ❌ |
| sichuan | 四川 | ✅ |
| guizhou | 贵州 | ❌ |
| yunnan | 云南 | ❌ |
| xizang | 西藏 | ❌ |
| shaanxi | 陕西 | ❌ |
| gansu | 甘肃 | ❌ |
| qinghai | 青海 | ❌ |
| ningxia | 宁夏 | ❌ |
| xinjiang | 新疆 | ✅ |

## 💻 代码示例

### 基础用法

```typescript
import { ProvincesCrawler } from './src/agent/skills/crawler/ProvincesCrawler';
import { getProvinceConfig } from './src/agent/skills/crawler/provinces.config';

const crawler = new ProvincesCrawler();

// 爬取单个省份
const config = getProvinceConfig('beijing');
const result = await crawler.crawlProvince(config, 'output');

console.log(`成功: ${result.success}, 数据量: ${result.count}`);
```

### 批量爬取

```typescript
// 批量爬取多个省份
const results = await crawler.crawlMultiple(
  ['beijing', 'tianjin', 'shanghai'],
  'output'
);

// 生成汇总报告
crawler.generateSummary(results);
```

### 自定义配置

```typescript
import { PROVINCE_CONFIGS } from './src/agent/skills/crawler/provinces.config';

// 筛选需要动态渲染的省份
const dynamicProvinces = PROVINCE_CONFIGS
  .filter(p => p.needDynamic)
  .map(p => p.code);

const results = await crawler.crawlMultiple(dynamicProvinces);
```

## 🔧 配置说明

### 省份配置结构

```typescript
interface ProvinceConfig {
  name: string;          // 省份名称
  code: string;          // 省份代码（唯一标识）
  url: string;           // 目标网址
  department: string;    // 部门/网站名称
  selectors: {
    container: string;   // 列表容器选择器
    fields: Record<string, string>;  // 字段选择器
  };
  needDynamic?: boolean;  // 是否需要动态渲染
  waitSelector?: string;  // 等待选择器（动态页面）
  note?: string;          // 备注
}
```

### 添加新省份

在 `provinces.config.ts` 中添加配置：

```typescript
{
  name: '新省份',
  code: 'newprovince',
  url: 'https://example.gov.cn/policy-list',
  department: '新省数据局',
  selectors: {
    container: '.list li',
    fields: {
      '标题': 'a',
      '链接': 'a::attr(href)',
      '发布日期': 'span'
    }
  },
  needDynamic: false
}
```

## 🧹 清理旧文件

### 查看清理计划

```bash
npm run crawler:clean
```

### 执行清理

```bash
npm run crawler:clean --do
```

这将把旧的测试脚本移动到 `scripts/archive/`，调试数据移动到 `scripts/debug-data/`。

## 📂 输出目录

爬取结果默认保存在 `output/` 目录：

```
output/
├── beijing_1234567890.xlsx
├── tianjin_1234567891.xlsx
└── shanghai_1234567892.xlsx
```

## ⚠️ 注意事项

1. **Python 环境**：确保已安装 Python 和依赖
   ```bash
   pip install beautifulsoup4 requests lxml
   ```

2. **Node.js 依赖**：
   ```bash
   npm install puppeteer xlsx
   ```

3. **动态页面**：需要动态渲染的省份会使用 Puppeteer，速度较慢

4. **请求间隔**：批量爬取时自动添加 2 秒延迟，避免过快请求

5. **错误处理**：失败的省份会在汇总报告中列出，可单独调试

## 📚 更多文档

- [重构说明](./CRAWLER_REFACTOR.md) - 详细的代码重构说明
- [Python 引擎](../src/agent/skills/crawler/engine.py) - 数据解析引擎
- [动态引擎](../src/agent/skills/crawler/dynamic_engine.ts) - Puppeteer 渲染引擎
