/**
 * 修复公共数据源的审核状态
 */

import axios from 'axios';

const API_BASE = 'http://localhost:3000/api';

// 管理员登录获取 token
async function login() {
  const res = await axios.post(`${API_BASE}/auth/login`, {
    username: 'admin',
    password: 'admin123'
  });
  return res.data.token;
}

// 获取所有数据源
async function getDatasources(token: string) {
  const res = await axios.get(`${API_BASE}/datasource`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
}

// 修复数据源审核状态
async function fixDatasource(token: string, id: string) {
  const res = await axios.post(`${API_BASE}/datasource/${id}/fix-approval`, {}, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
}

async function main() {
  try {
    console.log('1. 登录...');
    const token = await login();
    console.log('登录成功');

    console.log('\n2. 获取数据源列表...');
    const datasources = await getDatasources(token);
    console.log(`找到 ${datasources.length} 个数据源`);

    console.log('\n3. 修复公共数据源的审核状态...');
    for (const ds of datasources) {
      if (ds.visibility === 'public') {
        console.log(`\n修复数据源: ${ds.name} (${ds.id})`);
        const result = await fixDatasource(token, ds.id);
        console.log(`结果: ${result.message}`);
      }
    }

    console.log('\n完成！');
  } catch (error: any) {
    console.error('错误:', error.response?.data || error.message);
  }
}

main();
