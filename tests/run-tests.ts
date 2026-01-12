import axios from 'axios';

const BASE_URL = 'http://localhost:3000';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

async function runTest(name: string, testFn: () => Promise<boolean>): Promise<void> {
  const start = Date.now();
  try {
    const passed = await testFn();
    results.push({
      name,
      passed,
      duration: Date.now() - start
    });
  } catch (error: any) {
    results.push({
      name,
      passed: false,
      error: error.message,
      duration: Date.now() - start
    });
  }
}

async function main() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   AI 数据问答平台 - API 测试套件      ║');
  console.log('╚════════════════════════════════════════╝\n');

  // 测试 1: 健康检查
  await runTest('健康检查 - 获取首页', async () => {
    const response = await axios.get(`${BASE_URL}/`);
    return response.status === 200;
  });

  // 测试 2: 获取数据源列表
  await runTest('API - 获取数据源列表', async () => {
    const response = await axios.get(`${BASE_URL}/api/datasource`);
    return Array.isArray(response.data);
  });

  // 测试 3: 获取 Agent 能力
  await runTest('API - 获取 Agent 能力', async () => {
    const response = await axios.get(`${BASE_URL}/api/agent/capabilities`);
    return response.data.skills && response.data.mcpTools && response.data.features;
  });

  // 测试 4: 获取技能列表
  await runTest('API - 获取技能列表', async () => {
    const response = await axios.get(`${BASE_URL}/api/agent/skills`);
    return Array.isArray(response.data);
  });

  // 测试 5: 获取 MCP 工具
  await runTest('API - 获取 MCP 工具', async () => {
    const response = await axios.get(`${BASE_URL}/api/agent/mcp/tools`);
    return Array.isArray(response.data);
  });

  // 测试 6: 添加 MySQL 数据源
  let datasourceId: string;
  await runTest('API - 添加 MySQL 数据源', async () => {
    const response = await axios.post(`${BASE_URL}/api/datasource`, {
      name: 'test-mysql-' + Date.now(),
      type: 'mysql',
      config: {
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: 'qinxin',
        database: 'taobao_data'
      }
    });
    datasourceId = response.data.id;
    return !!datasourceId;
  });

  // 测试 7: 测试数据源连接
  if (datasourceId) {
    await runTest('API - 测试数据源连接', async () => {
      const response = await axios.get(`${BASE_URL}/api/datasource/${datasourceId}/test`);
      return response.data.success === true;
    });
  }

  // 测试 8: 获取数据源 Schema
  if (datasourceId) {
    await runTest('API - 获取数据源 Schema', async () => {
      const response = await axios.get(`${BASE_URL}/api/datasource/${datasourceId}/schema`);
      return Array.isArray(response.data);
    });
  }

  // 测试 9: 获取 AI 分析的 Schema
  if (datasourceId) {
    await runTest('API - 获取 AI 分析的 Schema', async () => {
      const response = await axios.get(`${BASE_URL}/api/datasource/${datasourceId}/schema/analyze`);
      return response.data.tables && response.data.suggestedQuestions;
    });
  }

  // 测试 10: 自然语言问答
  let sessionId: string;
  if (datasourceId) {
    await runTest('API - 自然语言问答', async () => {
      const response = await axios.post(`${BASE_URL}/api/ask`, {
        datasourceId,
        question: '数据库中有多少条记录？'
      });
      sessionId = response.data.sessionId;
      return !!response.data.answer && !!sessionId;
    });
  }

  // 测试 11: 获取会话列表
  if (datasourceId) {
    await runTest('API - 获取会话列表', async () => {
      const response = await axios.get(`${BASE_URL}/api/chat/sessions/${datasourceId}`);
      return Array.isArray(response.data);
    });
  }

  // 测试 12: 获取会话详情
  if (sessionId) {
    await runTest('API - 获取会话详情', async () => {
      const response = await axios.get(`${BASE_URL}/api/chat/session/${sessionId}`);
      return response.data.messages && Array.isArray(response.data.messages);
    });
  }

  // 测试 13: 删除数据源
  if (datasourceId) {
    await runTest('API - 删除数据源', async () => {
      const response = await axios.delete(`${BASE_URL}/api/datasource/${datasourceId}`);
      return response.data.message === '已删除';
    });
  }

  // 打印测试结果
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║          测试结果汇总                  ║');
  console.log('╚════════════════════════════════════════╝\n');

  let passed = 0;
  let failed = 0;

  results.forEach((result, index) => {
    const status = result.passed ? '✓' : '✗';
    const color = result.passed ? '\x1b[32m' : '\x1b[31m';
    const reset = '\x1b[0m';
    
    console.log(`${color}${status}${reset} ${index + 1}. ${result.name}`);
    if (result.error) {
      console.log(`  错误: ${result.error}`);
    }
    console.log(`  耗时: ${result.duration}ms`);

    if (result.passed) passed++;
    else failed++;
  });

  console.log('\n' + '─'.repeat(40));
  console.log(`总计: ${results.length} | 通过: ${passed} | 失败: ${failed}`);
  console.log('─'.repeat(40) + '\n');

  if (failed === 0) {
    console.log('🎉 所有测试通过！\n');
    process.exit(0);
  } else {
    console.log(`❌ 有 ${failed} 个测试失败\n`);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('测试运行失败:', error.message);
  process.exit(1);
});
