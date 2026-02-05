/**
 * 省份爬虫工具类
 * 提供统一的接口进行各省份网站数据采集
 */

import { DynamicEngine } from './dynamic_engine';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { ProvinceConfig, getProvinceConfig, PROVINCE_CONFIGS } from './provinces.config';

export interface CrawlResult {
  success: boolean;
  province: string;
  url: string;
  data: any[];
  count: number;
  error?: string;
  outputFile?: string;
}

export class ProvincesCrawler {
  private pythonPath: string;
  private enginePath: string;

  constructor(pythonPath?: string) {
    // 默认 Python 路径，可通过参数覆盖
    this.pythonPath = pythonPath || path.join(process.cwd(), '.venv', 'Scripts', 'python.exe');
    this.enginePath = path.join(process.cwd(), 'src', 'agent', 'skills', 'crawler', 'engine.py');
  }

  /**
   * 爬取单个省份
   */
  async crawlProvince(config: ProvinceConfig, outputDir: string = 'output'): Promise<CrawlResult> {
    const { name, code, url, selectors, needDynamic, waitSelector } = config;

    console.log(`\n====================`);
    console.log(`正在爬取: ${name} (${code})`);
    console.log(`URL: ${url}`);
    console.log(`====================`);

    try {
      // 第一步：获取 HTML
      let html: string;
      let tempHtmlPath: string;

      if (needDynamic) {
        // 使用 Puppeteer 获取动态渲染后的 HTML
        console.log('[1/3] 使用动态引擎获取页面...');
        html = await DynamicEngine.fetchHtml(url, {
          waitSelector,
          cookies: config.cookies,
          headers: config.headers
        });
        tempHtmlPath = path.join(process.cwd(), outputDir, `temp_${code}_${Date.now()}.html`);
      } else {
        // 静态页面，用简单请求
        console.log('[1/3] 获取静态页面...');
        const response = await fetch(url);
        html = await response.text();
        tempHtmlPath = path.join(process.cwd(), outputDir, `temp_${code}_${Date.now()}.html`);
      }

      // 保存临时 HTML（用于调试）
      if (!fs.existsSync(path.join(process.cwd(), outputDir))) {
        fs.mkdirSync(path.join(process.cwd(), outputDir), { recursive: true });
      }
      fs.writeFileSync(tempHtmlPath, html, 'utf-8');
      console.log(`[2/3] HTML 已保存到: ${tempHtmlPath}`);

      // 第二步：调用 Python 引擎解析
      console.log('[3/3] 使用 Python 引擎解析数据...');
      const data = await this.parseWithPython(html, url, selectors);

      // 清理临时文件
      if (fs.existsSync(tempHtmlPath)) {
        fs.unlinkSync(tempHtmlPath);
      }

      if (!data || data.length === 0) {
        return {
          success: false,
          province: name,
          url,
          data: [],
          count: 0,
          error: '未提取到数据'
        };
      }

      // 第三步：保存结果
      const outputFileName = `${code}_${Date.now()}.xlsx`;
      const outputPath = await this.saveToExcel(data, outputFileName, outputDir);

      return {
        success: true,
        province: name,
        url,
        data,
        count: data.length,
        outputFile: outputPath
      };

    } catch (error: any) {
      return {
        success: false,
        province: name,
        url,
        data: [],
        count: 0,
        error: error.message
      };
    }
  }

  /**
   * 使用 Python 引擎解析 HTML
   */
  private async parseWithPython(html: string, url: string, selectors: any): Promise<any[]> {
    return new Promise((resolve, reject) => {
      // 将 HTML 写入临时文件
      const tempPath = path.join(process.cwd(), 'output', `temp_parse_${Date.now()}.html`);
      fs.writeFileSync(tempPath, html, 'utf-8');

      const selectorsStr = JSON.stringify(selectors);
      const args = [this.enginePath, tempPath, selectorsStr, url];

      const child = spawn(this.pythonPath, args, {
        cwd: process.cwd()
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        // 清理临时文件
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }

        if (code !== 0) {
          console.error('Python Error:', stderr);
          return reject(new Error(stderr || 'Python 解析失败'));
        }

        try {
          const result = JSON.parse(stdout);
          if (result.success && result.data && result.data.length > 0) {
            console.log(`✓ 成功提取 ${result.data.length} 条数据`);
            resolve(result.data);
          } else {
            console.warn('⚠ 未提取到数据:', result.error || '数据为空');
            resolve([]);
          }
        } catch (e: any) {
          console.error('JSON 解析错误:', e.message);
          reject(new Error('结果解析失败'));
        }
      });

      child.on('error', (err) => {
        reject(new Error(`Python 进程启动失败: ${err.message}`));
      });
    });
  }

  /**
   * 保存为 Excel 文件
   */
  private async saveToExcel(data: any[], fileName: string, outputDir: string): Promise<string> {
    const XLSX = await import('xlsx');
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, '数据');
    const outputPath = path.join(process.cwd(), outputDir, fileName);
    XLSX.writeFile(workbook, outputPath);
    return outputPath;
  }

  /**
   * 批量爬取多个省份
   */
  async crawlMultiple(provinceCodes: string[], outputDir: string = 'output'): Promise<CrawlResult[]> {
    const results: CrawlResult[] = [];

    for (const code of provinceCodes) {
      const config = getProvinceConfig(code);
      if (!config) {
        console.warn(`⚠ 未找到省份配置: ${code}`);
        continue;
      }

      const result = await this.crawlProvince(config, outputDir);
      results.push(result);

      // 添加延迟避免请求过快
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return results;
  }

  /**
   * 爬取所有省份
   */
  async crawlAll(outputDir: string = 'output'): Promise<CrawlResult[]> {
    const allCodes = PROVINCE_CONFIGS.map(p => p.code);
    return this.crawlMultiple(allCodes, outputDir);
  }

  /**
   * 生成汇总报告
   */
  generateSummary(results: CrawlResult[]): void {
    console.log('\n' + '='.repeat(60));
    console.log('爬取汇总报告');
    console.log('='.repeat(60));

    const success = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const totalData = success.reduce((sum, r) => sum + r.count, 0);

    console.log(`总计: ${results.length} 个省份`);
    console.log(`成功: ${success.length} 个`);
    console.log(`失败: ${failed.length} 个`);
    console.log(`数据总量: ${totalData} 条`);

    if (failed.length > 0) {
      console.log('\n失败列表:');
      failed.forEach(r => {
        console.log(`  - ${r.province}: ${r.error || '未知错误'}`);
      });
    }

    console.log('\n成功列表:');
    success.forEach(r => {
      console.log(`  ✓ ${r.province}: ${r.count} 条数据 -> ${r.outputFile || ''}`);
    });

    console.log('='.repeat(60) + '\n');
  }
}

// 导出单例
export const provincesCrawler = new ProvincesCrawler();
