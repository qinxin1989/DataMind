/**
 * 测试爬虫模块路由配置
 */

const fs = require('fs');
const path = require('path');

// 读取三个爬虫模块的配置
const modules = [
  'ai-crawler-assistant',
  'crawler-template-config',
  'crawler-management'
];

console.log('=== 爬虫模块路由配置检查 ===\n');

modules.forEach(moduleName => {
  const modulePath = path.join(__dirname, 'modules', moduleName, 'module.json');
  
  try {
    const config = JSON.parse(fs.readFileSync(modulePath, 'utf8'));
    
    console.log(`\n模块: ${moduleName}`);
    console.log(`显示名称: ${config.displayName || config.name}`);
    console.log(`启用状态: ${config.enabled ? '✅ 已启用' : '❌ 未启用'}`);
    
    if (config.backend?.routes) {
      console.log(`路由前缀: ${config.backend.routes.prefix || '(无)'}`);
      console.log(`路由文件: ${config.backend.routes.file || '(无)'}`);
    }
    
    if (config.routes?.backend) {
      console.log(`\n后端路由 (${config.routes.backend.length}个):`);
      config.routes.backend.forEach(route => {
        const fullPath = config.backend?.routes?.prefix 
          ? `${config.backend.routes.prefix}${route.path}`
          : route.path;
        console.log(`  ${route.method.padEnd(6)} ${fullPath}`);
      });
    }
    
    console.log('-'.repeat(60));
  } catch (error) {
    console.error(`❌ 读取模块 ${moduleName} 失败:`, error.message);
  }
});

console.log('\n=== 路由统一性检查 ===\n');

// 检查所有路由是否统一使用 /admin/ai 前缀
let allUnified = true;
const expectedPrefix = '/admin/ai';

modules.forEach(moduleName => {
  const modulePath = path.join(__dirname, 'modules', moduleName, 'module.json');
  const config = JSON.parse(fs.readFileSync(modulePath, 'utf8'));
  
  const actualPrefix = config.backend?.routes?.prefix;
  if (actualPrefix !== expectedPrefix) {
    console.log(`❌ ${moduleName}: 前缀不一致 (期望: ${expectedPrefix}, 实际: ${actualPrefix || '(无)'})`);
    allUnified = false;
  } else {
    console.log(`✅ ${moduleName}: 前缀正确 (${actualPrefix})`);
  }
});

if (allUnified) {
  console.log('\n✅ 所有爬虫模块路由前缀已统一为 /admin/ai');
} else {
  console.log('\n❌ 路由前缀不统一,需要修复');
}

console.log('\n=== 路由路径检查 ===\n');

// 检查路由路径是否都以 /crawler 开头
modules.forEach(moduleName => {
  const modulePath = path.join(__dirname, 'modules', moduleName, 'module.json');
  const config = JSON.parse(fs.readFileSync(modulePath, 'utf8'));
  
  if (config.routes?.backend) {
    let allCorrect = true;
    const incorrectRoutes = [];
    
    config.routes.backend.forEach(route => {
      // 检查路径是否以 /crawler 开头或者是 /execute (特殊情况)
      if (!route.path.startsWith('/crawler') && route.path !== '/execute') {
        allCorrect = false;
        incorrectRoutes.push(route.path);
      }
    });
    
    if (allCorrect) {
      console.log(`✅ ${moduleName}: 所有路由路径正确`);
    } else {
      console.log(`❌ ${moduleName}: 以下路由路径不正确:`);
      incorrectRoutes.forEach(p => console.log(`   - ${p}`));
    }
  }
});

console.log('\n=== 检查完成 ===\n');
