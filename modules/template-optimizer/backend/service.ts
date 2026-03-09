/**
 * 模板优化器服务
 * 实现模板测试和优化的核心逻辑
 */

import { AIAgent } from '../../../src/agent/index';
import { createDataSource } from '../../../src/datasource/index';
import { ConfigStore } from '../../../src/store/configStore';
import fs from 'fs';
import path from 'path';

interface TestOptions {
  quick?: boolean;           // 快速测试（只跑少量用例）
  categories?: string[];       // 指定测试类别
  saveReport?: boolean;      // 是否保存报告
}

interface TestResult {
  datasourceId: string;
  timestamp: string;
  total: number;
  correct: number;
  accuracy: number;
  byCategory: {
    category: string;
    total: number;
    correct: number;
    accuracy: number;
  }[];
  failedCases: {
    question: string;
    expected: string;
    actual: string;
    category: string;
  }[];
  duration: number;
}

interface OptimizationOptions {
  targetAccuracy: number;
  maxIterations: number;
}

interface OptimizationResult {
  datasourceId: string;
  timestamp: string;
  iterations: number;
  finalAccuracy: number;
  improvements: string[];
  status: 'success' | 'partial' | 'failed';
}

interface TaskStatus {
  isRunning: boolean;
  currentTask?: string;
  progress?: number;
  message?: string;
}

export class TemplateOptimizerService {
  private agent: AIAgent;
  private configStore: ConfigStore;
  private currentTask: TaskStatus = { isRunning: false };

  constructor() {
    this.agent = new AIAgent();
    this.configStore = new ConfigStore();
  }

  /**
   * 运行模板测试
   */
  async runTest(datasourceId: string, options: TestOptions = {}): Promise<TestResult> {
    const startTime = Date.now();
    this.currentTask = { 
      isRunning: true, 
      currentTask: 'test',
      message: '正在读取数据源配置...'
    };

    try {
      // 1. 获取数据源配置
      const config = await this.configStore.getById(datasourceId);
      if (!config) {
        throw new Error(`数据源 ${datasourceId} 不存在`);
      }

      this.currentTask.message = '正在读取表结构...';
      
      // 2. 创建数据源并获取schema
      const dataSource = createDataSource(config);
      const schemas = await dataSource.getSchema();

      if (!schemas || schemas.length === 0) {
        throw new Error('数据源没有表结构信息');
      }

      this.currentTask.message = '正在生成测试用例...';
      
      // 3. 生成测试用例
      const testCases = this.generateTestCases(schemas, options);

      this.currentTask.message = `正在运行 ${testCases.length} 个测试...`;
      
      // 4. 运行测试
      let correct = 0;
      const byCategory = new Map<string, { total: number; correct: number }>();
      const failedCases: TestResult['failedCases'] = [];

      for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        this.currentTask.progress = Math.round((i / testCases.length) * 100);

        try {
          const result = (this.agent as any).tryGenerateSQLFromTemplate(
            testCase.question,
            schemas,
            config.type,
            [],
            false
          );

          const matched = result !== null;
          const actualPattern = this.extractPattern(result?.sql, matched);
          const isCorrect = testCase.shouldMatch === matched &&
            (!testCase.shouldMatch || actualPattern?.includes(testCase.expectedPattern) || false);

          // 分类统计
          const cat = byCategory.get(testCase.category) || { total: 0, correct: 0 };
          cat.total++;
          if (isCorrect) {
            cat.correct++;
            correct++;
          }
          byCategory.set(testCase.category, cat);

          if (!isCorrect) {
            failedCases.push({
              question: testCase.question,
              expected: testCase.expectedPattern,
              actual: actualPattern || '未匹配',
              category: testCase.category
            });
          }
        } catch (e) {
          const cat = byCategory.get(testCase.category) || { total: 0, correct: 0 };
          cat.total++;
          byCategory.set(testCase.category, cat);
          
          failedCases.push({
            question: testCase.question,
            expected: testCase.expectedPattern,
            actual: 'Error',
            category: testCase.category
          });
        }
      }

      this.currentTask.message = '正在生成报告...';

      // 5. 生成报告
      const result: TestResult = {
        datasourceId,
        timestamp: new Date().toISOString(),
        total: testCases.length,
        correct,
        accuracy: correct / testCases.length,
        byCategory: Array.from(byCategory).map(([category, stats]) => ({
          category,
          total: stats.total,
          correct: stats.correct,
          accuracy: stats.total > 0 ? stats.correct / stats.total : 0
        })),
        failedCases: failedCases.slice(0, 50), // 只保留前50个失败案例
        duration: Date.now() - startTime
      };

      // 6. 保存报告
      if (options.saveReport !== false) {
        await this.saveReport(result);
      }

      this.currentTask = { isRunning: false };
      return result;
    } catch (error) {
      this.currentTask = { isRunning: false };
      throw error;
    }
  }

  /**
   * 快速测试单个问题
   */
  async quickTest(datasourceId: string, question: string): Promise<{
    question: string;
    matched: boolean;
    pattern: string | null;
    sql: string | null;
    duration: number;
  }> {
    const startTime = Date.now();
    
    const config = await this.configStore.getById(datasourceId);
    if (!config) {
      throw new Error(`数据源 ${datasourceId} 不存在`);
    }

    const dataSource = createDataSource(config);
    const schemas = await dataSource.getSchema();

    const result = (this.agent as any).tryGenerateSQLFromTemplate(
      question,
      schemas,
      config.type,
      [],
      false
    );

    const matched = result !== null;
    const pattern = this.extractPattern(result?.sql, matched);

    return {
      question,
      matched,
      pattern,
      sql: result?.sql || null,
      duration: Date.now() - startTime
    };
  }

  /**
   * 运行自动优化
   */
  async runOptimization(
    datasourceId: string, 
    options: OptimizationOptions
  ): Promise<OptimizationResult> {
    this.currentTask = {
      isRunning: true,
      currentTask: 'optimize',
      message: '开始自动优化...'
    };

    try {
      // 1. 先运行测试获取基线
      this.currentTask.message = '获取基线测试结果...';
      const baseline = await this.runTest(datasourceId, { quick: true });
      
      let currentAccuracy = baseline.accuracy;
      const improvements: string[] = [];
      let iterations = 0;

      // 2. 迭代优化
      for (let i = 0; i < options.maxIterations; i++) {
        iterations = i + 1;
        this.currentTask.message = `第 ${iterations}/${options.maxIterations} 轮优化...`;
        this.currentTask.progress = Math.round((i / options.maxIterations) * 100);

        // 如果已达到目标，停止
        if (currentAccuracy >= options.targetAccuracy) {
          improvements.push(`第${iterations}轮达到目标准确率 ${(currentAccuracy * 100).toFixed(1)}%`);
          break;
        }

        // 运行测试获取失败案例
        const testResult = await this.runTest(datasourceId, { quick: true });
        
        if (testResult.accuracy > currentAccuracy) {
          improvements.push(`第${iterations}轮准确率提升至 ${(testResult.accuracy * 100).toFixed(1)}%`);
          currentAccuracy = testResult.accuracy;
        }

        // 这里可以调用AI分析失败案例并建议优化
        // 暂时记录失败案例供人工分析
        if (testResult.failedCases.length > 0) {
          improvements.push(`第${iterations}轮发现 ${testResult.failedCases.length} 个失败案例`);
        }
      }

      this.currentTask = { isRunning: false };

      return {
        datasourceId,
        timestamp: new Date().toISOString(),
        iterations,
        finalAccuracy: currentAccuracy,
        improvements,
        status: currentAccuracy >= options.targetAccuracy ? 'success' : 
                (currentAccuracy > baseline.accuracy ? 'partial' : 'failed')
      };
    } catch (error) {
      this.currentTask = { isRunning: false };
      throw error;
    }
  }

  /**
   * 获取任务状态
   */
  async getStatus(): Promise<TaskStatus> {
    return this.currentTask;
  }

  /**
   * 获取所有报告
   */
  async getReports(): Promise<{ id: string; timestamp: string; datasourceId: string; accuracy: number }[]> {
    const reportsDir = this.getReportsDir();
    if (!fs.existsSync(reportsDir)) {
      return [];
    }

    const files = fs.readdirSync(reportsDir)
      .filter(f => f.startsWith('template-test-') && f.endsWith('.json'))
      .map(f => {
        const content = fs.readFileSync(path.join(reportsDir, f), 'utf-8');
        const data = JSON.parse(content);
        return {
          id: f.replace('template-test-', '').replace('.json', ''),
          timestamp: data.timestamp,
          datasourceId: data.datasourceId,
          accuracy: data.accuracy || 0
        };
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return files;
  }

  /**
   * 获取单个报告
   */
  async getReport(reportId: string): Promise<TestResult | null> {
    const reportPath = path.join(this.getReportsDir(), `template-test-${reportId}.json`);
    if (!fs.existsSync(reportPath)) {
      return null;
    }

    const content = fs.readFileSync(reportPath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * 生成测试用例
   */
  private generateTestCases(schemas: any[], options: TestOptions): {
    question: string;
    expectedPattern: string;
    shouldMatch: boolean;
    category: string;
  }[] {
    const allColumns = schemas.flatMap((s: any) => s.columns || []);
    const testCases: any[] = [];

    // 识别字段类型
    const dimensions = allColumns.filter((c: any) => 
      /发明人|申请人|类型|分类|人|名称|公司|机构/i.test(c.name)
    );
    const metrics = allColumns.filter((c: any) => {
      const t = c.type?.toLowerCase() || '';
      return t.includes('int') || t.includes('decimal') || /次数|数量/i.test(c.name);
    });
    const yearFields = allColumns.filter((c: any) => /年|year/i.test(c.name));

    // 快速测试模式：只生成少量用例
    const limit = options.quick ? 10 : 50;

    // 产出统计类
    for (const dim of dimensions.slice(0, 2)) {
      testCases.push({
        question: `哪些${dim.name}的产出最高？`,
        expectedPattern: 'TOP-N-GROUP',
        shouldMatch: true,
        category: '产出统计'
      });
    }

    // 时间窗口类
    if (yearFields.length > 0) {
      for (const dim of dimensions.slice(0, 1)) {
        testCases.push({
          question: `近5年${dim.name}的产出情况`,
          expectedPattern: 'TOP-N-GROUP',
          shouldMatch: true,
          category: '时间窗口'
        });
      }
    }

    // 极值查询类
    for (const metric of metrics.slice(0, 2)) {
      testCases.push({
        question: `${metric.name}最高的是多少？`,
        expectedPattern: 'EXTREME',
        shouldMatch: true,
        category: '极值查询'
      });
    }

    // 排名查询类
    for (const metric of metrics.slice(0, 1)) {
      testCases.push({
        question: `哪些记录的${metric.name}最高？`,
        expectedPattern: 'TOP-N',
        shouldMatch: true,
        category: '排名查询'
      });
    }

    // 平均值类
    for (const metric of metrics.slice(0, 1)) {
      testCases.push({
        question: `平均${metric.name}是多少？`,
        expectedPattern: 'AVG',
        shouldMatch: true,
        category: '平均值统计'
      });
    }

    // 总数统计
    testCases.push({
      question: '总共有多少条数据？',
      expectedPattern: 'COUNT',
      shouldMatch: true,
      category: '总数统计'
    });

    // 复杂分析（不应匹配）
    testCases.push({
      question: '帮我分析一下数据特征',
      expectedPattern: 'LLM',
      shouldMatch: false,
      category: '复杂分析'
    });

    return testCases.slice(0, limit);
  }

  /**
   * 提取匹配的模式
   */
  private extractPattern(sql: string | null, matched: boolean): string | null {
    if (!matched || !sql) return null;
    if (sql.includes('COUNT(1)') && sql.includes('GROUP BY')) {
      if (sql.includes('WHERE') && sql.includes('YEAR')) return 'TOP-N-GROUP-时间窗口';
      return 'TOP-N-GROUP';
    }
    if (sql.includes('ORDER BY') && sql.includes('DESC') && sql.includes('LIMIT')) return 'TOP-N';
    if (sql.includes('MAX(') || sql.includes('MIN(')) return 'EXTREME';
    if (sql.includes('COUNT(1)') && !sql.includes('GROUP BY')) return 'COUNT';
    if (sql.includes('AVG(')) return 'AVG';
    return 'OTHER';
  }

  /**
   * 保存报告
   */
  private async saveReport(result: TestResult): Promise<void> {
    const reportsDir = this.getReportsDir();
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(reportsDir, `template-test-${timestamp}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(result, null, 2));
  }

  /**
   * 获取报告目录
   */
  private getReportsDir(): string {
    return path.join(process.cwd(), 'reports', 'template-optimizer');
  }
}
