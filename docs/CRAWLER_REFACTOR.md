# 爬虫代码重构说明

## 📁 新的代码结构

```
src/agent/skills/crawler/
├── engine.py              # Python 解析引擎
├── engine.ts              # TypeScript 引擎接口
├── dynamic_engine.ts      # 动态页面渲染引擎 (Puppeteer)
├── service.ts             # 爬虫数据库服务
├── scheduler.ts           # 定时任务调度器
├── index.ts               # 导出入口
├── provinces.config.ts    # ✨ 新增：全国省份配置
└── ProvincesCrawler.ts    # ✨ 新增：省份爬虫工具类

scripts/
├── test-provinces.ts      # ✨ 新增：统一的测试脚本
└── [旧文件...]            # 待清理
```

## ✨ 新功能

### 1. 统一的省份配置 (`provinces.config.ts`)

包含全国 31 个省市自治区的配置：
- 省份名称和代码
- 目标网址
- CSS 选择器
- 是否需要动态渲染

```typescript
import { getProvinceConfig } from './provinces.config';

const config = getProvinceConfig('beijing');
console.log(config.url, config.selectors);
```

### 2. 省份爬虫工具类 (`ProvincesCrawler.ts`)

提供统一的爬取接口：
- `crawlProvince()` - 爬取单个省份
- `crawlMultiple()` - 批量爬取
- `crawlAll()` - 爬取所有省份
- `generateSummary()` - 生成汇总报告

### 3. 统一的测试脚本 (`test-provinces.ts`)

```bash
# 测试单个省份
npm run test:province beijing

# 测试多个省份
npm run test:provinces beijing tianjin shanghai

# 测试所有省份
npm run test:all

# 测试需要动态渲染的省份
npm run test:dynamic
```

## 🗑️ 可以删除的测试文件

### 旧的调试脚本（保留在 scripts 目录用于调试）

以下文件可以移动到 `scripts/archive/` 目录或删除：

```bash
# 批量测试脚本（已被 test-provinces.ts 替代）
batch-test-sites.ts
batch-test-sites-new.ts

# 调试脚本
debug-sites.ts
debug-remaining-provinces.ts
debug-guizhou-discovery.js
debug-guizhou-user.js
debug-hubei-cookie.js
debug-hubei-simple.js
debug-sichuan-new.js
debug-sichuan-structure.js

# 修复脚本
fix-guizhou.js
fix-hubei-cookie.js
fix-hubei-simple.js
fix-nmg.js
fix-sichuan.js
fix-shanghai.js
fix-sites.js
fix-remaining-sites.ts

# 单站点测试
test-nmg-site.ts
test-remaining-sites.ts
verify-dynamic-fetch.ts

# 其他
get-nmg-html.ts
get-batch-html.ts
get-sichuan-html.js
crawl-to-excel.ts
test-engine-local.ts
```

### HTML 和 JSON 调试文件

可以移动到 `scripts/debug-data/` 目录：

```bash
scripts/*.html          # 各省份的调试 HTML
scripts/*.png           # 截图文件
scripts/*.json          # 测试结果 JSON
scripts/fixed_*.json    # 修复后的数据
scripts/final_*.json    # 最终数据
```

### 建议的目录结构

```
scripts/
├── test-provinces.ts           # 新的统一测试脚本
├── archive/                    # 归档旧脚本
│   ├── batch-test-sites.ts
│   ├── debug-*.js
│   └── fix-*.js
└── debug-data/                 # 调试数据
    ├── *.html
    ├── *.json
    └── *.png
```

## 📋 清理步骤

### 方案一：完全删除

```bash
# 删除旧测试脚本
rm scripts/batch-test-sites.ts
rm scripts/debug-*.js
rm scripts/fix-*.js
rm scripts/test-*.ts
rm scripts/get-*.ts
rm scripts/crawl-to-excel.ts

# 删除调试数据
mkdir scripts/debug-data
mv scripts/*.html scripts/debug-data/
mv scripts/*.json scripts/debug-data/
mv scripts/*.png scripts/debug-data/
```

### 方案二：归档保存

```bash
# 创建归档目录
mkdir -p scripts/archive scripts/debug-data

# 归档旧脚本
mv scripts/batch-test-sites.ts scripts/archive/
mv scripts/debug-*.js scripts/archive/
mv scripts/fix-*.js scripts/archive/
mv scripts/test-*.ts scripts/archive/ 2>/dev/null || true
mv scripts/get-*.ts scripts/archive/
mv scripts/crawl-to-excel.ts scripts/archive/

# 归档调试数据
mv scripts/*.html scripts/debug-data/
mv scripts/*.json scripts/debug-data/
mv scripts/*.png scripts/debug-data/
```

## 🔧 需要更新的 package.json 脚本

添加以下命令：

```json
{
  "scripts": {
    "test:province": "ts-node scripts/test-provinces.ts",
    "test:provinces": "ts-node scripts/test-provinces.ts",
    "test:all": "ts-node scripts/test-provinces.ts all",
    "test:dynamic": "ts-node scripts/test-provinces.ts dynamic"
  }
}
```

## 📖 使用示例

### 1. 测试单个省份

```typescript
import { ProvincesCrawler } from './src/agent/skills/crawler/ProvincesCrawler';

const crawler = new ProvincesCrawler();
const result = await crawler.crawlProvince(getProvinceConfig('beijing'), 'output');

console.log(`提取了 ${result.count} 条数据`);
```

### 2. 批量测试

```typescript
const results = await crawler.crawlMultiple([
  'beijing', 'tianjin', 'shanghai'
], 'output');

crawler.generateSummary(results);
```

### 3. 只测试动态页面

```typescript
const dynamicResults = await crawler.crawlMultiple(
  PROVINCE_CONFIGS.filter(p => p.needDynamic).map(p => p.code),
  'output'
);
```

## ⚠️ 注意事项

1. **Python 路径**：确保 `.venv/Scripts/python.exe` 存在，或在创建 `ProvincesCrawler` 时指定路径

2. **依赖安装**：
   ```bash
   npm install puppeteer xlsx
   pip install beautifulsoup4 requests lxml
   ```

3. **动态页面**：需要动态渲染的省份会在配置中标记 `needDynamic: true`

4. **输出目录**：默认为 `output/`，会自动创建

## 🚀 下一步

1. 运行清理脚本（方案一或方案二）
2. 更新 package.json 添加新命令
3. 测试新脚本：`npm run test:province beijing`
4. 根据需要调整省份配置
