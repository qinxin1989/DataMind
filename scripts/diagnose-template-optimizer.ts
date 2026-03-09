import { pool } from '../src/admin/core/database';

async function diagnose() {
  const conn = await pool.getConnection();
  try {
    console.log('=== 诊断模板优化器问题 ===\n');
    
    // 1. 检查模板优化菜单
    const [menu] = await conn.execute(
      "SELECT * FROM sys_menus WHERE id = 'template-optimizer'"
    );
    console.log('1. 模板优化菜单:', (menu as any[])[0] || '未找到');
    
    // 2. 检查数据源列表API是否正常
    try {
      const response = await fetch('http://localhost:3000/api/admin/datasources', {
        headers: {
          'Authorization': 'Bearer test-token'
        }
      });
      console.log('\n2. 数据源API状态:', response.status);
      if (response.status === 401) {
        console.log('   → 401错误：认证失败，需要重新登录');
      } else if (response.status === 404) {
        console.log('   → 404错误：路由未注册，请重启后端服务');
      }
    } catch (e: any) {
      console.log('\n2. 数据源API错误:', e.message);
      console.log('   → 后端服务可能未启动');
    }
    
    // 3. 检查模板优化器路由
    try {
      const response = await fetch('http://localhost:3000/api/admin/template-optimizer/status', {
        headers: {
          'Authorization': 'Bearer test-token'
        }
      });
      console.log('\n3. 模板优化器API状态:', response.status);
      if (response.status === 404) {
        console.log('   → 模板优化器路由未注册，请检查 src/admin/index.ts 中的路由注册');
      }
    } catch (e: any) {
      console.log('\n3. 模板优化器API错误:', e.message);
    }
    
    console.log('\n=== 建议 ===');
    console.log('如果看到404错误，请：');
    console.log('  1. 确保已重启后端服务: npm run dev');
    console.log('  2. 检查控制台是否有 "[Admin] Template optimizer routes registered" 输出');
    console.log('如果看到401错误，请：');
    console.log('  1. 重新登录系统获取新的token');
    
  } catch (e) {
    console.error('诊断错误:', e);
  } finally {
    conn.release();
    pool.end();
  }
}

diagnose();
