/**
 * AI驱动的大规模模板匹配测试脚本
 * 1. 调用AI分析表结构，生成100+符合业务逻辑的测试问题
 * 2. 逐一测试验证模板匹配准确性
 * 3. 输出详细报告和失败案例分析
 *
 * 运行: npx tsx scripts/template-ai-test.ts
 */

import { AIAgent } from '../src/agent/index.js';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

interface TestCase {
  question: string;
  expectedPattern: string;
  shouldMatch: boolean;
  expectedSQL?: string;
  notes?: string;
  category: string; // 问题类别：产出统计、趋势分析、极值查询等
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
  notes?: string;
}

interface SchemaInfo {
  tableName: string;
  columns: {
    name: string;
    type: string;
    comment?: string;
    isNumeric?: boolean;
    isDate?: boolean;
    isText?: boolean;
    isDimension?: boolean; // 是否可用于分组（人名、类型、地区等）
  }[];
}

/**
 * 调用AI分析表结构，生成测试问题
 */
async function generateQuestionsWithAI(schema: SchemaInfo[]): Promise<TestCase[]> {
  console.log('=== 调用AI生成测试问题 ===\n');

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
  });

  const schemaStr = schema.map(s =>
    `表 ${s.tableName}:\n${s.columns.map(c => `  - ${c.name} (${c.type})${c.comment ? `: ${c.comment}` : ''}`).join('\n')}`
  ).join('\n\n');

  const prompt = `你是一个数据分析专家。请根据以下数据库表结构，生成100个符合业务逻辑的测试问题。

表结构：
${schemaStr}

要求：
1. 生成100个测试问题，覆盖以下类别：
   - 产出统计（20个）：哪些发明人/申请人的专利产出最高、各类型专利数量分布等
   - 趋势分析（15个）：近5年申请趋势、年度变化情况等
   - 极值查询（15个）：被引证次数最高/最低、最大/最小申请年份等
   - 排名查询（15个）：TOP10发明人、前20被引证专利等
   - 平均值统计（10个）：平均被引证次数、平均审查周期等
   - 总数统计（10个）：总共有多少条数据、各类型分别有多少等
   - 复杂分析（15个）：需要多维度组合的问题

2. 问题要符合真实业务场景，使用表中的实际字段名

3. 输出JSON数组格式：
[
  {
    "question": "问题文本",
    "expectedPattern": "预期的模板类型：TOP-N-GROUP/TREND/EXTREME/COUNT/AVG/SUM/LIMIT/DISTINCT/LLM",
    "shouldMatch": true/false,
    "category": "问题类别",
    "notes": "说明"
  }
]

请确保生成100个问题。`;

  try {
    console.log('正在调用AI生成测试问题...');
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        { role: 'system', content: '你是一个专业的数据分析测试工程师，擅长生成全面的测试用例。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 8000,
    });

    const content = response.choices[0].message.content || '';

    // 提取JSON
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const questions = JSON.parse(jsonMatch[0]) as TestCase[];
      console.log(`✓ AI生成了 ${questions.length} 个测试问题\n`);
      return questions;
    }
  } catch (error) {
    console.error('AI生成问题失败:', error);
  }

  // 降级：使用本地生成
  console.log('AI生成失败，使用本地备用方案生成问题\n');
  return generateLocalQuestions(schema);
}

/**
 * 本地备用：基于规则生成测试问题
 */
function generateLocalQuestions(schema: SchemaInfo[]): TestCase[] {
  const questions: TestCase[] = [];
  const allColumns = schema.flatMap(s => s.columns);
  const tableName = schema[0]?.tableName || 'data';

  // 识别各类字段
  const yearFields = allColumns.filter(c => /年|year/i.test(c.name));
  const dateFields = allColumns.filter(c => /日|date|时间|time/i.test(c.name) && !/年|year/i.test(c.name));
  const numericFields = allColumns.filter(c => {
    const t = c.type.toLowerCase();
    return t.includes('int') || t.includes('decimal') || t.includes('float') ||
           t.includes('double') || /次数|数量|被引|引用/i.test(c.name);
  });
  const dimensionFields = allColumns.filter(c => {
    return /发明人|申请人|类型|分类|人|名称|公司|机构/i.test(c.name);
  });

  // 1. 产出统计类 (20个)
  const outputPatterns = [
    { q: '哪些{}的专利产出最高？', p: 'TOP-N-GROUP' },
    { q: '{}的专利数量分布', p: 'TOP-N-GROUP' },
    { q: '按{}统计专利数量', p: 'TOP-N-GROUP' },
    { q: '各{}的专利申请情况', p: 'TOP-N-GROUP' },
    { q: '{}专利申请量排名', p: 'TOP-N-GROUP' },
  ];

  for (const dim of dimensionFields.slice(0, 4)) {
    for (const pattern of outputPatterns) {
      questions.push({
        question: pattern.q.replace('{}', dim.name),
        expectedPattern: pattern.p,
        shouldMatch: true,
        category: '产出统计',
        notes: `基于字段 ${dim.name}`
      });
    }
  }

  // 2. 趋势分析类 (15个)
  if (yearFields.length > 0) {
    const trendPatterns = [
      '近5年的专利申请趋势如何？',
      '近10年被引证趋势变化？',
      '各年份专利申请量分布',
      '年度申请趋势分析',
      '近3年{}的产出趋势',
      '申请量年度变化情况',
      '按年份统计专利数量',
      '近5年{}的分布趋势',
    ];
    trendPatterns.forEach(q => {
      questions.push({
        question: q,
        expectedPattern: 'TREND',
        shouldMatch: true,
        category: '趋势分析',
        notes: '时间序列分析'
      });
    });
  }

  // 3. 极值查询类 (15个)
  for (const field of numericFields.slice(0, 5)) {
    questions.push({
      question: `${field.name}最高的是多少？`,
      expectedPattern: 'EXTREME',
      shouldMatch: true,
      category: '极值查询',
      notes: `单值极值：${field.name}`
    });
    questions.push({
      question: `${field.name}最小值是多少？`,
      expectedPattern: 'EXTREME',
      shouldMatch: true,
      category: '极值查询',
      notes: `单值极值：${field.name}`
    });
  }

  // 日期差极值
  if (dateFields.length >= 2) {
    questions.push({
      question: '最长审查周期是多少天？',
      expectedPattern: 'EXTREME_DURATION',
      shouldMatch: true,
      category: '极值查询',
      notes: '日期差极值'
    });
    questions.push({
      question: '最短授权时间是多久？',
      expectedPattern: 'EXTREME_DURATION',
      shouldMatch: true,
      category: '极值查询',
      notes: '日期差极值'
    });
  }

  // 4. 排名查询类 (15个)
  for (const field of numericFields.slice(0, 3)) {
    questions.push({
      question: `哪些专利的${field.name}最高？`,
      expectedPattern: 'TOP-N',
      shouldMatch: true,
      category: '排名查询',
      notes: `数值排序：${field.name}`
    });
    questions.push({
      question: `${field.name}排名前10的专利`,
      expectedPattern: 'TOP-N',
      shouldMatch: true,
      category: '排名查询',
      notes: `明确排名：${field.name}`
    });
  }

  // 5. 平均值统计类 (10个)
  for (const field of numericFields.slice(0, 3)) {
    questions.push({
      question: `平均${field.name}是多少？`,
      expectedPattern: 'AVG',
      shouldMatch: true,
      category: '平均值统计',
      notes: `平均值：${field.name}`
    });
  }

  // 平均周期
  if (dateFields.length >= 2) {
    questions.push({
      question: '平均审查周期是多少天？',
      expectedPattern: 'AVG_DURATION',
      shouldMatch: true,
      category: '平均值统计',
      notes: '日期差平均'
    });
    questions.push({
      question: '平均授权周期（从申请到公开）？',
      expectedPattern: 'AVG_DURATION',
      shouldMatch: true,
      category: '平均值统计',
      notes: '日期差平均'
    });
  }

  // 6. 总数统计类 (10个)
  questions.push({
    question: '总共有多少条数据？',
    expectedPattern: 'COUNT',
    shouldMatch: true,
    category: '总数统计',
    notes: '总数查询'
  });
  questions.push({
    question: '一共有多少条专利记录？',
    expectedPattern: 'COUNT',
    shouldMatch: true,
    category: '总数统计',
    notes: '总数查询'
  });
  questions.push({
    question: '数据总量是多少？',
    expectedPattern: 'COUNT',
    shouldMatch: true,
    category: '总数统计',
    notes: '总数查询'
  });

  // 7. 复杂分析类 (15个) - 应该走LLM
  questions.push({
    question: '分析一下各技术领域的发展情况',
    expectedPattern: 'LLM',
    shouldMatch: false,
    category: '复杂分析',
    notes: '复杂分析，不应匹配模板'
  });
  questions.push({
    question: '帮我生成一份专利分析报告',
    expectedPattern: 'LLM',
    shouldMatch: false,
    category: '复杂分析',
    notes: '报告生成'
  });
  questions.push({
    question: '各发明人的技术领域分布情况',
    expectedPattern: 'LLM',
    shouldMatch: false,
    category: '复杂分析',
    notes: '多维度分析'
  });

  // 时间窗口追问
  if (yearFields.length > 0) {
    questions.push({
      question: '近3年发明人的产出情况',
      expectedPattern: 'TOP-N-GROUP',
      shouldMatch: true,
      category: '时间窗口',
      notes: '带时间范围的产出统计'
    });
    questions.push({
      question: '2020年以来申请人的专利分布',
      expectedPattern: 'TOP-N-GROUP',
      shouldMatch: true,
      category: '时间窗口',
      notes: '带起始年份的统计'
    });
  }

  return questions;
}

/**
 * 运行模板匹配测试
 */
async function runAITest(): Promise<void> {
  console.log('=== AI驱动的大规模模板匹配测试 ===\n');

  // 使用模拟数据（专利数据表结构）
  const mockSchema: SchemaInfo[] = [
    {
      tableName: 'patent_data',
      columns: [
        { name: '申请号', type: 'varchar(50)', comment: '专利申请号' },
        { name: '申请日', type: 'date', comment: '申请日期', isDate: true },
        { name: '申请年份', type: 'int', comment: '申请年份', isNumeric: true },
        { name: '公开公告日', type: 'date', comment: '公开公告日期', isDate: true },
        { name: '公开公告年份', type: 'int', comment: '公开公告年份', isNumeric: true },
        { name: '授权公告日', type: 'date', comment: '授权公告日期', isDate: true },
        { name: '授权公告年份', type: 'int', comment: '授权公告年份', isNumeric: true },
        { name: '发明人', type: 'varchar(200)', comment: '第一发明人', isDimension: true },
        { name: '申请人', type: 'varchar(200)', comment: '申请人', isDimension: true },
        { name: '被引证次数', type: 'int', comment: '被引证次数', isNumeric: true },
        { name: '专利类型', type: 'varchar(20)', comment: '专利类型', isDimension: true },
        { name: 'IPC分类号', type: 'varchar(100)', comment: 'IPC分类号' },
        { name: '申请地址', type: 'varchar(200)', comment: '申请地址' },
      ]
    }
  ];

  // 1. 生成测试问题
  const testCases = await generateQuestionsWithAI(mockSchema);
  console.log(`准备测试 ${testCases.length} 个问题\n`);

  // 2. 创建 AIAgent 实例
  const agent = new AIAgent();
  const schemaForAgent = mockSchema as any;

  // 3. 运行测试
  const results: TestResult[] = [];
  const categories = new Map<string, { total: number; correct: number }>();

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    process.stdout.write(`[${i + 1}/${testCases.length}] ${testCase.question.substring(0, 40)}... `);

    try {
      const result = (agent as any).tryGenerateSQLFromTemplate(
        testCase.question,
        schemaForAgent,
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
        category: testCase.category,
        notes: testCase.notes
      });

      // 统计类别准确率
      const cat = categories.get(testCase.category) || { total: 0, correct: 0 };
      cat.total++;
      if (isCorrect) cat.correct++;
      categories.set(testCase.category, cat);

      console.log(isCorrect ? '✓' : '✗');
    } catch (error) {
      console.log('✗ Error');
      results.push({
        question: testCase.question,
        matched: false,
        pattern: null,
        sql: null,
        expectedPattern: testCase.expectedPattern,
        shouldMatch: testCase.shouldMatch,
        isCorrect: false,
        category: testCase.category,
        notes: `Error: ${error}`
      });
    }
  }

  // 4. 输出汇总报告
  console.log('\n=== 测试汇总报告 ===');
  const total = results.length;
  const correct = results.filter(r => r.isCorrect).length;
  const incorrect = results.filter(r => !r.isCorrect);

  console.log(`\n总体准确率: ${correct}/${total} (${(correct / total * 100).toFixed(1)}%)`);
  console.log(`成功匹配: ${results.filter(r => r.matched).length}`);
  console.log(`未匹配: ${results.filter(r => !r.matched).length}`);

  // 按类别统计
  console.log('\n=== 按类别统计 ===');
  for (const [category, stats] of categories) {
    console.log(`${category}: ${stats.correct}/${stats.total} (${(stats.correct / stats.total * 100).toFixed(1)}%)`);
  }

  // 失败案例分析
  if (incorrect.length > 0) {
    console.log('\n=== 失败案例分析（前20个） ===');
    const byPattern = new Map<string, TestResult[]>();
    for (const r of incorrect) {
      const key = `${r.expectedPattern}→${r.pattern || '未匹配'}`;
      const list = byPattern.get(key) || [];
      list.push(r);
      byPattern.set(key, list);
    }

    for (const [key, list] of byPattern) {
      console.log(`\n[${key}] ${list.length} 个问题:`);
      for (const r of list.slice(0, 3)) {
        console.log(`  - ${r.question}`);
        if (r.sql) console.log(`    SQL: ${r.sql.substring(0, 60)}...`);
      }
    }
  }

  // 5. 保存详细报告
  const report = {
    timestamp: new Date().toISOString(),
    total,
    correct,
    accuracy: (correct / total * 100).toFixed(1) + '%',
    byCategory: Object.fromEntries(categories),
    failedCases: incorrect.map(r => ({
      question: r.question,
      expected: r.expectedPattern,
      actual: r.pattern,
      category: r.category
    }))
  };

  const fs = await import('fs');
  fs.writeFileSync('template-test-report.json', JSON.stringify(report, null, 2));
  console.log('\n详细报告已保存到: template-test-report.json');
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

// 运行测试
runAITest().catch(console.error);
