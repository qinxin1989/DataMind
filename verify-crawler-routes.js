/**
 * 验证爬虫模块路由配置
 */

const fs = require('fs');
const path = require('path');

console.log('=== 爬虫模块路由配置验证 ===\n');

const modules = [
  { name: 'ai-crawler-assistant', displayName: 'AI爬虫助手' },
  { name: 'crawler-template-config', displayName: '采集模板配置' },
  { name: 'crawler-management', displayName: '爬虫管理' }
];

let allPassed = true;

modules.forEach(({ name, displayName }) => {
  console.log(`\n📦 模块: ${displayName} (${name})`);
  console.log('─'.repeat(60));
  
  const modulePath = path.join(__dirname, 'modules', name, 'module.json');
  
  try {
    const config = JSON.parse(fs.readFileSync(modulePath, 'utf8'));
    
    // 检查1: 模块是否启用
    if (config.enabled === true) {
      console.log('✅ 模块已启用');
    } else {
      console.log('❌ 模块未启用');
      allPassed = false;
    }
    
    // 检查2: 路由前缀配置
    const expectedPrefix = '/admin/ai';
    const actualPrefix = config.backend?.routes?.prefix;
    
    if (actualPrefix === expectedPrefix) {
      console.log(`✅ 路由前缀正确: ${actualPrefix}`);
    } else {
      console.log(`❌ 路由前缀错误: 期望 ${expectedPrefix}, 实际 ${actualPrefix || '(未配置)'}`);
      allPassed = false;
    }
    
    // 检查3: 路由文件配置
    if (config.backend?.routes?.file) {
      console.log(`✅ 路由文件: ${config.backend.routes.file}`);
      
      // 验证路由文件是否存在
      const routeFilePath = path.join(__dirname, 'modules', name, config.backend.routes.file);
      if (fs.existsSync(routeFilePath)) {
        console.log('✅ 路由文件存在');
      } else {
        console.log('❌ 路由文件不存在');
        allPassed = false;
      }
    } else {
      console.log('❌ 未配置路由文件');
      allPassed = false;
    }
    
    // 检查4: 路由路径
    if (config.routes?.backend) {
      const routes = config.routes.backend;
      console.log(`\n📋 后端路由 (${routes.length}个):`);
      
      let routeErrors = 0;
      routes.forEach(route => {
        const fullPath = `${actualPrefix}${route.path}`;
        
        // 检查路径是否以 /crawler 开头或是特殊路径
        const isValidPath = route.path.startsWith('/crawler') || 
                           route.path === '/execute' ||
                           route.path.startsWith('/ai/crawler'); // 兼容旧格式
        
        if (isValidPath) {
          console.log(`  ✅ ${route.method.padEnd(6)} ${fullPath}`);
        } else {
          console.log(`  ❌ ${route.method.padEnd(6)} ${fullPath} (路径格式不正确)`);
          routeErrors++;
          allPassed = false;
        }
      });
      
      if (routeErrors === 0) {
        console.log(`\n✅ 所有路由路径格式正确`);
      } else {
        console.log(`\n❌ 发现 ${routeErrors} 个路由路径格式错误`);
      }
    } else if (config.api?.endpoints) {
      // ai-crawler-assistant 使用 api.endpoints 格式
      console.log(`\n📋 API端点 (${config.api.endpoints.length}个):`);
      console.log('  ℹ️  此模块使用 api.endpoints 配置格式');
      console.log('  ℹ️  实际路由在 backend/routes.ts 中定义');
    } else {
      console.log('❌ 未配置后端路由');
      allPassed = false;
    }
    
  } catch (error) {
    console.error(`❌ 读取模块配置失败: ${error.message}`);
    allPassed = false;
  }
});

console.log('\n' + '='.repeat(60));
console.log('\n📊 验证结果汇总:\n');

if (allPassed) {
  console.log('✅ 所有检查通过!');
  console.log('\n路由配置总结:');
  console.log('  • 所有模块已启用');
  console.log('  • 统一使用 /admin/ai 前缀');
  console.log('  • 路由路径格式正确');
  console.log('\n最终路由格式: /admin/ai/crawler/*');
} else {
  console.log('❌ 存在配置问题,请检查上述错误');
  process.exit(1);
}

console.log('\n' + '='.repeat(60) + '\n');
