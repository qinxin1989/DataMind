/**
 * 大规模本地模板匹配测试脚本
 * 基于表结构智能组合生成100+符合业务逻辑的测试问题
 * 逐一测试验证模板匹配准确性
 *
 * 运行: npx tsx scripts/template-mass-test.ts
 */

import { AIAgent } from '../src/agent/index.js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

interface TestCase {
  question: string;
  expectedPattern: string;
  shouldMatch: boolean;
  category: string;
  subCategory: string;
  notes?: string;
}

interface TestResult {
  question: string;
  matched: boolean;
  pattern: string | null;
  sql: string | null;
  expectedPattern: string;
  shouldMatch: boolean;
  isCorrect: boolean;
  category: string;
  subCategory: string;
  notes?: string;
}

interface SchemaInfo {
  tableName: string;
  columns: {
    name: string;
    type: string;
    comment?: string;
    category?: 'dimension' | 'metric' | 'time' | 'date' | 'other';
  }[];
}

/**
 * 分析字段类别
 */
function categorizeColumns(columns: any[]): any[] {
  return columns.map(c => {
    const name = c.name.toLowerCase();
    const comment = (c.comment || '').toLowerCase();
    const type = c.type.toLowerCase();
    const text = `${name} ${comment}`;

    // 时间维度字段
    if (/年|year/i.test(name)) {
      return { ...c, category: 'time' };
    }
    // 日期字段
    if (/日|date|时间|time/i.test(name) && !/年/i.test(name)) {
      return { ...c, category: 'date' };
    }
    // 维度字段（可用于分组）
    if (/发明人|申请人|类型|分类|人|名称|公司|机构|地址|省|市|国/i.test(name)) {
      return { ...c, category: 'dimension' };
    }
    // 指标字段（数值型）
    if (type.includes('int') || type.includes('decimal') || type.includes('float') ||
        /次数|数量|被引|引用|金额|费用/i.test(name)) {
      return { ...c, category: 'metric' };
    }

    return { ...c, category: 'other' };
  });
}

/**
 * 智能组合生成测试问题
 */
function generateMassiveQuestions(schema: SchemaInfo[]): TestCase[] {
  const questions: TestCase[] = [];
  const allColumns = categorizeColumns(schema.flatMap(s => s.columns));
  const tableName = schema[0]?.tableName || 'data';

  const dimensions = allColumns.filter(c => c.category === 'dimension');
  const metrics = allColumns.filter(c => c.category === 'metric');
  const timeFields = allColumns.filter(c => c.category === 'time');
  const dateFields = allColumns.filter(c => c.category === 'date');

  console.log(`字段分析：维度${dimensions.length}个，指标${metrics.length}个，时间${timeFields.length}个，日期${dateFields.length}个`);

  // ========== 1. 产出统计类 (25个) ==========
  const outputVerbs = ['产出', '产量', '发文', '发表', '数量', '件数', '申请量', '授权量'];
  const outputPatterns = [
    { template: '哪些{}的专利{}最高？', type: 'TOP-N-GROUP', sub: '产出排名' },
    { template: '{}的专利{}分布', type: 'TOP-N-GROUP', sub: '分布统计' },
    { template: '按{}统计专利{}', type: 'TOP-N-GROUP', sub: '分组统计' },
    { template: '各{}的{}情况', type: 'TOP-N-GROUP', sub: '分组统计' },
    { template: '{}{}排名前10', type: 'TOP-N-GROUP', sub: '排名统计' },
  ];

  for (const dim of dimensions.slice(0, 3)) {
    for (const verb of outputVerbs.slice(0, 2)) {
      for (const pattern of outputPatterns) {
        questions.push({
          question: pattern.template.replace('{}', dim.name).replace('{}', verb),
          expectedPattern: pattern.type,
          shouldMatch: true,
          category: '产出统计',
          subCategory: pattern.sub,
          notes: `维度:${dim.name}, 指标:${verb}`
        });
      }
    }
  }

  // ========== 2. 时间窗口类 (20个) ==========
  if (timeFields.length > 0) {
    const timeWindows = ['近3年', '近5年', '近10年', '2020年以来', '2020-2023年'];
    const timePatterns = [
      { template: '{}哪些{}的专利产出最高？', type: 'TOP-N-GROUP', sub: '带时间窗口的产出' },
      { template: '{}{}的专利分布', type: 'TOP-N-GROUP', sub: '带时间窗口的分布' },
      { template: '{}的{}趋势如何？', type: 'TREND', sub: '时间趋势' },
      { template: '{}专利申请情况', type: 'TREND', sub: '时间统计' },
    ];

    for (const window of timeWindows) {
      for (const dim of dimensions.slice(0, 2)) {
        for (const pattern of timePatterns) {
          questions.push({
            question: pattern.template.replace('{}', window).replace('{}', dim.name),
            expectedPattern: pattern.type,
            shouldMatch: true,
            category: '时间窗口',
            subCategory: pattern.sub,
            notes: `时间窗口:${window}, 维度:${dim.name}`
          });
        }
      }
    }
  }

  // ========== 3. 极值查询类 (20个) ==========
  const extremePatterns = [
    { template: '{}最大/最高的是多少？', sub: '最大值' },
    { template: '{}最小/最低的是多少？', sub: '最小值' },
    { template: '{}最大值是多少？', sub: '明确最大值' },
    { template: '{}最小值是多少？', sub: '明确最小值' },
  ];

  for (const metric of metrics.slice(0, 3)) {
    for (const pattern of extremePatterns) {
      questions.push({
        question: pattern.template.replace('{}', metric.name),
        expectedPattern: 'EXTREME',
        shouldMatch: true,
        category: '极值查询',
        subCategory: pattern.sub,
        notes: `指标:${metric.name}`
      });
    }
  }

  // 日期差极值
  if (dateFields.length >= 2) {
    const dateExtremePatterns = [
      { template: '最长{}是多少天？', sub: '日期差最大' },
      { template: '最短{}是多少天？', sub: '日期差最小' },
      { template: '最大{}周期是多少？', sub: '周期最大' },
      { template: '最小{}周期是多少？', sub: '周期最小' },
    ];
    const cycleNames = ['审查', '授权', '公开', '申请'];
    for (const cycle of cycleNames) {
      for (const pattern of dateExtremePatterns.slice(0, 2)) {
        questions.push({
          question: pattern.template.replace('{}', cycle),
          expectedPattern: 'EXTREME_DURATION',
          shouldMatch: true,
          category: '极值查询',
          subCategory: pattern.sub,
          notes: `周期:${cycle}`
        });
      }
    }
  }

  // ========== 4. 排名查询类 (15个) ==========
  const rankPatterns = [
    { template: '哪些专利的{}最高？', sub: '排名' },
    { template: '{}排名前10的专利', sub: '明确排名' },
    { template: '{}最高的前20条', sub: 'TOP-N' },
    { template: '按{}排序前15', sub: '排序排名' },
  ];

  for (const metric of metrics.slice(0, 3)) {
    for (const pattern of rankPatterns) {
      questions.push({
        question: pattern.template.replace('{}', metric.name),
        expectedPattern: 'TOP-N',
        shouldMatch: true,
        category: '排名查询',
        subCategory: pattern.sub,
        notes: `指标:${metric.name}`
      });
    }
  }

  // ========== 5. 平均值统计类 (15个) ==========
  const avgPatterns = [
    { template: '平均{}是多少？', sub: '简单平均' },
    { template: '{}的平均值', sub: '平均值' },
    { template: '{}均值是多少？', sub: '均值' },
  ];

  for (const metric of metrics.slice(0, 3)) {
    for (const pattern of avgPatterns) {
      questions.push({
        question: pattern.template.replace('{}', metric.name),
        expectedPattern: 'AVG',
        shouldMatch: true,
        category: '平均值统计',
        subCategory: pattern.sub,
        notes: `指标:${metric.name}`
      });
    }
  }

  // 日期差平均
  if (dateFields.length >= 2) {
    const avgDurationPatterns = [
      { template: '平均{}周期是多少天？', sub: '周期平均' },
      { template: '平均{}时长是多少？', sub: '时长平均' },
      { template: '{}平均耗时多久？', sub: '耗时平均' },
    ];
    const cycleNames = ['审查', '授权', '公开'];
    for (const cycle of cycleNames) {
      for (const pattern of avgDurationPatterns) {
        questions.push({
          question: pattern.template.replace('{}', cycle),
          expectedPattern: 'AVG_DURATION',
          shouldMatch: true,
          category: '平均值统计',
          subCategory: pattern.sub,
          notes: `周期:${cycle}`
        });
      }
    }
  }

  // ========== 6. 总数统计类 (10个) ==========
  const countPatterns = [
    { template: '总共有多少{}？', sub: '总数' },
    { template: '一共有多少{}？', sub: '总数' },
    { template: '{}总量是多少？', sub: '总量' },
    { template: '数据{}有多少？', sub: '数据量' },
  ];
  const countTargets = ['条', '条数据', '条记录', '个专利'];
  for (const target of countTargets) {
    for (const pattern of countPatterns) {
      questions.push({
        question: pattern.template.replace('{}', target),
        expectedPattern: 'COUNT',
        shouldMatch: true,
        category: '总数统计',
        subCategory: pattern.sub,
        notes: '总数查询'
      });
    }
  }

  // ========== 7. 总和统计类 (10个) ==========
  const sumPatterns = [
    { template: '{}总计是多少？', sub: '总和' },
    { template: '一共多少{}？', sub: '合计' },
    { template: '{}总和是多少？', sub: '总和' },
  ];
  for (const metric of metrics.filter(m => /费|金额|数量|次数/i.test(m.name)).slice(0, 2)) {
    for (const pattern of sumPatterns) {
      questions.push({
        question: pattern.template.replace('{}', metric.name),
        expectedPattern: 'SUM',
        shouldMatch: true,
        category: '总和统计',
        subCategory: pattern.sub,
        notes: `指标:${metric.name}`
      });
    }
  }

  // ========== 8. 去重查询类 (5个) ==========
  for (const dim of dimensions.slice(0, 2)) {
    questions.push({
      question: `有多少不同的${dim.name}？`,
      expectedPattern: 'DISTINCT',
      shouldMatch: true,
      category: '去重查询',
      subCategory: '唯一值计数',
      notes: `维度:${dim.name}`
    });
  }

  // ========== 9. 限制查询类 (5个) ==========
  const limitPatterns = [
    '展示前10条数据',
    '查看前20条记录',
    '列出前50个',
    '显示前100条',
    '取前5条看看',
  ];
  for (const q of limitPatterns) {
    questions.push({
      question: q,
      expectedPattern: 'LIMIT',
      shouldMatch: true,
      category: '限制查询',
      subCategory: 'LIMIT查询',
      notes: '限制条数'
    });
  }

  // ========== 10. 存在性查询类 (5个) ==========
  const existPatterns = [
    { template: '是否有{}？', sub: '存在性' },
    { template: '是否存在{}？', sub: '存在性' },
    { template: '有没有{}的数据？', sub: '存在性' },
  ];
  for (const dim of dimensions.slice(0, 2)) {
    for (const pattern of existPatterns) {
      questions.push({
        question: pattern.template.replace('{}', dim.name),
        expectedPattern: 'EXISTS',
        shouldMatch: true,
        category: '存在性查询',
        subCategory: pattern.sub,
        notes: `维度:${dim.name}`
      });
    }
  }

  // ========== 11. 复杂分析类 (15个) - 应该走LLM ==========
  const complexQuestions = [
    { q: '分析一下各技术领域的发展情况', sub: '领域分析' },
    { q: '帮我生成一份专利分析报告', sub: '报告生成' },
    { q: '各发明人的技术领域分布情况', sub: '多维度分析' },
    { q: '专利申请的地域分布特征', sub: '地域分析' },
    { q: '不同类型专利的被引证情况对比', sub: '对比分析' },
    { q: '近年来的技术创新趋势分析', sub: '趋势分析' },
    { q: '哪些发明人组合经常一起申请专利', sub: '关联分析' },
    { q: '专利申请的核心技术领域有哪些', sub: '核心技术' },
    { q: '帮我做一个数据可视化大屏', sub: '大屏生成' },
    { q: '导出一份PPT格式的分析报告', sub: 'PPT导出' },
    { q: '详细分析一下被引证最多的专利特征', sub: '特征分析' },
    { q: '各年份不同类型专利的占比变化', sub: '占比变化' },
    { q: '帮我写一个专利申请策略建议', sub: '策略建议' },
    { q: '预测一下明年的专利申请趋势', sub: '预测分析' },
    { q: '各省份专利申请活跃度排名', sub: '地域活跃度' },
  ];
  for (const item of complexQuestions) {
    questions.push({
      question: item.q,
      expectedPattern: 'LLM',
      shouldMatch: false,
      category: '复杂分析',
      subCategory: item.sub,
      notes: '复杂分析，不应匹配模板'
    });
  }

  // ========== 12. 组合条件类 (15个) ==========
  if (timeFields.length > 0 && dimensions.length > 0) {
    const comboPatterns = [
      { template: '{}各{}的{}分布', type: 'TOP-N-GROUP', sub: '时间+维度' },
      { template: '{}的{}排名', type: 'TOP-N-GROUP', sub: '时间+排名' },
      { template: '{}按{}统计', type: 'TREND', sub: '时间+统计' },
    ];
    const windows = ['近5年', '近10年', '2020年以来'];
    for (const window of windows) {
      for (const dim of dimensions.slice(0, 2)) {
        for (const metric of ['申请量', '产出'].slice(0, 1)) {
          for (const pattern of comboPatterns) {
            questions.push({
              question: pattern.template.replace('{}', window).replace('{}', dim.name).replace('{}', metric),
              expectedPattern: pattern.type,
              shouldMatch: true,
              category: '组合条件',
              subCategory: pattern.sub,
              notes: `时间:${window}, 维度:${dim.name}, 指标:${metric}`
            });
          }
        }
      }
    }
  }

  // 去重并返回
  const uniqueQuestions = Array.from(new Map(questions.map(q => [q.question, q])).values());
  return uniqueQuestions;
}

/**
 * 从 SQL 提取模式类型
 */
function extractPatternFromLog(sql: string): string {
  if (!sql) return 'NULL';
  if (sql.includes('COUNT(1)') && sql.includes('GROUP BY')) {
    if (sql.includes('WHERE') && sql.includes('YEAR')) {
      return 'TOP-N-GROUP-时间窗口';
    }
    return 'TOP-N-GROUP';
  }
  if (sql.includes('ORDER BY') && sql.includes('DESC') && sql.includes('LIMIT')) {
    return 'TOP-N';
  }
  if (sql.includes('MAX(') || sql.includes('MIN(')) {
    if (sql.includes('DATEDIFF')) return 'EXTREME_DURATION';
    return 'EXTREME';
  }
  if (sql.includes('COUNT(1)') && !sql.includes('GROUP BY')) {
    return 'COUNT';
  }
  if (sql.includes('SUM(')) {
    return 'SUM';
  }
  if (sql.includes('AVG(')) {
    if (sql.includes('DATEDIFF')) return 'AVG_DURATION';
    return 'AVG';
  }
  if (sql.includes('DISTINCT')) {
    return 'DISTINCT';
  }
  if (sql.includes('LIMIT') && !sql.includes('ORDER BY')) {
    return 'LIMIT';
  }
  return 'OTHER';
}

/**
 * 运行大规模测试
 */
async function runMassiveTest(): Promise<void> {
  console.log('=== 大规模模板匹配测试（100+问题）===\n');

  // 模拟专利数据表结构
  const mockSchema: SchemaInfo[] = [
    {
      tableName: 'patent_data',
      columns: [
        { name: '申请号', type: 'varchar(50)', comment: '专利申请号' },
        { name: '申请日', type: 'date', comment: '申请日期' },
        { name: '申请年份', type: 'int', comment: '申请年份' },
        { name: '公开公告日', type: 'date', comment: '公开公告日期' },
        { name: '公开公告年份', type: 'int', comment: '公开公告年份' },
        { name: '授权公告日', type: 'date', comment: '授权公告日期' },
        { name: '授权公告年份', type: 'int', comment: '授权公告年份' },
        { name: '发明人', type: 'varchar(200)', comment: '第一发明人' },
        { name: '申请人', type: 'varchar(200)', comment: '申请人' },
        { name: '被引证次数', type: 'int', comment: '被引证次数' },
        { name: '专利类型', type: 'varchar(20)', comment: '专利类型' },
        { name: 'IPC主分类', type: 'varchar(50)', comment: 'IPC主分类号' },
        { name: '申请地址', type: 'varchar(200)', comment: '申请地址' },
        { name: '申请费用', type: 'decimal(10,2)', comment: '申请费用' },
      ]
    }
  ];

  // 1. 生成测试问题
  const testCases = generateMassiveQuestions(mockSchema);
  console.log(`\n共生成 ${testCases.length} 个测试问题\n`);

  // 2. 创建 AIAgent 实例
  const agent = new AIAgent();
  const schemaForAgent = mockSchema as any;

  // 3. 运行测试
  const results: TestResult[] = [];
  const categories = new Map<string, { total: number; correct: number; patterns: Set<string> }>();
  const subCategories = new Map<string, { total: number; correct: number }>();

  console.log('开始测试...\n');

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    const prefix = `[${String(i + 1).padStart(3, '0')}/${testCases.length}]`;

    try {
      const result = (agent as any).tryGenerateSQLFromTemplate(
        testCase.question,
        schemaForAgent,
        'mysql',
        [],
        false
      );

      const matched = result !== null;
      const pattern = matched ? extractPatternFromLog(result.sql) : '未匹配';
      const isCorrect = testCase.shouldMatch === matched &&
        (!testCase.shouldMatch || pattern?.includes(testCase.expectedPattern) || false);

      results.push({
        question: testCase.question,
        matched,
        pattern,
        sql: result?.sql || null,
        expectedPattern: testCase.expectedPattern,
        shouldMatch: testCase.shouldMatch,
        isCorrect,
        category: testCase.category,
        subCategory: testCase.subCategory,
        notes: testCase.notes
      });

      // 统计
      const cat = categories.get(testCase.category) || { total: 0, correct: 0, patterns: new Set() };
      cat.total++;
      if (isCorrect) cat.correct++;
      cat.patterns.add(pattern);
      categories.set(testCase.category, cat);

      const sub = subCategories.get(`${testCase.category}-${testCase.subCategory}`) || { total: 0, correct: 0 };
      sub.total++;
      if (isCorrect) sub.correct++;
      subCategories.set(`${testCase.category}-${testCase.subCategory}`, sub);

      const status = isCorrect ? '✓' : '✗';
      console.log(`${prefix} [${testCase.category}] ${testCase.question.substring(0, 35)}... ${status} (${pattern})`);
    } catch (error) {
      console.log(`${prefix} [${testCase.category}] ${testCase.question.substring(0, 35)}... ✗ Error`);
      results.push({
        question: testCase.question,
        matched: false,
        pattern: 'Error',
        sql: null,
        expectedPattern: testCase.expectedPattern,
        shouldMatch: testCase.shouldMatch,
        isCorrect: false,
        category: testCase.category,
        subCategory: testCase.subCategory,
        notes: `Error: ${error}`
      });
    }
  }

  // 4. 输出汇总报告
  console.log('\n' + '='.repeat(80));
  console.log('测试汇总报告');
  console.log('='.repeat(80));

  const total = results.length;
  const correct = results.filter(r => r.isCorrect).length;
  const incorrect = results.filter(r => !r.isCorrect);

  console.log(`\n总体统计:`);
  console.log(`  总问题数: ${total}`);
  console.log(`  正确匹配: ${correct} (${(correct / total * 100).toFixed(1)}%)`);
  console.log(`  错误匹配: ${incorrect.length} (${(incorrect.length / total * 100).toFixed(1)}%)`);
  console.log(`  成功匹配数: ${results.filter(r => r.matched).length}`);
  console.log(`  未匹配数: ${results.filter(r => !r.matched).length}`);

  // 按类别统计
  console.log(`\n按类别统计:`);
  console.log('-'.repeat(80));
  console.log(`${'类别'.padEnd(15)} ${'正确/总数'.padEnd(12)} ${'准确率'.padEnd(10)} 实际匹配到的模式`);
  console.log('-'.repeat(80));
  for (const [category, stats] of categories) {
    const acc = (stats.correct / stats.total * 100).toFixed(1);
    const patterns = Array.from(stats.patterns).slice(0, 3).join(', ');
    console.log(`${category.padEnd(15)} ${`${stats.correct}/${stats.total}`.padEnd(12)} ${`${acc}%`.padEnd(10)} ${patterns}`);
  }

  // 失败案例分析
  if (incorrect.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('失败案例分析（按预期模式分组）');
    console.log('='.repeat(80));

    const byExpected = new Map<string, TestResult[]>();
    for (const r of incorrect) {
      const key = `${r.category} | 期望:${r.expectedPattern} | 实际:${r.pattern}`;
      const list = byExpected.get(key) || [];
      list.push(r);
      byExpected.set(key, list);
    }

    // 按失败数量排序
    const sortedGroups = Array.from(byExpected.entries()).sort((a, b) => b[1].length - a[1].length);

    for (const [key, list] of sortedGroups.slice(0, 10)) {
      console.log(`\n[${list.length}个失败] ${key}`);
      for (const r of list.slice(0, 3)) {
        console.log(`  Q: ${r.question}`);
        if (r.sql) console.log(`  SQL: ${r.sql.substring(0, 70)}...`);
      }
    }
  }

  // 5. 保存报告
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total,
      correct,
      accuracy: (correct / total * 100).toFixed(1) + '%',
      matched: results.filter(r => r.matched).length,
      unmatched: results.filter(r => !r.matched).length,
    },
    byCategory: Array.from(categories).map(([name, stats]) => ({
      name,
      total: stats.total,
      correct: stats.correct,
      accuracy: (stats.correct / stats.total * 100).toFixed(1) + '%',
      patterns: Array.from(stats.patterns),
    })),
    failedCases: incorrect.map(r => ({
      question: r.question,
      category: r.category,
      expected: r.expectedPattern,
      actual: r.pattern,
      shouldMatch: r.shouldMatch,
    })),
  };

  fs.writeFileSync('template-test-report.json', JSON.stringify(report, null, 2));
  console.log(`\n详细报告已保存: template-test-report.json (${fs.statSync('template-test-report.json').size} bytes)`);
  console.log('\n测试完成!');
}

// 运行测试
runMassiveTest().catch(console.error);
