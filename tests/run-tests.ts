import axios from 'axios';

const BASE_URL = 'http://localhost:3000';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];
let authToken: string = '';

// 认证辅助函数
async function authenticate(): Promise<boolean> {
  try {
    // 尝试注册测试用户
    const username = `testuser_${Date.now()}`;
    const registerResponse = await axios.post(`${BASE_URL}/api/auth/register`, {
      username,
      password: 'testpass123',
      email: 'test@example.com',
      fullName: 'Test User'
    }).catch(() => null);

    if (registerResponse) {
      authToken = registerResponse.data.token;
      return true;
    }

    // 如果注册失败，尝试登录
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      username: 'testuser',
      password: 'testpass123'
    }).catch(() => null);

    if (loginResponse) {
      authToken = loginResponse.data.token;
      return true;
    }

    return false;
  } catch (error) {
    return false;
  }
}

// 创建带认证的 axios 实例
function getAuthHeaders() {
  return {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  };
}

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

  // 先进行认证
  console.log('正在进行认证...');
  const authenticated = await authenticate();
  if (!authenticated) {
    console.error('❌ 认证失败，无法继续测试\n');
    process.exit(1);
  }
  console.log('✓ 认证成功\n');

  // 测试 1: 健康检查
  await runTest('健康检查 - 获取首页', async () => {
    const response = await axios.get(`${BASE_URL}/`);
    return response.status === 200;
  });

  // 测试 2: 获取数据源列表
  await runTest('API - 获取数据源列表', async () => {
    const response = await axios.get(`${BASE_URL}/api/datasource`, getAuthHeaders());
    return Array.isArray(response.data);
  });

  // 测试 3: 获取 Agent 能力
  await runTest('API - 获取 Agent 能力', async () => {
    const response = await axios.get(`${BASE_URL}/api/agent/capabilities`, getAuthHeaders());
    return response.data.skills && response.data.mcpTools && response.data.features;
  });

  // 测试 4: 获取技能列表
  await runTest('API - 获取技能列表', async () => {
    const response = await axios.get(`${BASE_URL}/api/agent/skills`, getAuthHeaders());
    return Array.isArray(response.data);
  });

  // 测试 5: 获取 MCP 工具
  await runTest('API - 获取 MCP 工具', async () => {
    const response = await axios.get(`${BASE_URL}/api/agent/mcp/tools`, getAuthHeaders());
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
    }, getAuthHeaders());
    datasourceId = response.data.id;
    return !!datasourceId;
  });

  // 测试 7: 测试数据源连接
  if (datasourceId) {
    await runTest('API - 测试数据源连接', async () => {
      const response = await axios.get(`${BASE_URL}/api/datasource/${datasourceId}/test`, getAuthHeaders());
      return response.data.success === true;
    });
  }

  // 测试 8: 获取数据源 Schema
  if (datasourceId) {
    await runTest('API - 获取数据源 Schema', async () => {
      const response = await axios.get(`${BASE_URL}/api/datasource/${datasourceId}/schema`, getAuthHeaders());
      return Array.isArray(response.data);
    });
  }

  // 测试 9: 获取 AI 分析的 Schema
  if (datasourceId) {
    await runTest('API - 获取 AI 分析的 Schema', async () => {
      const response = await axios.get(`${BASE_URL}/api/datasource/${datasourceId}/schema/analyze`, getAuthHeaders());
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
      }, getAuthHeaders());
      sessionId = response.data.sessionId;
      return !!response.data.answer && !!sessionId;
    });
  }

  // 测试 11: 获取会话列表
  if (datasourceId) {
    await runTest('API - 获取会话列表', async () => {
      const response = await axios.get(`${BASE_URL}/api/chat/sessions/${datasourceId}`, getAuthHeaders());
      return Array.isArray(response.data);
    });
  }

  // 测试 12: 获取会话详情
  if (sessionId) {
    await runTest('API - 获取会话详情', async () => {
      const response = await axios.get(`${BASE_URL}/api/chat/session/${sessionId}`, getAuthHeaders());
      return response.data.messages && Array.isArray(response.data.messages);
    });
  }

  // 测试 13: 删除数据源
  if (datasourceId) {
    await runTest('API - 删除数据源', async () => {
      const response = await axios.delete(`${BASE_URL}/api/datasource/${datasourceId}`, getAuthHeaders());
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
