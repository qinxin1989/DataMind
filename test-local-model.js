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

// 设置默认AI配置
async function setDefaultModel(modelId) {
  if (!authToken) {
    console.error('❌ 请先登录');
    return;
  }
  
  try {
    const response = await axios.put(`${BASE_URL}/api/admin/ai/configs/${modelId}/default`, {}, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });
    
    console.log('✅ 成功设置默认模型');
    return response.data.success;
  } catch (error) {
    console.error('❌ 设置默认模型失败:', error.response?.data?.error?.message || error.message);
    return false;
  }
}

// 测试使用本地模型
async function testLocalModel(datasourceId) {
  if (!authToken) {
    console.error('❌ 请先登录');
    return;
  }
  
  try {
    console.log('🔍 正在使用本地Qwen3-32B模型进行测试...');
    
    const response = await axios.post(`${BASE_URL}/api/admin/ai-qa/ask`, {
      datasourceId: datasourceId,
      question: '简单介绍一下自己，包括你使用的模型名称'
    }, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });
    
    console.log('✅ 本地模型测试结果:');
    console.log('AI回答:', response.data.data.answer);
    console.log('使用的模型:', response.data.data.modelName);
    console.log('响应时间:', response.data.data.responseTime, 'ms');
    
  } catch (error) {
    console.error('❌ 本地模型测试失败:', error.response?.data?.error?.message || error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', error.response.data);
    }
  }
}

// 执行测试
async function runTests() {
  console.log('🚀 开始测试本地Qwen3-32B模型...');
  
  // 步骤1: 登录
  const loggedIn = await login();
  if (!loggedIn) return;
  
  // 步骤2: 获取AI配置列表
  console.log('🔍 获取AI配置列表...');
  let localModelId = null;
  
  try {
    const response = await axios.get(`${BASE_URL}/api/admin/ai/configs`, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });
    
    console.log('✅ AI配置列表:');
    response.data.data.forEach(config => {
      console.log(`- ${config.name} (${config.provider}) - ${config.model} ${config.isDefault ? '(默认)' : ''} (ID: ${config.id})`);
      
      // 找到本地Qwen3-32B模型
      if (config.provider === 'local-qwen' && config.model === 'qwen3-32b') {
        localModelId = config.id;
      }
    });
    
  } catch (error) {
    console.error('❌ 获取AI配置列表失败:', error.response?.data?.error?.message || error.message);
    return;
  }
  
  if (!localModelId) {
    console.error('❌ 未找到本地Qwen3-32B模型配置');
    return;
  }
  
  // 步骤3: 设置本地模型为默认
  await setDefaultModel(localModelId);
  
  // 步骤4: 获取数据源列表
  console.log('🔍 获取数据源列表...');
  let datasourceId = null;
  
  try {
    const response = await axios.get(`${BASE_URL}/api/admin/ai-qa/datasources`, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });
    
    if (response.data.data.length > 0) {
      const testDatasource = response.data.data[0];
      datasourceId = testDatasource.id;
      console.log(`✅ 使用数据源: ${testDatasource.name} (${testDatasource.id})`);
    } else {
      console.error('❌ 没有可用的数据源');
      return;
    }
    
  } catch (error) {
    console.error('❌ 获取数据源列表失败:', error.response?.data?.error?.message || error.message);
    return;
  }
  
  // 步骤5: 测试本地模型
  await testLocalModel(datasourceId);
  
  console.log('\n🎉 本地模型测试完成！');
}

runTests();
