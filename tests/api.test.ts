import axios from 'axios';
import { describe, it, expect } from 'vitest';

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

// 全局变量
let authToken: string = '';
let datasourceId: string = '';
let sessionId: string = '';

// 认证辅助函数
async function authenticate() {
  try {
    // 尝试注册测试用户
    const registerResponse = await axios.post(`${BASE_URL}/api/auth/register`, {
      username: `testuser_${Date.now()}`,
      password: 'testpass123',
      email: 'test@example.com',
      fullName: 'Test User'
    }).catch(() => null);

    if (registerResponse) {
      authToken = registerResponse.data.token;
      console.log('✓ 注册新用户成功');
      return true;
    }

    // 如果注册失败，尝试登录
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      username: 'testuser',
      password: 'testpass123'
    }).catch(() => null);

    if (loginResponse) {
      authToken = loginResponse.data.token;
      console.log('✓ 登录成功');
      return true;
    }

    console.error('✗ 认证失败');
    return false;
  } catch (error: any) {
    console.error('✗ 认证错误:', error.message);
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

describe('API Integration Tests', () => {
  // 测试 1: 获取数据源列表
  it('应该能获取数据源列表', async () => {
    try {
      const response = await axios.get(`${BASE_URL}/api/datasource`, getAuthHeaders());
      console.log('✓ 获取数据源列表成功');
      console.log(`  数据源数量: ${response.data.length}`);
      expect(response.status).toBe(200);
    } catch (error: any) {
      console.error('✗ 获取数据源列表失败:', error.message);
      throw error;
    }
  });

  // 测试 2: 添加 MySQL 数据源
  it('应该能添加 MySQL 数据源', async () => {
    try {
      const response = await axios.post(`${BASE_URL}/api/datasource`, testConfig.mysqlConfig, getAuthHeaders());
      datasourceId = response.data.id;
      console.log('✓ 添加 MySQL 数据源成功');
      console.log(`  数据源 ID: ${datasourceId}`);
      expect(response.status).toBe(200);
      expect(datasourceId).toBeDefined();
    } catch (error: any) {
      console.error('✗ 添加 MySQL 数据源失败:', error.message);
      throw error;
    }
  });

  // 测试 3: 测试数据源连接
  it('应该能测试数据源连接', async () => {
    if (!datasourceId) {
      console.warn('⊘ 跳过: 没有有效的数据源 ID');
      return;
    }
    try {
      const response = await axios.get(`${BASE_URL}/api/datasource/${datasourceId}/test`, getAuthHeaders());
      if (response.data.success) {
        console.log('✓ 数据源连接测试成功');
        expect(response.data.success).toBe(true);
      } else {
        console.error('✗ 数据源连接失败:', response.data.error);
      }
    } catch (error: any) {
      console.error('✗ 测试连接失败:', error.message);
      throw error;
    }
  });

  // 测试 4: 获取数据源 Schema
  it('应该能获取数据源 Schema', async () => {
    if (!datasourceId) {
      console.warn('⊘ 跳过: 没有有效的数据源 ID');
      return;
    }
    try {
      const response = await axios.get(`${BASE_URL}/api/datasource/${datasourceId}/schema`, getAuthHeaders());
      console.log('✓ 获取 Schema 成功');
      console.log(`  表数量: ${response.data.length}`);
      if (response.data.length > 0) {
        console.log(`  第一个表: ${response.data[0].tableName}`);
      }
      expect(response.status).toBe(200);
    } catch (error: any) {
      console.error('✗ 获取 Schema 失败:', error.message);
      throw error;
    }
  });

  // 测试 5: 获取 AI 分析的 Schema
  it('应该能获取 AI 分析的 Schema', async () => {
    if (!datasourceId) {
      console.warn('⊘ 跳过: 没有有效的数据源 ID');
      return;
    }
    try {
      const response = await axios.get(`${BASE_URL}/api/datasource/${datasourceId}/schema/analyze`, getAuthHeaders());
      console.log('✓ 获取 AI 分析 Schema 成功');
      console.log(`  推荐问题数: ${response.data.suggestedQuestions?.length || 0}`);
      expect(response.status).toBe(200);
    } catch (error: any) {
      console.error('✗ 获取 AI 分析 Schema 失败:', error.message);
      throw error;
    }
  });

  // 测试 6: 自然语言问答
  it('应该能进行自然语言问答', async () => {
    if (!datasourceId) {
      console.warn('⊘ 跳过: 没有有效的数据源 ID');
      return;
    }
    try {
      const response = await axios.post(`${BASE_URL}/api/ask`, {
        datasourceId,
        question: '数据库中有多少条记录？'
      }, getAuthHeaders());
      sessionId = response.data.sessionId;
      console.log('✓ 自然语言问答成功');
      console.log(`  回答: ${response.data.answer?.substring(0, 50)}...`);
      console.log(`  会话 ID: ${sessionId}`);
      expect(response.status).toBe(200);
    } catch (error: any) {
      console.error('✗ 自然语言问答失败:', error.message);
      throw error;
    }
  });

  // 测试 7: 获取会话列表
  it('应该能获取会话列表', async () => {
    if (!datasourceId) {
      console.warn('⊘ 跳过: 没有有效的数据源 ID');
      return;
    }
    try {
      const response = await axios.get(`${BASE_URL}/api/chat/sessions/${datasourceId}`, getAuthHeaders());
      console.log('✓ 获取会话列表成功');
      console.log(`  会话数: ${response.data.length}`);
      expect(response.status).toBe(200);
    } catch (error: any) {
      console.error('✗ 获取会话列表失败:', error.message);
      throw error;
    }
  });

  // 测试 8: 获取单个会话详情
  it('应该能获取单个会话详情', async () => {
    if (!sessionId) {
      console.warn('⊘ 跳过: 没有有效的会话 ID');
      return;
    }
    try {
      const response = await axios.get(`${BASE_URL}/api/chat/session/${sessionId}`, getAuthHeaders());
      console.log('✓ 获取会话详情成功');
      console.log(`  消息数: ${response.data.messages?.length || 0}`);
      expect(response.status).toBe(200);
    } catch (error: any) {
      console.error('✗ 获取会话详情失败:', error.message);
      throw error;
    }
  });

  // 测试 9: 获取 Agent 能力
  it('应该能获取 Agent 能力', async () => {
    try {
      const response = await axios.get(`${BASE_URL}/api/agent/capabilities`, getAuthHeaders());
      console.log('✓ 获取 Agent 能力成功');
      console.log(`  技能数: ${response.data.skills?.length || 0}`);
      console.log(`  MCP 工具数: ${response.data.mcpTools?.length || 0}`);
      console.log(`  功能数: ${response.data.features?.length || 0}`);
      expect(response.status).toBe(200);
    } catch (error: any) {
      console.error('✗ 获取 Agent 能力失败:', error.message);
      throw error;
    }
  });

  // 测试 10: 获取所有技能
  it('应该能获取所有技能', async () => {
    try {
      const response = await axios.get(`${BASE_URL}/api/agent/skills`, getAuthHeaders());
      console.log('✓ 获取技能列表成功');
      console.log(`  技能数: ${response.data.length}`);
      response.data.slice(0, 3).forEach((skill: any) => {
        console.log(`  - ${skill.name}: ${skill.description}`);
      });
      expect(response.status).toBe(200);
    } catch (error: any) {
      console.error('✗ 获取技能列表失败:', error.message);
      throw error;
    }
  });

  // 测试 11: 获取 MCP 工具
  it('应该能获取 MCP 工具', async () => {
    try {
      const response = await axios.get(`${BASE_URL}/api/agent/mcp/tools`, getAuthHeaders());
      console.log('✓ 获取 MCP 工具成功');
      console.log(`  工具数: ${response.data.length}`);
      expect(response.status).toBe(200);
    } catch (error: any) {
      console.error('✗ 获取 MCP 工具失败:', error.message);
      throw error;
    }
  });

  // 测试 12: 删除数据源
  it('应该能删除数据源', async () => {
    if (!datasourceId) {
      console.warn('⊘ 跳过: 没有有效的数据源 ID');
      return;
    }
    try {
      const response = await axios.delete(`${BASE_URL}/api/datasource/${datasourceId}`, getAuthHeaders());
      console.log('✓ 删除数据源成功');
      expect(response.status).toBe(200);
    } catch (error: any) {
      console.error('✗ 删除数据源失败:', error.message);
      throw error;
    }
  });
});

// 运行所有测试
async function runAllTests() {
  console.log('\n========== 开始 API 测试 ==========\n');
  
  // 先进行认证
  const authenticated = await authenticate();
  if (!authenticated) {
    console.error('认证失败，无法继续测试');
    return;
  }

  console.log('\n========== 测试完成 ==========\n');
}

export { runAllTests };
