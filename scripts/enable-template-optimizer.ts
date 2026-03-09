/**
 * 启用 template-optimizer 模块脚本
 * 直接在数据库中注册并启用模块
 */

import { pool } from '../src/admin/core/database.js';
import fs from 'fs';
import path from 'path';

const MODULE_NAME = 'template-optimizer';

async function enableModule() {
  const conn = await pool.getConnection();
  
  try {
    console.log(`[Module Enabler] 开始启用模块: ${MODULE_NAME}`);
    
    // 1. 检查模块是否已存在
    const [existing] = await conn.execute(
      'SELECT * FROM modules WHERE name = ?',
      [MODULE_NAME]
    ) as any[];
    
    if (existing && existing.length > 0) {
      console.log(`[Module Enabler] 模块已存在，状态: ${existing[0].status}`);
      
      if (existing[0].status === 'enabled') {
        console.log('[Module Enabler] 模块已经是启用状态，无需操作');
        return;
      }
      
      // 更新为启用状态
      await conn.execute(
        'UPDATE modules SET status = ?, updated_at = NOW() WHERE name = ?',
        ['enabled', MODULE_NAME]
      );
      console.log('[Module Enabler] 模块已更新为启用状态');
    } else {
      // 2. 读取模块配置
      const manifestPath = path.join(process.cwd(), 'modules', MODULE_NAME, 'module.json');
      if (!fs.existsSync(manifestPath)) {
        throw new Error(`模块配置文件不存在: ${manifestPath}`);
      }
      
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      
      // 3. 插入模块记录
      await conn.execute(
        `INSERT INTO modules (name, version, status, manifest_path, created_at, updated_at) 
         VALUES (?, ?, ?, ?, NOW(), NOW())`,
        [MODULE_NAME, manifest.version, 'enabled', `modules/${MODULE_NAME}/module.json`]
      );
      console.log('[Module Enabler] 模块已注册到数据库');
    }
    
    // 4. 注册菜单
    const menus = [
      {
        name: '模板优化',
        path: '/template-optimizer',
        icon: 'ThunderboltOutlined',
        permission: 'template:optimize',
        sort_order: 200,
        parent_id: null
      }
    ];
    
    for (const menu of menus) {
      // 检查菜单是否已存在
      const [existingMenu] = await conn.execute(
        'SELECT * FROM sys_menus WHERE path = ?',
        [menu.path]
      ) as any[];
      
      if (existingMenu && existingMenu.length > 0) {
        console.log(`[Module Enabler] 菜单已存在: ${menu.name}`);
        continue;
      }
      
      // 插入菜单
      await conn.execute(
        `INSERT INTO sys_menus (name, path, icon, permission, sort_order, parent_id, status, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, 'enabled', NOW(), NOW())`,
        [menu.name, menu.path, menu.icon, menu.permission, menu.sort_order, menu.parent_id]
      );
      console.log(`[Module Enabler] 菜单已添加: ${menu.name}`);
    }
    
    // 5. 注册权限
    const permissions = [
      { code: 'template:optimize', name: '模板优化', description: '运行SQL模板测试和优化任务' },
      { code: 'template:test', name: '模板测试', description: '运行SQL模板匹配测试' },
      { code: 'template:view', name: '查看报告', description: '查看模板验证报告' }
    ];
    
    for (const perm of permissions) {
      // 检查权限是否已存在
      const [existingPerm] = await conn.execute(
        'SELECT * FROM sys_permissions WHERE code = ?',
        [perm.code]
      ) as any[];
      
      if (existingPerm && existingPerm.length > 0) {
        console.log(`[Module Enabler] 权限已存在: ${perm.code}`);
        continue;
      }
      
      // 插入权限
      await conn.execute(
        `INSERT INTO sys_permissions (code, name, description, status, created_at, updated_at) 
         VALUES (?, ?, ?, 'enabled', NOW(), NOW())`,
        [perm.code, perm.name, perm.description]
      );
      console.log(`[Module Enabler] 权限已添加: ${perm.code}`);
    }
    
    console.log('[Module Enabler] ✅ 模块启用成功！');
    console.log('[Module Enabler] 请刷新页面查看新菜单');
    
  } catch (error) {
    console.error('[Module Enabler] ❌ 启用失败:', error);
    throw error;
  } finally {
    conn.release();
    await pool.end();
  }
}

// 运行
enableModule().catch(console.error);
