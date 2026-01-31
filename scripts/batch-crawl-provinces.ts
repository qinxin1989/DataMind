/**
 * 批量爬取各省份政策法规文件
 * 使用已有的省份配置，批量爬取并导出到Excel
 */

import { PROVINCE_CONFIGS } from '../src/agent/skills/crawler/provinces.config';
import { DynamicEngine } from '../src/agent/skills/crawler/dynamic_engine';
import * as path from 'path';
import * as fs from 'fs';
import * as xlsx from 'xlsx';

interface CrawlResult {
  province: string;
  department: string;
  url: string;
  data: any[];
  count: number;
  error?: string;
  pagesCrawled?: number;
}

const results: CrawlResult[] = [];
const OUTPUT_DIR = path.join(__dirname, '..', 'output');

// 确保输出目录存在
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * 使用Python引擎爬取单个页面
 */
async function crawlWithPython(
  url: string,
  selectors: any,
  htmlContent?: string,
  paginationConfig?: any
): Promise<{ success: boolean; data?: any[]; count?: number; pages_crawled?: number; error?: string }> {
  const pythonPath = process.env.PYTHON_PATH || path.join(process.cwd(), '.venv', 'Scripts', 'python');
  const enginePath = path.join(__dirname, '../src/agent/skills/crawler/engine.py');

  return new Promise(async (resolve) => {
    let sourceArg = url;
    let baseUrlArg = '';
    let tempFilePath = '';

    try {
      // 如果提供了HTML内容（动态渲染），保存到临时文件
      if (htmlContent) {
        const os = require('os');
        const tempDir = os.tmpdir();
        tempFilePath = path.join(tempDir, `crawl_${Date.now()}.html`);
        fs.writeFileSync(tempFilePath, htmlContent);
        sourceArg = tempFilePath;
        baseUrlArg = url;
      }

      const safeSelectors = JSON.stringify(selectors);
      const paginationArg = paginationConfig ? JSON.stringify(paginationConfig) : 'null';

      const args = [enginePath, sourceArg, safeSelectors, baseUrlArg, paginationArg];
      console.log(`[Python] Running: ${pythonPath} ${args.map(a => (a.length > 100 ? a.substring(0, 50) + '...' : a)).join(' ')}`);

      const { spawn } = require('child_process');
      const child = spawn(pythonPath, args, {
        timeout: 180000,
        windowsHide: true
      });
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: any) => { stdout += data; });
      child.stderr.on('data', (data: any) => { stderr += data; });

      child.on('close', (code: number) => {
        // 清理临时文件
        if (tempFilePath && fs.existsSync(tempFilePath)) {
          try { fs.unlinkSync(tempFilePath); } catch (e) { }
        }

        if (code !== 0) {
          console.error(`[Python] Exit code ${code}, stderr: ${stderr}`);
          resolve({ success: false, error: stderr });
          return;
        }

        try {
          const jsonStart = stdout.indexOf('{"success":');
          if (jsonStart === -1) {
            console.error('[Python] No valid JSON in output');
            resolve({ success: false, error: 'Invalid output format' });
            return;
          }

          const jsonStr = stdout.substring(jsonStart);
          const result = JSON.parse(jsonStr);
          resolve(result);
        } catch (e) {
          console.error('[Python] Failed to parse output:', e);
          resolve({ success: false, error: 'Parse failed' });
        }
      });

      child.on('error', (err: any) => {
        if (tempFilePath && fs.existsSync(tempFilePath)) {
          try { fs.unlinkSync(tempFilePath); } catch (e) { }
        }
        console.error('[Python] Failed to start:', err);
        resolve({ success: false, error: err.message });
      });
    } catch (error: any) {
      resolve({ success: false, error: error.message });
    }
  });
}

/**
 * 爬取单个省份
 */
async function crawlProvince(config: any): Promise<CrawlResult> {
  const startTime = Date.now();
  console.log('');
  console.log('========================================');
  console.log('正在爬取: ' + config.name);
  console.log('URL: ' + config.url);
  console.log('========================================');
  console.log('');

  try {
    let htmlContent: string | undefined;
    let paginationConfig = undefined;

    // 判断是否需要动态渲染
    if (config.needDynamic) {
      console.log('[' + config.name + '] 使用动态引擎抓取...');
      try {
        htmlContent = await DynamicEngine.fetchHtml(config.url, {
          cookies: config.cookies,
          headers: config.headers,
          waitSelector: config.waitSelector
        });
        console.log('[' + config.name + '] 动态HTML获取成功，长度: ' + htmlContent.length);
      } catch (err: any) {
        console.error('[' + config.name + '] 动态抓取失败: ' + err.message + '，尝试静态抓取...');
        htmlContent = undefined;
      }
    } else {
      console.log('[' + config.name + '] 使用静态抓取...');
    }

    // 准备选择器配置
    const selectors = {
      container: config.selectors.container,
      fields: config.selectors.fields
    };

    // 执行爬取（启用分页，最多20页，爬取所有政策文件）
    paginationConfig = {
      enabled: true,
      max_pages: 20
    };

    const result = await crawlWithPython(config.url, selectors, htmlContent, paginationConfig);

    const duration = Date.now() - startTime;

    if (result.success && result.data) {
      console.log('[' + config.name + '] OK 成功！抓取 ' + result.count + ' 条数据，耗时 ' + duration + 'ms，共 ' + result.pages_crawled + ' 页');

      // 添加省份和部门信息
      const enrichedData = result.data.map((item: any) => {
        const newItem: any = {
          省份: config.name,
          部门: config.department,
          来源URL: config.url
        };
        // 合并原有字段
        for (const key in item) {
          newItem[key] = item[key];
        }
        return newItem;
      });

      return {
        province: config.name,
        department: config.department,
        url: config.url,
        data: enrichedData,
        count: result.count || 0,
        pagesCrawled: result.pages_crawled
      };
    } else {
      console.error('[' + config.name + '] X 失败: ' + result.error);
      return {
        province: config.name,
        department: config.department,
        url: config.url,
        data: [],
        count: 0,
        error: result.error
      };
    }
  } catch (error: any) {
    console.error('[' + config.name + '] X 异常: ' + error.message);
    return {
      province: config.name,
      department: config.department,
      url: config.url,
      data: [],
      count: 0,
      error: error.message
    };
  }
}

/**
 * 导出结果到Excel
 */
function exportToExcel(allResults: CrawlResult[]) {
  console.log('');
  console.log('========================================');
  console.log('正在导出到Excel...');
  console.log('========================================');
  console.log('');

  // 合并所有数据
  const allData: any[] = [];
  let totalRows = 0;

  for (const result of allResults) {
    if (result.data && result.data.length > 0) {
      for (let i = 0; i < result.data.length; i++) {
        allData.push(result.data[i]);
      }
      totalRows += result.data.length;
    }
  }

  if (allData.length === 0) {
    console.log('没有数据可导出');
    return;
  }

  // 创建工作簿
  const workbook = xlsx.utils.book_new();

  // 1. 合并数据表
  const worksheet1 = xlsx.utils.json_to_sheet(allData);
  xlsx.utils.book_append_sheet(workbook, worksheet1, '全部数据');

  // 2. 按省份分表
  const provinceSet = new Set<string>();
  for (let i = 0; i < allData.length; i++) {
    const item = allData[i];
    if (item['省份']) {
      provinceSet.add(item['省份']);
    }
  }
  const provinces = Array.from(provinceSet);

  for (let i = 0; i < provinces.length; i++) {
    const province = provinces[i];
    const provinceData = allData.filter((item: any) => item['省份'] === province);
    if (provinceData.length > 0) {
      const ws = xlsx.utils.json_to_sheet(provinceData);
      xlsx.utils.book_append_sheet(workbook, ws, province);
    }
  }

  // 3. 统计摘要表
  const summary = allResults.map(r => ({
    省份: r.province,
    部门: r.department,
    数据量: r.count,
    页数: r.pagesCrawled || 1,
    状态: r.error ? '失败' : '成功',
    错误信息: r.error || ''
  }));
  const summaryWs = xlsx.utils.json_to_sheet(summary);
  xlsx.utils.book_append_sheet(workbook, summaryWs, '统计摘要');

  // 保存文件
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const filename = '各省份政策法规_' + timestamp + '.xlsx';
  const filepath = path.join(OUTPUT_DIR, filename);

  xlsx.writeFile(workbook, filepath);
  console.log('OK Excel文件已保存: ' + filename);
  console.log('  - 总行数: ' + totalRows);
  console.log('  - 省份数: ' + provinces.length);
  console.log('  - 工作表: ' + workbook.SheetNames.length);
  console.log('  - 文件路径: ' + filepath);

  // 同时保存CSV格式（兼容性更好）
  const csvFilename = '各省份政策法规_' + timestamp + '.csv';
  const csvFilepath = path.join(OUTPUT_DIR, csvFilename);
  const csvWs = xlsx.utils.json_to_sheet(allData);
  const csvWorkbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(csvWorkbook, csvWs, 'Data');
  xlsx.writeFile(csvWorkbook, csvFilepath);
  console.log('OK CSV文件已保存: ' + csvFilename);
}

/**
 * 主函数
 */
async function main() {
  console.log('========================================');
  console.log('批量爬取各省份政策法规文件');
  console.log('========================================');
  console.log('待爬取省份数量: ' + PROVINCE_CONFIGS.length);
  console.log('输出目录: ' + OUTPUT_DIR);
  console.log('');

  let successCount = 0;
  let failCount = 0;
  let totalDataCount = 0;

  // 串行爬取（避免并发过多）
  for (let i = 0; i < PROVINCE_CONFIGS.length; i++) {
    const config = PROVINCE_CONFIGS[i];
    console.log('进度: ' + (i + 1) + '/' + PROVINCE_CONFIGS.length);

    const result = await crawlProvince(config);
    results.push(result);

    if (result.error) {
      failCount++;
    } else {
      successCount++;
      totalDataCount += result.count;
    }

    // 延迟避免请求过快
    if (i < PROVINCE_CONFIGS.length - 1) {
      console.log('等待2秒后继续...');
      console.log('');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('');
  console.log('========================================');
  console.log('爬取完成！');
  console.log('========================================');
  console.log('成功: ' + successCount + '/' + PROVINCE_CONFIGS.length);
  console.log('失败: ' + failCount + '/' + PROVINCE_CONFIGS.length);
  console.log('总数据量: ' + totalDataCount + ' 条');
  console.log('');

  // 导出Excel
  exportToExcel(results);

  // 显示详细统计
  console.log('');
  console.log('详细统计:');
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const status = result.error ? 'X' : 'OK';
    const pages = result.pagesCrawled ? ' (' + result.pagesCrawled + '页)' : '';
    console.log('  ' + status + ' ' + result.province + ': ' + result.count + ' 条' + pages);
    if (result.error) {
      console.log('      错误: ' + result.error);
    }
  }
}

// 运行
main()
  .then(() => {
    console.log('');
    console.log('OK 所有任务完成！');
    process.exit(0);
  })
  .catch((error) => {
    console.error('');
    console.error('X 执行失败:', error);
    process.exit(1);
  });
