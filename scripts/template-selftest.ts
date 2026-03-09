/**
 * 模板匹配自测脚本
 * 基于表结构自动生成测试问题，验证模板匹配准确性
 *
 * 运行: npx tsx scripts/template-selftest.ts
 */

import { AIAgent } from '../src/agent/index.js';
import { MySQLDataSource } from '../src/datasource/mysql.js';
import dotenv from 'dotenv';

dotenv.config();

interface TestCase {
  question: string;
  expectedPattern: string;  // 期望匹配的模式
  shouldMatch: boolean;   // 是否应该匹配模板
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
  notes?: string;
}

/**
 * 基于表结构生成测试问题
 */
function generateTestQuestions(schema: any[]): TestCase[] {
  const columns = schema.flatMap((s: any) => s.columns || []);
  const tableName = schema[0]?.tableName || 'data';

  // 识别字段类型
  const yearFields = columns.filter((c: any) => /年|year/i.test(c.name));
  const dateFields = columns.filter((c: any) => /日|date|时间|time/i.test(c.name));
  const numericFields = columns.filter((c: any) => {
    const t = c.type?.toLowerCase() || '';
    return t.includes('int') || t.includes('decimal') || t.includes('float') ||
           t.includes('double') || t.includes('number') || /次数|数量/i.test(c.name);
  });
  const textFields = columns.filter((c: any) => {
    const t = c.type?.toLowerCase() || '';
    return (t.includes('varchar') || t.includes('char') || t.includes('text')) &&
           /名|称|人|type|类型/i.test(c.name);
  });

  // 从 schema 中提取实际可用于分组的维度字段
  const dimensionFields = textFields.filter((c: any) => 
    /发明人|申请人|类型|分类|人/i.test(c.name)
  );

  const questions: TestCase[] = [];

  // 1. 产出类 TOP-N-GROUP 问题（使用实际存在的字段）
  for (const field of dimensionFields.slice(0, 3)) {
    const name = field.comment || field.name;
    questions.push({
      question: `哪些${name}的专利产出最高？`,
      expectedPattern: 'TOP-N-GROUP',
      shouldMatch: true,
      notes: `产出类统计需要 GROUP BY + COUNT（字段: ${name}）`
    });
    questions.push({
      question: `${name}的专利数量分布`,
      expectedPattern: 'TOP-N-GROUP',
      shouldMatch: true,
      notes: `分布统计（字段: ${name}）`
    });
  }

  // 2. 时间窗口测试（需要配合历史上下文）
  if (yearFields.length > 0) {
    const yearField = yearFields[0].name;
    
    // 基础产出查询（应触发默认近5年）
    questions.push({
      question: `哪些发明人的专利产出最高？`,
      expectedPattern: 'TOP-N-GROUP-时间窗口',
      shouldMatch: true,
      notes: '默认时间窗口近5年'
    });

    // 带明确时间范围的问题
    questions.push({
      question: `近3年发明人的专利产出如何？`,
      expectedPattern: 'TOP-N-GROUP-时间窗口',
      shouldMatch: true,
      notes: '明确近3年时间范围'
    });
    
    questions.push({
      question: `2020年以来发明人的专利产出情况？`,
      expectedPattern: 'TOP-N-GROUP-时间窗口',
      shouldMatch: true,
      notes: '明确起始年份'
    });
  }

  // 3. 数值类 TOP-N 问题（使用实际数值字段）
  for (const field of numericFields.slice(0, 2)) {
    const name = field.comment || field.name;
    questions.push({
      question: `哪些专利的${name}最高？`,
      expectedPattern: 'TOP-N',
      shouldMatch: true,
      notes: `数值排序（字段: ${name}）`
    });
  }

  // 4. 极端值问题（带明确字段）
  for (const field of numericFields.slice(0, 1)) {
    const name = field.comment || field.name;
    questions.push({
      question: `${name}最高的是多少？`,
      expectedPattern: 'EXTREME',
      shouldMatch: true,
      notes: `单值极值查询（字段: ${name}）`
    });
    questions.push({
      question: `${name}最大/最小值是多少？`,
      expectedPattern: 'EXTREME',
      shouldMatch: true,
      notes: `明确极值查询`
    });
  }

  // 5. 总数问题
  questions.push({
    question: '总共有多少条数据？',
    expectedPattern: 'COUNT',
    shouldMatch: true,
    notes: '总数统计'
  });
  questions.push({
    question: '一共有多少条专利？',
    expectedPattern: 'COUNT',
    shouldMatch: true,
    notes: '总数统计（含关键词）'
  });

  // 6. 平均耗时问题（需要至少2个日期字段）
  if (dateFields.length >= 2) {
    questions.push({
      question: '平均审查周期是多少天？',
      expectedPattern: 'AVG_DURATION',
      shouldMatch: true,
      notes: '日期差平均'
    });
    questions.push({
      question: '平均授权周期（从申请到授权）？',
      expectedPattern: 'AVG_DURATION',
      shouldMatch: true,
      notes: '明确周期计算'
    });
  }

  // 7. 趋势问题（完整的趋势问法）
  if (yearFields.length > 0) {
    questions.push({
      question: '近5年的申请趋势如何？',
      expectedPattern: 'TREND',
      shouldMatch: true,
      notes: '完整的时间趋势问法'
    });
    questions.push({
      question: '专利申请的年度趋势？',
      expectedPattern: 'TREND',
      shouldMatch: true,
      notes: '趋势查询'
    });
  }

  // 8. 平均值问题（不含日期差）
  for (const field of numericFields.slice(0, 1)) {
    const name = field.comment || field.name;
    questions.push({
      question: `平均${name}是多少？`,
      expectedPattern: 'AVG',
      shouldMatch: true,
      notes: `简单平均值（字段: ${name}）`
    });
  }

  // 9. 故意不匹配的问题（应该走LLM）
  questions.push({
    question: '分析一下各技术领域的发展情况',
    expectedPattern: 'LLM',
    shouldMatch: false,
    notes: '复杂分析，不应该匹配模板'
  });
  questions.push({
    question: '帮我把这些数据做成报告',
    expectedPattern: 'LLM',
    shouldMatch: false,
    notes: '报告生成意图'
  });

  return questions;
}

/**
 * 运行模板匹配测试
 */
async function runTemplateTest(): Promise<void> {
  console.log('=== 模板匹配自测开始 ===\n');

  // 连接数据源
  const datasourceId = process.argv[2] || 'test';
  console.log(`使用数据源: ${datasourceId}`);

  // 这里需要根据实际情况创建数据源
  // 为了测试，我们使用模拟数据
  const mockSchema = [
    {
      tableName: 'patent_data',
      columns: [
        { name: '申请号', type: 'varchar(50)', comment: '申请号' },
        { name: '申请日', type: 'date', comment: '申请日期' },
        { name: '申请年份', type: 'int', comment: '申请年份' },
        { name: '公开公告日', type: 'date', comment: '公开公告日期' },
        { name: '公开公告年份', type: 'int', comment: '公开公告年份' },
        { name: '发明人', type: 'varchar(200)', comment: '第一发明人' },
        { name: '申请人', type: 'varchar(200)', comment: '申请人' },
        { name: '被引证次数', type: 'int', comment: '被引证次数' },
        { name: '专利类型', type: 'varchar(20)', comment: '专利类型' },
      ]
    }
  ];

  // 生成测试问题
  const testCases = generateTestQuestions(mockSchema);
  console.log(`生成 ${testCases.length} 个测试问题\n`);

  // 创建 AIAgent 实例
  const agent = new AIAgent();

  const results: TestResult[] = [];

  for (const testCase of testCases) {
    // 调用模板匹配（通过私有方法）
    // 注意：这里我们需要一个方式来测试私有方法
    // 暂时使用类型断言来绕过 TypeScript 检查
    const result = (agent as any).tryGenerateSQLFromTemplate(
      testCase.question,
      mockSchema,
      'mysql',
      [],
      false
    );

    const matched = result !== null;
    const pattern = matched ? extractPatternFromLog(result.sql) : null;
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
      notes: testCase.notes
    });

    console.log(`[${isCorrect ? '✓' : '✗'}] ${testCase.question}`);
    console.log(`    期望: ${testCase.expectedPattern}, 实际: ${pattern || '未匹配'}`);
    if (result?.sql) {
      console.log(`    SQL: ${result.sql.substring(0, 80)}...`);
    }
    console.log();
  }

  // 输出汇总报告
  console.log('=== 测试汇总 ===');
  const total = results.length;
  const correct = results.filter(r => r.isCorrect).length;
  const incorrect = results.filter(r => !r.isCorrect);

  console.log(`总计: ${total}, 正确: ${correct}, 错误: ${incorrect.length}`);
  console.log(`准确率: ${(correct / total * 100).toFixed(1)}%\n`);

  if (incorrect.length > 0) {
    console.log('=== 错误案例详情 ===');
    for (const r of incorrect) {
      console.log(`问题: ${r.question}`);
      console.log(`期望: ${r.expectedPattern}, 实际: ${r.pattern || '未匹配'}`);
      if (r.sql) console.log(`SQL: ${r.sql}`);
      console.log(`说明: ${r.notes}`);
      console.log();
    }
  }
}

/**
 * 从 SQL 提取模式类型
 */
function extractPatternFromLog(sql: string): string {
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
    return 'EXTREME';
  }
  if (sql.includes('COUNT(1)') && !sql.includes('GROUP BY')) {
    return 'COUNT';
  }
  if (sql.includes('AVG(')) {
    return 'AVG';
  }
  if (sql.includes('DATEDIFF')) {
    return 'AVG_DURATION';
  }
  return 'OTHER';
}

// 运行测试
runTemplateTest().catch(console.error);
