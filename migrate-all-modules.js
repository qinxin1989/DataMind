/**
 * 完整迁移所有模块到新的模块系统
 */

const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function migrateAllModules() {
  let connection;
  
  try {
    console.log('正在连接数据库...');
    
    connection = await mysql.createConnection({
      host: process.env.CONFIG_DB_HOST || 'localhost',
      port: parseInt(process.env.CONFIG_DB_PORT || '3306'),
      user: process.env.CONFIG_DB_USER || 'root',
      password: process.env.CONFIG_DB_PASSWORD || '',
      database: process.env.CONFIG_DB_NAME || 'DataMind',
      charset: 'utf8mb4'
    });
    
    console.log('数据库连接成功');
    
    // 清理现有模块数据
    console.log('清理现有模块数据...');
    await connection.execute('DELETE FROM sys_module_api_endpoints');
    await connection.execute('DELETE FROM sys_module_frontend');
    await connection.execute('DELETE FROM sys_module_backend');
    await connection.execute('DELETE FROM sys_module_menus');
    await connection.execute('DELETE FROM sys_module_permissions');
    await connection.execute('DELETE FROM sys_module_dependencies');
    await connection.execute('DELETE FROM sys_module_tags');
    await connection.execute('DELETE FROM sys_modules');
    await connection.execute('DELETE FROM sys_menus WHERE module_name IS NOT NULL');
    
    // 读取所有模块目录
    const modulesDir = path.join(__dirname, 'modules');
    const moduleNames = fs.readdirSync(modulesDir).filter(name => {
      const modulePath = path.join(modulesDir, name);
      return fs.statSync(modulePath).isDirectory();
    });
    
    console.log(`发现 ${moduleNames.length} 个模块`);
    
    for (const moduleName of moduleNames) {
      try {
        const moduleJsonPath = path.join(modulesDir, moduleName, 'module.json');
        
        if (!fs.existsSync(moduleJsonPath)) {
          console.log(`跳过模块 ${moduleName}: 没有 module.json 文件`);
          continue;
        }
        
        const moduleJson = JSON.parse(fs.readFileSync(moduleJsonPath, 'utf-8'));
        
        // 跳过禁用的模块
        if (moduleJson.enabled === false) {
          console.log(`跳过模块 ${moduleName}: 模块被禁用`);
          continue;
        }
        
        console.log(`迁移模块: ${moduleJson.displayName || moduleJson.name || moduleName}`);
        
        // 标准化模块数据
        const manifest = {
          name: moduleJson.name || moduleName,
          displayName: moduleJson.displayName || moduleJson.name || moduleName,
          version: moduleJson.version || '1.0.0',
          description: moduleJson.description || '',
          author: moduleJson.author || 'System',
          license: moduleJson.license || 'MIT',
          type: moduleJson.type || 'business',
          category: moduleJson.category || 'general',
          tags: moduleJson.tags || [],
          dependencies: moduleJson.dependencies || {},
          permissions: moduleJson.permissions || [],
          menus: moduleJson.menus || [],
          backend: moduleJson.backend,
          frontend: moduleJson.frontend,
          api: moduleJson.api
        };
        
        // 插入主模块记录
        const moduleId = uuidv4();
        await connection.execute(
          `INSERT INTO sys_modules (id, name, display_name, version, description, author, license, type, category, status, installed_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'installed', NOW())`,
          [moduleId, manifest.name, manifest.displayName, manifest.version, manifest.description, manifest.author, manifest.license, manifest.type, manifest.category]
        );
        
        // 插入标签
        if (Array.isArray(manifest.tags)) {
          for (const tag of manifest.tags) {
            await connection.execute(
              `INSERT INTO sys_module_tags (id, module_name, tag) VALUES (?, ?, ?)`,
              [uuidv4(), manifest.name, tag]
            );
          }
        }
        
        // 插入依赖关系
        if (manifest.dependencies && typeof manifest.dependencies === 'object') {
          for (const [depName, versionRange] of Object.entries(manifest.dependencies)) {
            await connection.execute(
              `INSERT INTO sys_module_dependencies (id, module_name, dependency_name, version_range) VALUES (?, ?, ?, ?)`,
              [uuidv4(), manifest.name, depName, versionRange]
            );
          }
        }
        
        // 插入权限
        if (Array.isArray(manifest.permissions)) {
          for (const perm of manifest.permissions) {
            // 创建权限记录
            await connection.execute(
              `INSERT IGNORE INTO sys_permissions (id, code, name, description, module_name, created_at) VALUES (?, ?, ?, ?, ?, NOW())`,
              [uuidv4(), perm.code, perm.name, perm.description || '', manifest.name]
            );
            
            // 插入模块权限关联
            await connection.execute(
              `INSERT INTO sys_module_permissions (id, module_name, code, name, description) VALUES (?, ?, ?, ?, ?)`,
              [uuidv4(), manifest.name, perm.code, perm.name, perm.description || '']
            );
            
            // 给admin角色分配权限
            const [adminRoles] = await connection.execute('SELECT id FROM sys_roles WHERE code = ?', ['admin']);
            if (adminRoles.length > 0) {
              await connection.execute(
                `INSERT IGNORE INTO sys_role_permissions (role_id, permission_code) VALUES (?, ?)`,
                [adminRoles[0].id, perm.code]
              );
            }
          }
        }
        
        // 插入菜单
        if (Array.isArray(manifest.menus)) {
          for (const menu of manifest.menus) {
            // 插入模块菜单
            await connection.execute(
              `INSERT INTO sys_module_menus (id, module_name, menu_id, title, path, icon, parent_id, sort_order, permission_code) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [uuidv4(), manifest.name, menu.id, menu.title, menu.path, menu.icon || null, menu.parentId || null, menu.sortOrder || 0, menu.permission || null]
            );
            
            // 插入系统菜单
            await connection.execute(
              `INSERT IGNORE INTO sys_menus (id, title, path, icon, parent_id, sort_order, permission_code, module_name, created_at, updated_at) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
              [menu.id, menu.title, menu.path, menu.icon || null, menu.parentId || null, menu.sortOrder || 0, menu.permission || null, manifest.name]
            );
          }
        }
        
        // 插入后端配置
        if (manifest.backend) {
          await connection.execute(
            `INSERT INTO sys_module_backend (id, module_name, entry_file, routes_prefix, routes_file) VALUES (?, ?, ?, ?, ?)`,
            [uuidv4(), manifest.name, manifest.backend.entry || './backend/index.ts', manifest.backend.routes?.prefix || null, manifest.backend.routes?.file || null]
          );
        }
        
        // 插入前端配置
        if (manifest.frontend) {
          await connection.execute(
            `INSERT INTO sys_module_frontend (id, module_name, entry_file, routes_file) VALUES (?, ?, ?, ?)`,
            [uuidv4(), manifest.name, manifest.frontend.entry || './frontend/index.ts', manifest.frontend.routes || null]
          );
        }
        
        // 插入API端点
        if (manifest.api && manifest.api.endpoints && Array.isArray(manifest.api.endpoints)) {
          for (const endpoint of manifest.api.endpoints) {
            await connection.execute(
              `INSERT INTO sys_module_api_endpoints (id, module_name, method, path, description, permission_code) VALUES (?, ?, ?, ?, ?, ?)`,
              [uuidv4(), manifest.name, endpoint.method, endpoint.path, endpoint.description || null, endpoint.permission || null]
            );
          }
        }
        
        console.log(`✅ 模块 ${manifest.displayName} 迁移完成`);
        
      } catch (error) {
        console.error(`❌ 模块 ${moduleName} 迁移失败:`, error.message);
      }
    }
    
    console.log('\n🎉 所有模块迁移完成！');
    
    // 显示统计信息
    const [moduleCount] = await connection.execute('SELECT COUNT(*) as count FROM sys_modules');
    const [menuCount] = await connection.execute('SELECT COUNT(*) as count FROM sys_menus WHERE module_name IS NOT NULL');
    const [permCount] = await connection.execute('SELECT COUNT(*) as count FROM sys_permissions WHERE module_name IS NOT NULL');
    
    console.log(`📊 迁移统计:`);
    console.log(`   - 模块数量: ${moduleCount[0].count}`);
    console.log(`   - 菜单数量: ${menuCount[0].count}`);
    console.log(`   - 权限数量: ${permCount[0].count}`);
    
  } catch (error) {
    console.error('迁移失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

migrateAllModules();