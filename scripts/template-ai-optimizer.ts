/**
 * AI驱动的模板迭代优化系统
 * 
 * 功能：
 * 1. 自动分析模板测试失败案例
 * 2. 调用AI生成优化建议
 * 3. 自动修复模板正则和优先级
 * 4. 持续迭代直到准确率达标
 * 
 * 使用方法:
 *   npx tsx scripts/template-ai-optimizer.ts
 *   npx tsx scripts/template-ai-optimizer.ts --target-accuracy 80
 *   npx tsx scripts/template-ai-optimizer.ts --max-iterations 5
 */

import { AIAgent } from '../src/agent/index.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';

dotenv.config();

interface OptimizationResult {
  iteration: number;
  timestamp: string;
  accuracy: number;
  improvements: PatternImprovement[];
  newPatterns: NewPattern[];
  removedPatterns: string[];
}

interface PatternImprovement {
  patternName: string;
  oldRegex: string;
  newRegex: string;
  reason: string;
  testCases: string[];
}

interface NewPattern {
  patternName: string;
  regex: string;
  sqlTemplate: string;
  priority: number;
  reason: string;
}

interface FailureCase {
  question: string;
  expectedPattern: string;
  actualPattern: string;
  sql: string | null;
  category: string;
}

interface TestResult {
  total: number;
  correct: number;
  accuracy: number;
  failures: FailureCase[];
  byCategory: Map<string, { total: number; correct: number }>;
}

/**
 * 读取最新的测试报告
 */
function loadLatestReport(): any | null {
  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) return null;

  const files = fs.readdirSync(reportsDir)
    .filter(f => f.startsWith('template-verify-') && f.endsWith('.json'))
    .map(f => ({
      name: f,
      path: path.join(reportsDir, f),
      mtime: fs.statSync(path.join(reportsDir, f)).mtime
    }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  if (files.length === 0) return null;

  try {
    const content = fs.readFileSync(files[0].path, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}

/**
 * 运行模板测试
 */
async function runTemplateTest(mockSchema: any[]): Promise<TestResult> {
  const agent = new AIAgent();
  const testCases = generateTestCases(mockSchema);

  let correct = 0;
  const failures: FailureCase[] = [];
  const byCategory = new Map<string, { total: number; correct: number }>();

  for (const test of testCases) {
    try {
      const result = (agent as any).tryGenerateSQLFromTemplate(
        test.question,
        mockSchema,
        'mysql',
        [],
        false
      );

      const matched = result !== null;
      const actualPattern = extractPattern(result?.sql, matched);
      const isCorrect = test.shouldMatch === matched &&
        (!test.shouldMatch || actualPattern?.includes(test.expectedPattern) || false);

      // 分类统计
      const cat = byCategory.get(test.category) || { total: 0, correct: 0 };
      cat.total++;
      if (isCorrect) cat.correct++;
      byCategory.set(test.category, cat);

      if (isCorrect) {
        correct++;
      } else {
        failures.push({
          question: test.question,
          expectedPattern: test.expectedPattern,
          actualPattern: actualPattern || '未匹配',
          sql: result?.sql || null,
          category: test.category
        });
      }
    } catch (e) {
      failures.push({
        question: test.question,
        expectedPattern: test.expectedPattern,
        actualPattern: 'Error',
        sql: null,
        category: test.category
      });
    }
  }

  return {
    total: testCases.length,
    correct,
    accuracy: correct / testCases.length,
    failures,
    byCategory
  };
}

/**
 * 生成测试用例
 */
function generateTestCases(mockSchema: any[]): any[] {
  const columns = mockSchema.flatMap((s: any) => s.columns || []);
  
  return [
    // 产出统计
    { question: '哪些发明人的专利产出最高？', expectedPattern: 'TOP-N-GROUP', shouldMatch: true, category: '产出统计' },
    { question: '发明人的专利数量分布', expectedPattern: 'TOP-N-GROUP', shouldMatch: true, category: '产出统计' },
    
    // 时间窗口
    { question: '近5年发明人的产出情况', expectedPattern: 'TOP-N-GROUP', shouldMatch: true, category: '时间窗口' },
    { question: '近3年申请人分布', expectedPattern: 'TOP-N-GROUP', shouldMatch: true, category: '时间窗口' },
    
    // 极值查询
    { question: '被引证次数最高的是多少？', expectedPattern: 'EXTREME', shouldMatch: true, category: '极值查询' },
    { question: '申请费用最小值是多少？', expectedPattern: 'EXTREME', shouldMatch: true, category: '极值查询' },
    
    // 排名查询
    { question: '哪些专利的被引证次数最高？', expectedPattern: 'TOP-N', shouldMatch: true, category: '排名查询' },
    { question: '申请费用排名前10的专利', expectedPattern: 'TOP-N', shouldMatch: true, category: '排名查询' },
    
    // 平均值
    { question: '平均被引证次数是多少？', expectedPattern: 'AVG', shouldMatch: true, category: '平均值统计' },
    { question: '平均申请费用是多少？', expectedPattern: 'AVG', shouldMatch: true, category: '平均值统计' },
    
    // 总数
    { question: '总共有多少条数据？', expectedPattern: 'COUNT', shouldMatch: true, category: '总数统计' },
    
    // 趋势
    { question: '近5年趋势如何？', expectedPattern: 'TREND', shouldMatch: true, category: '趋势分析' },
    
    // 复杂分析（不应匹配）
    { question: '帮我分析一下数据特征', expectedPattern: 'LLM', shouldMatch: false, category: '复杂分析' },
  ];
}

/**
 * 提取匹配的模式
 */
function extractPattern(sql: string | null, matched: boolean): string | null {
  if (!matched || !sql) return null;
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
  return 'OTHER';
}

/**
 * 调用AI分析失败案例并生成优化建议
 */
async function analyzeWithAI(failures: FailureCase[], currentAccuracy: number): Promise<{ improvements: PatternImprovement[], newPatterns: NewPattern[] }> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
  });

  const prompt = `你是一个SQL模板优化专家。请分析以下模板匹配失败案例，生成优化建议。

当前准确率: ${(currentAccuracy * 100).toFixed(1)}%

失败案例分析:
${failures.slice(0, 20).map(f => `
问题: "${f.question}"
期望匹配: ${f.expectedPattern}
实际匹配: ${f.actualPattern}
类别: ${f.category}
`).join('\n')}

当前模板模式概览:
1. TOP-N-GROUP: 产出/分布统计 (GROUP BY + COUNT)
2. TOP-N: 排名查询 (ORDER BY + LIMIT)
3. EXTREME: 极值查询 (MAX/MIN)
4. COUNT: 总数统计
5. AVG: 平均值统计
6. TREND: 趋势分析

请提供优化建议，返回JSON格式:
{
  "improvements": [
    {
      "patternName": "模式名称",
      "oldRegex": "当前正则（如有）",
      "newRegex": "优化后的正则",
      "reason": "优化原因",
      "testCases": ["应匹配的问题1", "应匹配的问题2"]
    }
  ],
  "newPatterns": [
    {
      "patternName": "新模式名称",
      "regex": "匹配正则",
      "sqlTemplate": "SQL模板",
      "priority": 优先级数字,
      "reason": "添加原因"
    }
  ]
}

优化原则:
1. 优先修复高频率失败的模式
2. 正则要精确但不过度限制
3. 考虑同义词（如"最高/最大/最多"）
4. 确保新模式不会误伤已正确的匹配`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        { role: 'system', content: '你是一个专业的SQL模板优化专家。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 4000,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0].message.content || '{}';
    const result = JSON.parse(content);
    
    return {
      improvements: result.improvements || [],
      newPatterns: result.newPatterns || []
    };
  } catch (error) {
    console.error('AI分析失败:', error);
    return { improvements: [], newPatterns: [] };
  }
}

/**
 * 应用优化建议到模板代码
 */
async function applyOptimizations(improvements: PatternImprovement[], newPatterns: NewPattern[]): Promise<boolean> {
  const agentFile = path.join(process.cwd(), 'src', 'agent', 'index.ts');
  
  if (!fs.existsSync(agentFile)) {
    console.error('找不到模板文件:', agentFile);
    return false;
  }

  let content = fs.readFileSync(agentFile, 'utf-8');
  let modified = false;

  // 应用模式改进
  for (const imp of improvements) {
    if (imp.oldRegex && imp.newRegex) {
      const oldRegex = imp.oldRegex.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (content.includes(imp.oldRegex)) {
        content = content.replace(new RegExp(escapeRegExp(imp.oldRegex), 'g'), imp.newRegex);
        console.log(`  ✓ 优化模式 ${imp.patternName}: ${imp.reason}`);
        modified = true;
      }
    }
  }

  // 如果有新模式，添加到适当位置
  if (newPatterns.length > 0) {
    // 找到 tryGenerateSQLFromTemplate 方法的合适插入点
    const insertPoint = content.indexOf('// 模式1: "各XX的数量"');
    if (insertPoint !== -1) {
      const newPatternsCode = newPatterns.map(p => `
    // 新模式: ${p.patternName}
    const ${p.patternName}Match = q.match(/${p.regex}/);
    if (${p.patternName}Match) {
      const sql = \`${p.sqlTemplate}\`;
      console.log(\`=== 模板匹配成功 [${p.patternName}]: "\${q}" → \${sql}\`);
      return { sql, chartType: 'none' };
    }
`).join('\n');
      
      content = content.slice(0, insertPoint) + newPatternsCode + '\n' + content.slice(insertPoint);
      console.log(`  ✓ 添加 ${newPatterns.length} 个新模式`);
      modified = true;
    }
  }

  if (modified) {
    // 备份原文件
    const backupFile = agentFile + '.backup.' + Date.now();
    fs.writeFileSync(backupFile, fs.readFileSync(agentFile));
    
    // 写入优化后的内容
    fs.writeFileSync(agentFile, content);
    console.log(`  ✓ 模板已优化并保存 (备份: ${path.basename(backupFile)})`);
    return true;
  }

  return false;
}

/**
 * 转义正则特殊字符
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 主优化流程
 */
async function runOptimization(): Promise<void> {
  const args = process.argv.slice(2);
  const targetAccuracy = parseFloat(args.find(a => a.startsWith('--target-accuracy='))?.split('=')[1] || '0.85');
  const maxIterations = parseInt(args.find(a => a.startsWith('--max-iterations='))?.split('=')[1] || '3');

  console.log('=== AI驱动的模板迭代优化 ===\n');
  console.log(`目标准确率: ${(targetAccuracy * 100).toFixed(0)}%`);
  console.log(`最大迭代次数: ${maxIterations}\n`);

  // 使用模拟数据进行测试
  const mockSchema = [
    {
      tableName: 'patent_data',
      columns: [
        { name: '申请号', type: 'varchar(50)', comment: '申请号' },
        { name: '申请日', type: 'date', comment: '申请日期' },
        { name: '申请年份', type: 'int', comment: '申请年份' },
        { name: '发明人', type: 'varchar(200)', comment: '发明人' },
        { name: '申请人', type: 'varchar(200)', comment: '申请人' },
        { name: '被引证次数', type: 'int', comment: '被引证次数' },
        { name: '申请费用', type: 'decimal(10,2)', comment: '申请费用' },
        { name: '专利类型', type: 'varchar(20)', comment: '专利类型' },
      ]
    }
  ];

  const results: OptimizationResult[] = [];

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`第 ${iteration}/${maxIterations} 轮优化`);
    console.log('='.repeat(80));

    // 1. 运行测试
    const testResult = await runTemplateTest(mockSchema);
    console.log(`\n当前准确率: ${(testResult.accuracy * 100).toFixed(1)}% (${testResult.correct}/${testResult.total})`);
    
    // 按类别输出
    console.log('\n各类别准确率:');
    for (const [cat, stats] of testResult.byCategory) {
      const acc = (stats.correct / stats.total * 100).toFixed(1);
      console.log(`  ${cat}: ${stats.correct}/${stats.total} (${acc}%)`);
    }

    // 记录结果
    results.push({
      iteration,
      timestamp: new Date().toISOString(),
      accuracy: testResult.accuracy,
      improvements: [],
      newPatterns: [],
      removedPatterns: []
    });

    // 检查是否达到目标
    if (testResult.accuracy >= targetAccuracy) {
      console.log(`\n✓ 已达到目标准确率 ${(targetAccuracy * 100).toFixed(0)}%，优化完成！`);
      break;
    }

    if (testResult.failures.length === 0) {
      console.log('\n✓ 没有失败案例，优化完成！');
      break;
    }

    // 2. AI分析失败案例
    console.log(`\n调用AI分析 ${testResult.failures.length} 个失败案例...`);
    const { improvements, newPatterns } = await analyzeWithAI(testResult.failures, testResult.accuracy);
    
    if (improvements.length === 0 && newPatterns.length === 0) {
      console.log('AI未生成有效优化建议，尝试下一轮的更详细分析...');
      continue;
    }

    console.log(`\nAI建议:`);
    console.log(`  - 优化 ${improvements.length} 个现有模式`);
    console.log(`  - 添加 ${newPatterns.length} 个新模式`);
    
    improvements.forEach(imp => {
      console.log(`\n  [${imp.patternName}]`);
      console.log(`    原因: ${imp.reason}`);
      console.log(`    测试用例: ${imp.testCases.slice(0, 2).join(', ')}`);
    });

    // 3. 应用优化
    console.log('\n应用优化...');
    const applied = await applyOptimizations(improvements, newPatterns);
    
    if (!applied) {
      console.log('未能应用优化，本轮优化结束');
    }

    // 更新记录
    results[results.length - 1].improvements = improvements;
    results[results.length - 1].newPatterns = newPatterns;
  }

  // 输出最终汇总
  console.log('\n' + '='.repeat(80));
  console.log('优化完成 - 迭代历程');
  console.log('='.repeat(80));
  
  results.forEach(r => {
    const improvementCount = r.improvements.length + r.newPatterns.length;
    console.log(`\n第${r.iteration}轮: ${(r.accuracy * 100).toFixed(1)}% ${improvementCount > 0 ? `(+${improvementCount}改进)` : ''}`);
    
    r.improvements.forEach(i => {
      console.log(`  优化: ${i.patternName} - ${i.reason.substring(0, 40)}`);
    });
    r.newPatterns.forEach(p => {
      console.log(`  新增: ${p.patternName} - ${p.reason.substring(0, 40)}`);
    });
  });

  // 保存优化日志
  const logFile = path.join(process.cwd(), 'reports', `template-optimization-${Date.now()}.json`);
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  fs.writeFileSync(logFile, JSON.stringify(results, null, 2));
  console.log(`\n优化日志已保存: ${logFile}`);
}

// 运行优化
runOptimization().catch(console.error);
