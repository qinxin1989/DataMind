const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
let authToken = '';

// 登录获取认证令牌
async function login() {
  try {
    const response = await axios.post(`${BASE_URL}/api/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    
    if (response.data && response.data.token) {
      authToken = response.data.token;
      console.log('✅ 登录成功，获取到认证令牌');
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ 登录失败:', error.message);
    return false;
  }
}

// 测试AI模型回答问题
async function testAIModel() {
  if (!authToken) {
    console.error('❌ 请先登录');
    return;
  }
  
  try {
    console.log('🔍 正在测试AI模型...');
    
    const response = await axios.post(`${BASE_URL}/api/admin/ai-qa/ask`, {
      datasourceId: '世界数据库', // 使用显示名称而不是ID
      question: '你好，我是本地化部署的Qwen3-32B模型吗？'
    }, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });
    
    console.log('✅ AI模型测试结果:');
    console.log('AI回答:', response.data.data.answer);
    console.log('使用的模型:', response.data.data.modelName);
    console.log('响应时间:', response.data.data.responseTime, 'ms');
    console.log('会话ID:', response.data.data.sessionId);
    
  } catch (error) {
    console.error('❌ AI模型测试失败:', error.response?.data?.error?.message || error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', error.response.data);
    }
  }
}

// 测试模型列表
async function testGetModels() {
  if (!authToken) {
    console.error('❌ 请先登录');
    return;
  }
  
  try {
    const response = await axios.get(`${BASE_URL}/api/admin/ai/configs`, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });
    
    console.log('✅ AI配置列表:');
    response.data.data.forEach(config => {
      console.log(`- ${config.name} (${config.provider}) - ${config.model} ${config.isDefault ? '(默认)' : ''}`);
    });
    
  } catch (error) {
    console.error('❌ 获取AI配置列表失败:', error.response?.data?.error?.message || error.message);
  }
}

// 测试获取数据源列表
async function testGetDataSources() {
  if (!authToken) {
    console.error('❌ 请先登录');
    return;
  }
  
  try {
    const response = await axios.get(`${BASE_URL}/api/admin/ai-qa/datasources`, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });
    
    console.log('✅ 数据源列表:');
    response.data.data.forEach(datasource => {
      console.log(`- ${datasource.name} (ID: ${datasource.id})`);
    });
    
    return response.data.data;
  } catch (error) {
    console.error('❌ 获取数据源列表失败:', error.response?.data?.error?.message || error.message);
    return [];
  }
}

// 执行测试
async function runTests() {
  console.log('🚀 开始测试本地化部署的大模型...');
  
  // 步骤1: 登录
  const loggedIn = await login();
  if (!loggedIn) return;
  
  // 步骤2: 获取AI配置列表
  await testGetModels();
  
  // 步骤3: 获取数据源列表
  const datasources = await testGetDataSources();
  
  // 步骤4: 测试AI模型
  if (datasources.length > 0) {
    // 使用第一个数据源
    const testDatasource = datasources[0];
    console.log(`\n🔍 使用数据源: ${testDatasource.name} (${testDatasource.id})`);
    
    try {
      const response = await axios.post(`${BASE_URL}/api/admin/ai-qa/ask`, {
        datasourceId: testDatasource.id,
        question: '直接回答：你使用的是哪个AI模型？请直接给出模型名称。'
      }, {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      
      console.log('✅ AI模型测试结果:');
      console.log('AI回答:', response.data.data.answer);
      console.log('使用的模型:', response.data.data.modelName);
      console.log('响应时间:', response.data.data.responseTime, 'ms');
      console.log('会话ID:', response.data.data.sessionId);
      console.log('工具使用:', response.data.data.toolUsed);
      console.log('技能使用:', response.data.data.skillUsed);
      
    } catch (error) {
      console.error('❌ AI模型测试失败:', error.response?.data?.error?.message || error.message);
      if (error.response) {
        console.error('响应状态:', error.response.status);
        console.error('响应数据:', error.response.data);
      }
    }
  } else {
    console.error('❌ 没有可用的数据源，无法测试AI模型');
  }
  
  console.log('\n🎉 测试完成！');
}

runTests();
