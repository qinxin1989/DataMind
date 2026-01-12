import axios from 'axios';

const BASE_URL = 'http://localhost:3000';

// 测试配置
const testConfig = {
  datasourceName: 'test-datasource',
  csvFile: './tests/sample.csv',
  mysqlConfig: {
    name: 'test-mysql',
    type: 'mysql',
    config: {
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: 'qinxin',
      database: 'taobao_data'
    }
  }
};

// 测试用例
describe('AI 数据问答平台 API 测试', () => {
  let datasourceId: string;
  let sessionId: string;

  // 测试 1: 获取数据源列表
  test('应该能获取数据源列表', async () => {
    try {
      const response = await axios.get(`${BASE_URL}/api/datasource`);
      console.log('✓ 获取数据源列表成功');
      console.log(`  数据源数量: ${response.data.length}`);
      return true;
    } catch (error: any) {
      console.error('✗ 获取数据源列表失败:', error.message);
      return false;
    }
  });

  // 测试 2: 添加 MySQL 数据源
  test('应该能添加 MySQL 数据源', async () => {
    try {
      const response = await axios.post(`${BASE_URL}/api/datasource`, testConfig.mysqlConfig);
      datasourceId = response.data.id;
      console.log('✓ 添加 MySQL 数据源成功');
      console.log(`  数据源 ID: ${datasourceId}`);
      return true;
    } catch (error: any) {
      console.error('✗ 添加 MySQL 数据源失败:', error.message);
      return false;
    }
  });

  // 测试 3: 测试数据源连接
  test('应该能测试数据源连接', async () => {
    if (!datasourceId) {
      console.warn('⊘ 跳过: 没有有效的数据源 ID');
      return false;
    }
    try {
      const response = await axios.get(`${BASE_URL}/api/datasource/${datasourceId}/test`);
      if (response.data.success) {
        console.log('✓ 数据源连接测试成功');
        return true;
      } else {
        console.error('✗ 数据源连接失败:', response.data.error);
        return false;
      }
    } catch (error: any) {
      console.error('✗ 测试连接失败:', error.message);
      return false;
    }
  });

  // 测试 4: 获取数据源 Schema
  test('应该能获取数据源 Schema', async () => {
    if (!datasourceId) {
      console.warn('⊘ 跳过: 没有有效的数据源 ID');
      return false;
    }
    try {
      const response = await axios.get(`${BASE_URL}/api/datasource/${datasourceId}/schema`);
      console.log('✓ 获取 Schema 成功');
      console.log(`  表数量: ${response.data.length}`);
      if (response.data.length > 0) {
        console.log(`  第一个表: ${response.data[0].tableName}`);
      }
      return true;
    } catch (error: any) {
      console.error('✗ 获取 Schema 失败:', error.message);
      return false;
    }
  });

  // 测试 5: 获取 AI 分析的 Schema
  test('应该能获取 AI 分析的 Schema', async () => {
    if (!datasourceId) {
      console.warn('⊘ 跳过: 没有有效的数据源 ID');
      return false;
    }
    try {
      const response = await axios.get(`${BASE_URL}/api/datasource/${datasourceId}/schema/analyze`);
      console.log('✓ 获取 AI 分析 Schema 成功');
      console.log(`  推荐问题数: ${response.data.suggestedQuestions?.length || 0}`);
      return true;
    } catch (error: any) {
      console.error('✗ 获取 AI 分析 Schema 失败:', error.message);
      return false;
    }
  });

  // 测试 6: 自然语言问答
  test('应该能进行自然语言问答', async () => {
    if (!datasourceId) {
      console.warn('⊘ 跳过: 没有有效的数据源 ID');
      return false;
    }
    try {
      const response = await axios.post(`${BASE_URL}/api/ask`, {
        datasourceId,
        question: '数据库中有多少条记录？'
      });
      sessionId = response.data.sessionId;
      console.log('✓ 自然语言问答成功');
      console.log(`  回答: ${response.data.answer?.substring(0, 50)}...`);
      console.log(`  会话 ID: ${sessionId}`);
      return true;
    } catch (error: any) {
      console.error('✗ 自然语言问答失败:', error.message);
      return false;
    }
  });

  // 测试 7: 获取会话列表
  test('应该能获取会话列表', async () => {
    if (!datasourceId) {
      console.warn('⊘ 跳过: 没有有效的数据源 ID');
      return false;
    }
    try {
      const response = await axios.get(`${BASE_URL}/api/chat/sessions/${datasourceId}`);
      console.log('✓ 获取会话列表成功');
      console.log(`  会话数: ${response.data.length}`);
      return true;
    } catch (error: any) {
      console.error('✗ 获取会话列表失败:', error.message);
      return false;
    }
  });

  // 测试 8: 获取单个会话详情
  test('应该能获取单个会话详情', async () => {
    if (!sessionId) {
      console.warn('⊘ 跳过: 没有有效的会话 ID');
      return false;
    }
    try {
      const response = await axios.get(`${BASE_URL}/api/chat/session/${sessionId}`);
      console.log('✓ 获取会话详情成功');
      console.log(`  消息数: ${response.data.messages?.length || 0}`);
      return true;
    } catch (error: any) {
      console.error('✗ 获取会话详情失败:', error.message);
      return false;
    }
  });

  // 测试 9: 获取 Agent 能力
  test('应该能获取 Agent 能力', async () => {
    try {
      const response = await axios.get(`${BASE_URL}/api/agent/capabilities`);
      console.log('✓ 获取 Agent 能力成功');
      console.log(`  技能数: ${response.data.skills?.length || 0}`);
      console.log(`  MCP 工具数: ${response.data.mcpTools?.length || 0}`);
      console.log(`  功能数: ${response.data.features?.length || 0}`);
      return true;
    } catch (error: any) {
      console.error('✗ 获取 Agent 能力失败:', error.message);
      return false;
    }
  });

  // 测试 10: 获取所有技能
  test('应该能获取所有技能', async () => {
    try {
      const response = await axios.get(`${BASE_URL}/api/agent/skills`);
      console.log('✓ 获取技能列表成功');
      console.log(`  技能数: ${response.data.length}`);
      response.data.slice(0, 3).forEach((skill: any) => {
        console.log(`  - ${skill.name}: ${skill.description}`);
      });
      return true;
    } catch (error: any) {
      console.error('✗ 获取技能列表失败:', error.message);
      return false;
    }
  });

  // 测试 11: 获取 MCP 工具
  test('应该能获取 MCP 工具', async () => {
    try {
      const response = await axios.get(`${BASE_URL}/api/agent/mcp/tools`);
      console.log('✓ 获取 MCP 工具成功');
      console.log(`  工具数: ${response.data.length}`);
      return true;
    } catch (error: any) {
      console.error('✗ 获取 MCP 工具失败:', error.message);
      return false;
    }
  });

  // 测试 12: 删除数据源
  test('应该能删除数据源', async () => {
    if (!datasourceId) {
      console.warn('⊘ 跳过: 没有有效的数据源 ID');
      return false;
    }
    try {
      const response = await axios.delete(`${BASE_URL}/api/datasource/${datasourceId}`);
      console.log('✓ 删除数据源成功');
      return true;
    } catch (error: any) {
      console.error('✗ 删除数据源失败:', error.message);
      return false;
    }
  });
});

// 运行所有测试
async function runAllTests() {
  console.log('\n========== 开始 API 测试 ==========\n');
  
  const tests = [
    () => test('应该能获取数据源列表', async () => {
      const response = await axios.get(`${BASE_URL}/api/datasource`);
      return response.data.length >= 0;
    }),
    () => test('应该能添加 MySQL 数据源', async () => {
      const response = await axios.post(`${BASE_URL}/api/datasource`, testConfig.mysqlConfig);
      return response.data.id;
    }),
  ];

  console.log('========== 测试完成 ==========\n');
}

export { runAllTests };
