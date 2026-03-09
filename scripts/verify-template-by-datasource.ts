/**
 * 多数据源模板验证工具
 * 为每个数据源读取真实表结构，生成针对性测试问题，验证模板匹配准确性
 *
 * 使用方法:
 *   npx tsx scripts/verify-template-by-datasource.ts <datasourceId>
 *   npx tsx scripts/verify-template-by-datasource.ts --all  # 验证所有数据源
 *
 * 输出:
 *   - 控制台: 实时测试进度和汇总报告
 *   - 文件: reports/template-verify-{datasourceId}.json
 */

import { AIAgent } from '../src/agent/index.js';
import { createDataSource } from '../src/datasource/index.js';
import { ConfigStore } from '../src/store/configStore.js';
import { DataSourceConfig } from '../src/types/index.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

interface FieldInfo {
  name: string;
  type: string;
  comment?: string;
  isNumeric: boolean;
  isDate: boolean;
  isYear: boolean;
  isDimension: boolean;
  isMetric: boolean;
}

interface DatasourceSchema {
  datasourceId: string;
  datasourceName: string;
  dbType: string;
  tables: {
    tableName: string;
    columns: FieldInfo[];
  }[];
}

interface TestCase {
  question: string;
  expectedPattern: string;
  shouldMatch: boolean;
  category: string;
  notes?: string;
}

interface TestResult {
  question: string;
  matched: boolean;
  pattern: string | null;
  sql: string | null;
  expectedPattern: string;
  isCorrect: boolean;
  category: string;
  notes?: string;
}

interface VerifyReport {
  timestamp: string;
  datasourceId: string;
  datasourceName: string;
  dbType: string;
  summary: {
    totalFields: number;
    dimensionFields: number;
    metricFields: number;
    timeFields: number;
    totalTests: number;
    correctTests: number;
    accuracy: string;
    matchedCount: number;
    unmatchedCount: number;
  };
  byCategory: {
    category: string;
    total: number;
    correct: number;
    accuracy: string;
    patterns: string[];
  }[];
  failedCases: {
    question: string;
    category: string;
    expected: string;
    actual: string | null;
    notes?: string;
  }[];
  generatedSQL: {
    question: string;
    sql: string;
    pattern: string;
  }[];
}

/**
 * 获取所有数据源配置
 */
async function getAllDatasources(): Promise<DataSourceConfig[]> {
  const configStore = new ConfigStore();
  try {
    return await configStore.getAll();
  } catch (error) {
    console.error('获取数据源列表失败:', error);
    return [];
  }
}

/**
 * 获取单个数据源配置
 */
async function getDatasourceConfig(id: string): Promise<DataSourceConfig | null> {
  const configStore = new ConfigStore();
  try {
    return await configStore.getById(id);
  } catch (error) {
    console.error(`获取数据源 ${id} 配置失败:`, error);
    return null;
  }
}

/**
 * 读取数据源表结构
 */
async function readDatasourceSchema(datasourceId: string, config: DataSourceConfig): Promise<DatasourceSchema | null> {
  console.log(`\n正在读取数据源 ${datasourceId} 的表结构...`);

  try {
    const dataSource = createDataSource(config);
    const schemas = await dataSource.getSchema();

    if (!schemas || schemas.length === 0) {
      console.log(`  ⚠️ 数据源 ${datasourceId} 没有表结构信息`);
      return null;
    }

    // 分析字段类型
    const analyzeField = (col: any): FieldInfo => {
      const type = col.type.toLowerCase();
      const name = col.name.toLowerCase();
      const comment = (col.comment || '').toLowerCase();

      const isNumeric = type.includes('int') || type.includes('decimal') ||
                       type.includes('float') || type.includes('double') ||
                       type.includes('number') || /次数|数量|金额|费用/i.test(name);
      const isDate = /date|time/i.test(type) || /日|时间/i.test(name);
      const isYear = /年|year/i.test(name);
      const isDimension = /发明人|申请人|类型|分类|人|名称|公司|机构|地区|省|市|国|状态/i.test(name);
      const isMetric = isNumeric || /被引|引用|金额|费用|成本|收益/i.test(name);

      return {
        name: col.name,
        type: col.type,
        comment: col.comment,
        isNumeric,
        isDate,
        isYear,
        isDimension,
        isMetric,
      };
    };

    const result: DatasourceSchema = {
      datasourceId,
      datasourceName: dataSource.config.name,
      dbType: dataSource.config.type,
      tables: schemas.map(s => ({
        tableName: s.tableName,
        columns: s.columns.map(analyzeField),
      })),
    };

    // 打印表结构概览
    console.log(`  ✓ 读取成功: ${result.tables.length} 张表`);
    const allFields = result.tables.flatMap(t => t.columns);
    console.log(`    - 维度字段: ${allFields.filter(f => f.isDimension).length}`);
    console.log(`    - 指标字段: ${allFields.filter(f => f.isMetric).length}`);
    console.log(`    - 时间字段: ${allFields.filter(f => f.isYear || f.isDate).length}`);

    return result;
  } catch (error) {
    console.error(`  ✗ 读取数据源 ${datasourceId} 失败:`, error);
    return null;
  }
}

/**
 * 基于真实表结构生成测试问题
 */
function generateTestsBySchema(schema: DatasourceSchema): TestCase[] {
  const tests: TestCase[] = [];
  const allFields = schema.tables.flatMap(t => t.columns);

  const dimensions = allFields.filter(f => f.isDimension);
  const metrics = allFields.filter(f => f.isMetric);
  const yearFields = allFields.filter(f => f.isYear);
  const dateFields = allFields.filter(f => f.isDate && !f.isYear);

  // 1. 产出统计类 (基于实际维度字段)
  const outputKeywords = ['数量', '产出', '分布', '统计'];
  for (const dim of dimensions.slice(0, 3)) {
    for (const keyword of outputKeywords) {
      tests.push({
        question: `哪些${dim.name}的${keyword}最高？`,
        expectedPattern: 'TOP-N-GROUP',
        shouldMatch: true,
        category: '产出统计',
        notes: `维度:${dim.name}`
      });
      tests.push({
        question: `${dim.name}${keyword}分布`,
        expectedPattern: 'TOP-N-GROUP',
        shouldMatch: true,
        category: '产出统计',
        notes: `维度:${dim.name}`
      });
    }
  }

  // 2. 时间窗口类 (基于实际时间字段)
  if (yearFields.length > 0) {
    const yearField = yearFields[0].name;
    for (const dim of dimensions.slice(0, 2)) {
      tests.push({
        question: `近5年${dim.name}的产出情况`,
        expectedPattern: 'TOP-N-GROUP',
        shouldMatch: true,
        category: '时间窗口',
        notes: `时间:${yearField}, 维度:${dim.name}`
      });
      tests.push({
        question: `近3年${dim.name}分布`,
        expectedPattern: 'TOP-N-GROUP',
        shouldMatch: true,
        category: '时间窗口',
        notes: `时间:${yearField}, 维度:${dim.name}`
      });
    }

    // 趋势类问题
    tests.push({
      question: '近5年趋势如何？',
      expectedPattern: 'TREND',
      shouldMatch: true,
      category: '趋势分析',
      notes: `时间:${yearField}`
    });
  }

  // 3. 极值查询类 (基于实际指标字段)
  for (const metric of metrics.slice(0, 3)) {
    tests.push({
      question: `${metric.name}最高的是多少？`,
      expectedPattern: 'EXTREME',
      shouldMatch: true,
      category: '极值查询',
      notes: `指标:${metric.name}`
    });
    tests.push({
      question: `${metric.name}最小值是多少？`,
      expectedPattern: 'EXTREME',
      shouldMatch: true,
      category: '极值查询',
      notes: `指标:${metric.name}`
    });

    // 排名类问题
    tests.push({
      question: `哪些记录的${metric.name}最高？`,
      expectedPattern: 'TOP-N',
      shouldMatch: true,
      category: '排名查询',
      notes: `指标:${metric.name}`
    });

    // 平均值类问题
    tests.push({
      question: `平均${metric.name}是多少？`,
      expectedPattern: 'AVG',
      shouldMatch: true,
      category: '平均值统计',
      notes: `指标:${metric.name}`
    });
  }

  // 4. 日期差类问题 (需要至少2个日期字段)
  if (dateFields.length >= 2) {
    tests.push({
      question: '平均审查周期是多少天？',
      expectedPattern: 'AVG_DURATION',
      shouldMatch: true,
      category: '平均值统计',
      notes: '日期差平均'
    });
    tests.push({
      question: '最长审查周期是多少天？',
      expectedPattern: 'EXTREME_DURATION',
      shouldMatch: true,
      category: '极值查询',
      notes: '日期差极值'
    });
  }

  // 5. 总数统计类
  tests.push({
    question: '总共有多少条数据？',
    expectedPattern: 'COUNT',
    shouldMatch: true,
    category: '总数统计',
    notes: '总数查询'
  });
  tests.push({
    question: '一共有多少条记录？',
    expectedPattern: 'COUNT',
    shouldMatch: true,
    category: '总数统计',
    notes: '总数查询'
  });

  // 6. 限制查询类
  tests.push({
    question: '展示前10条数据',
    expectedPattern: 'LIMIT',
    shouldMatch: true,
    category: '限制查询',
    notes: 'LIMIT查询'
  });

  // 7. 复杂分析类 (应该走LLM)
  tests.push({
    question: '帮我分析一下数据分布特征',
    expectedPattern: 'LLM',
    shouldMatch: false,
    category: '复杂分析',
    notes: '复杂分析，不应匹配模板'
  });
  tests.push({
    question: '生成一份数据分析报告',
    expectedPattern: 'LLM',
    shouldMatch: false,
    category: '复杂分析',
    notes: '报告生成'
  });

  return tests;
}

/**
 * 提取匹配的模式类型
 */
function extractPattern(sql: string | null, matched: boolean): string {
  if (!matched || !sql) return '未匹配';
  if (sql.includes('COUNT(1)') && sql.includes('GROUP BY')) {
    if (sql.includes('WHERE') && sql.includes('YEAR')) return 'TOP-N-GROUP-时间窗口';
    return 'TOP-N-GROUP';
  }
  if (sql.includes('ORDER BY') && sql.includes('DESC') && sql.includes('LIMIT')) return 'TOP-N';
  if (sql.includes('MAX(') || sql.includes('MIN(')) {
    if (sql.includes('DATEDIFF')) return 'EXTREME_DURATION';
    return 'EXTREME';
  }
  if (sql.includes('COUNT(1)') && !sql.includes('GROUP BY')) return 'COUNT';
  if (sql.includes('SUM(')) return 'SUM';
  if (sql.includes('AVG(')) {
    if (sql.includes('DATEDIFF')) return 'AVG_DURATION';
    return 'AVG';
  }
  if (sql.includes('LIMIT') && !sql.includes('ORDER BY')) return 'LIMIT';
  return 'OTHER';
}

/**
 * 运行模板验证
 */
async function verifyDatasource(datasourceId: string): Promise<VerifyReport | null> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`数据源模板验证: ${datasourceId}`);
  console.log('='.repeat(80));

  // 1. 读取数据源配置
  const config = await getDatasourceConfig(datasourceId);
  if (!config) {
    console.log(`✗ 找不到数据源配置: ${datasourceId}`);
    return null;
  }

  // 2. 读取表结构
  const schema = await readDatasourceSchema(datasourceId, config);
  if (!schema) return null;

  // 2. 生成测试问题
  const testCases = generateTestsBySchema(schema);
  console.log(`\n生成 ${testCases.length} 个测试问题`);

  // 3. 运行测试
  const results: TestResult[] = [];
  const categories = new Map<string, { total: number; correct: number; patterns: Set<string> }>();

  const agent = new AIAgent();
  const schemaForAgent = schema.tables.map(t => ({
    tableName: t.tableName,
    columns: t.columns.map(c => ({
      name: c.name,
      type: c.type,
      comment: c.comment,
    })),
  }));

  console.log('\n开始测试...\n');

  for (let i = 0; i < testCases.length; i++) {
    const test = testCases[i];
    process.stdout.write(`[${String(i + 1).padStart(2, '0')}/${testCases.length}] ${test.question.substring(0, 40)}... `);

    try {
      const result = (agent as any).tryGenerateSQLFromTemplate(
        test.question,
        schemaForAgent,
        schema.dbType,
        [],
        false
      );

      const matched = result !== null;
      const pattern = extractPattern(result?.sql || null, matched);
      const isCorrect = test.shouldMatch === matched &&
        (!test.shouldMatch || pattern?.includes(test.expectedPattern) || false);

      results.push({
        question: test.question,
        matched,
        pattern,
        sql: result?.sql || null,
        expectedPattern: test.expectedPattern,
        isCorrect,
        category: test.category,
        notes: test.notes,
      });

      // 统计
      const cat = categories.get(test.category) || { total: 0, correct: 0, patterns: new Set() };
      cat.total++;
      if (isCorrect) cat.correct++;
      cat.patterns.add(pattern);
      categories.set(test.category, cat);

      console.log(`${isCorrect ? '✓' : '✗'} ${pattern}`);
    } catch (error) {
      console.log(`✗ Error`);
      results.push({
        question: test.question,
        matched: false,
        pattern: 'Error',
        sql: null,
        expectedPattern: test.expectedPattern,
        isCorrect: false,
        category: test.category,
        notes: `Error: ${error}`,
      });
    }
  }

  // 4. 生成报告
  const allFields = schema.tables.flatMap(t => t.columns);
  const correctCount = results.filter(r => r.isCorrect).length;

  const report: VerifyReport = {
    timestamp: new Date().toISOString(),
    datasourceId,
    datasourceName: config.name,
    dbType: config.type,
    summary: {
      totalFields: allFields.length,
      dimensionFields: allFields.filter(f => f.isDimension).length,
      metricFields: allFields.filter(f => f.isMetric).length,
      timeFields: allFields.filter(f => f.isYear || f.isDate).length,
      totalTests: results.length,
      correctTests: correctCount,
      accuracy: `${(correctCount / results.length * 100).toFixed(1)}%`,
      matchedCount: results.filter(r => r.matched).length,
      unmatchedCount: results.filter(r => !r.matched).length,
    },
    byCategory: Array.from(categories).map(([name, stats]) => ({
      category: name,
      total: stats.total,
      correct: stats.correct,
      accuracy: `${(stats.correct / stats.total * 100).toFixed(1)}%`,
      patterns: Array.from(stats.patterns),
    })),
    failedCases: results.filter(r => !r.isCorrect).map(r => ({
      question: r.question,
      category: r.category,
      expected: r.expectedPattern,
      actual: r.pattern,
      notes: r.notes,
    })),
    generatedSQL: results.filter(r => r.sql).map(r => ({
      question: r.question,
      sql: r.sql!,
      pattern: r.pattern!,
    })),
  };

  // 5. 输出汇总
  console.log('\n' + '='.repeat(80));
  console.log('验证结果汇总');
  console.log('='.repeat(80));
  console.log(`数据源: ${config.name} (${datasourceId})`);
  console.log(`数据库类型: ${config.type}`);
  console.log(`表数量: ${schema.tables.length}`);
  console.log(`\n字段统计:`);
  console.log(`  - 总字段数: ${report.summary.totalFields}`);
  console.log(`  - 维度字段: ${report.summary.dimensionFields}`);
  console.log(`  - 指标字段: ${report.summary.metricFields}`);
  console.log(`  - 时间字段: ${report.summary.timeFields}`);
  console.log(`\n测试结果:`);
  console.log(`  - 总测试数: ${report.summary.totalTests}`);
  console.log(`  - 正确匹配: ${report.summary.correctTests} (${report.summary.accuracy})`);
  console.log(`  - 成功匹配: ${report.summary.matchedCount}`);
  console.log(`  - 未匹配: ${report.summary.unmatchedCount}`);

  console.log(`\n按类别统计:`);
  report.byCategory.forEach(cat => {
    console.log(`  ${cat.category}: ${cat.correct}/${cat.total} (${cat.accuracy})`);
  });

  if (report.failedCases.length > 0) {
    console.log(`\n失败案例 (${report.failedCases.length}个):`);
    report.failedCases.slice(0, 5).forEach(c => {
      console.log(`  - ${c.question}`);
      console.log(`    期望: ${c.expected}, 实际: ${c.actual}`);
    });
  }

  // 6. 保存报告
  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir);
  }

  const reportPath = path.join(reportsDir, `template-verify-${datasourceId}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n详细报告已保存: ${reportPath}`);

  return report;
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const isAll = args.includes('--all');
  const datasourceId = args.find(a => !a.startsWith('--'));

  console.log('数据源模板验证工具');
  console.log('='.repeat(80));

  if (isAll) {
    // 验证所有数据源
    console.log('\n获取所有数据源...');
    const datasources = await getAllDatasources();

    if (datasources.length === 0) {
      console.log('没有找到数据源配置');
      console.log('\n请确保:');
      console.log('1. 数据库连接配置正确');
      console.log('2. 至少配置了一个数据源');
      return;
    }

    console.log(`\n找到 ${datasources.length} 个数据源:`);
    datasources.forEach(ds => {
      console.log(`  - ${ds.id}: ${ds.name} (${ds.type})`);
    });

    const reports: VerifyReport[] = [];
    for (const ds of datasources) {
      const report = await verifyDatasource(ds.id);
      if (report) reports.push(report);
    }

    // 输出总体汇总
    console.log('\n' + '='.repeat(80));
    console.log('总体验证汇总');
    console.log('='.repeat(80));
    console.log(`验证数据源数: ${reports.length}/${datasources.length}`);
    console.log(`总测试数: ${reports.reduce((s, r) => s + r.summary.totalTests, 0)}`);
    console.log(`总正确数: ${reports.reduce((s, r) => s + r.summary.correctTests, 0)}`);

    const totalAcc = reports.reduce((s, r) => s + parseFloat(r.summary.accuracy), 0) / reports.length;
    console.log(`平均准确率: ${totalAcc.toFixed(1)}%`);

  } else if (datasourceId) {
    // 验证单个数据源
    await verifyDatasource(datasourceId);
  } else {
    // 显示帮助
    console.log('\n使用方法:');
    console.log('  npx tsx scripts/verify-template-by-datasource.ts <datasourceId>');
    console.log('  npx tsx scripts/verify-template-by-datasource.ts --all');
    console.log('\n示例:');
    console.log('  npx tsx scripts/verify-template-by-datasource.ts patent_data');
    console.log('  npx tsx scripts/verify-template-by-datasource.ts --all');
  }
}

main().catch(console.error);
