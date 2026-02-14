/**
 * 菜单树形结构修复脚本
 * 用于修复部署后菜单不一致、树形结构异常的问题
 * 
 * 使用方法: node scripts/fix-menu-tree.js
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// 一级菜单定义（与 database.ts syncSystemMenus() 保持一致）
const TOP_LEVEL_MENUS = [
  { id: 'ai-center', title: 'AI创新中心', path: '/ai', icon: 'RobotOutlined', sortOrder: 100 },
  { id: 'data-center', title: '数据资源中心', path: '/data', icon: 'DatabaseOutlined', sortOrder: 200 },
  { id: 'data-collection', title: '数据采集中心', path: '/collection', icon: 'FileSearchOutlined', sortOrder: 300 },
  { id: 'tools-center', title: '工具箱', path: '/tools', icon: 'ToolOutlined', sortOrder: 500 },
  { id: 'ops-management', title: '运维管理', path: '/ops', icon: 'DashboardOutlined', sortOrder: 600 },
  { id: 'system-management', title: '系统基础管理', path: '/system', icon: 'SettingOutlined', sortOrder: 700 },
];

async function main() {
  const dbConfig = {
    host: process.env.CONFIG_DB_HOST || 'localhost',
    port: parseInt(process.env.CONFIG_DB_PORT || '3306'),
    user: process.env.CONFIG_DB_USER || 'root',
    password: process.env.CONFIG_DB_PASSWORD,
    database: process.env.CONFIG_DB_NAME || 'datamind'
  };

  console.log('='.repeat(50));
  console.log('菜单树形结构修复脚本');
  console.log('='.repeat(50));
  console.log(`连接数据库: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);

  let conn;
  try {
    conn = await mysql.createConnection(dbConfig);
    console.log('✓ 数据库连接成功\n');
  } catch (err) {
    console.error('✗ 数据库连接失败:', err.message);
    process.exit(1);
  }

  try {
    // 1. 检查并添加缺失的列
    console.log('步骤 1: 检查表结构...');
    const columnsToCheck = [
      { name: 'menu_type', def: "VARCHAR(20) DEFAULT 'internal'" },
      { name: 'open_mode', def: "VARCHAR(20) DEFAULT 'current'" },
      { name: 'external_url', def: 'VARCHAR(500)' },
      { name: 'module_code', def: 'VARCHAR(100)' },
      { name: 'module_name', def: 'VARCHAR(50)' }
    ];

    for (const col of columnsToCheck) {
      try {
        await conn.execute(`ALTER TABLE sys_menus ADD COLUMN ${col.name} ${col.def}`);
        console.log(`  ✓ 添加列: ${col.name}`);
      } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
          console.log(`  - 列已存在: ${col.name}`);
        } else {
          console.error(`  ✗ 添加列失败 ${col.name}:`, e.message);
        }
      }
    }

    // 2. 确保一级菜单存在
    console.log('\n步骤 2: 确保一级菜单存在...');
    for (const menu of TOP_LEVEL_MENUS) {
      const [existing] = await conn.execute('SELECT id FROM sys_menus WHERE id = ?', [menu.id]);
      
      if (existing.length === 0) {
        await conn.execute(
          `INSERT INTO sys_menus (id, title, path, icon, parent_id, sort_order, visible, permission_code, is_system, menu_type, created_at, updated_at)
           VALUES (?, ?, ?, ?, NULL, ?, TRUE, '*', FALSE, 'internal', NOW(), NOW())`,
          [menu.id, menu.title, menu.path, menu.icon, menu.sortOrder]
        );
        console.log(`  ✓ 创建菜单: ${menu.title} (${menu.id})`);
      } else {
        console.log(`  - 菜单已存在: ${menu.title} (${menu.id})`);
      }
    }

    // 3. 检查并修复孤儿菜单
    console.log('\n步骤 3: 检查孤儿菜单...');
    const [orphanMenus] = await conn.execute(`
      SELECT m.id, m.title, m.parent_id 
      FROM sys_menus m 
      LEFT JOIN sys_menus p ON m.parent_id = p.id 
      WHERE m.parent_id IS NOT NULL AND p.id IS NULL
    `);

    if (orphanMenus.length === 0) {
      console.log('  - 没有发现孤儿菜单');
    } else {
      console.log(`  发现 ${orphanMenus.length} 个孤儿菜单:`);
      for (const orphan of orphanMenus) {
        console.log(`    - ${orphan.title} (id: ${orphan.id}, parent_id: ${orphan.parent_id})`);
        
        // 尝试找到正确的父菜单（旧 ID 映射到新 ID）
        const parentMapping = {
          'ai-management': 'ai-center',
          'data-management': 'data-center',
          'toolbox-management': 'tools-center',
          'ai-menu': 'ai-center',
        };
        const newParentId = parentMapping[orphan.parent_id] || null;
        
        if (newParentId) {
          await conn.execute('UPDATE sys_menus SET parent_id = ? WHERE id = ?', [newParentId, orphan.id]);
          console.log(`      ✓ 修复: parent_id 改为 ${newParentId}`);
        } else {
          // 无法映射，设为一级菜单
          await conn.execute('UPDATE sys_menus SET parent_id = NULL WHERE id = ?', [orphan.id]);
          console.log(`      ✓ 修复: 设为一级菜单`);
        }
      }
    }

    // 4. 检查并清理旧 ID 的重复菜单
    console.log('\n步骤 4: 检查重复菜单...');
    const duplicateIds = ['ai-management', 'data-management', 'toolbox-management', 'ai-menu'];
    for (const dupId of duplicateIds) {
      const [existing] = await conn.execute('SELECT id, title FROM sys_menus WHERE id = ?', [dupId]);
      if (existing.length > 0) {
        // 检查是否有子菜单引用它
        const [children] = await conn.execute('SELECT id FROM sys_menus WHERE parent_id = ?', [dupId]);
        if (children.length > 0) {
          console.log(`  ! 发现重复菜单 ${dupId}，有 ${children.length} 个子菜单，需要先迁移子菜单`);
        } else {
          await conn.execute('DELETE FROM sys_menus WHERE id = ?', [dupId]);
          console.log(`  ✓ 删除重复菜单: ${existing[0].title} (${dupId})`);
        }
      }
    }

    // 5. 显示最终菜单结构
    console.log('\n步骤 5: 当前菜单结构:');
    const [allMenus] = await conn.execute(
      'SELECT id, title, parent_id, sort_order FROM sys_menus ORDER BY sort_order ASC'
    );
    
    const topMenus = allMenus.filter(m => !m.parent_id);
    for (const top of topMenus) {
      console.log(`  📁 ${top.title} (${top.id})`);
      const children = allMenus.filter(m => m.parent_id === top.id);
      for (const child of children) {
        console.log(`     └─ ${child.title} (${child.id})`);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('✓ 修复完成！请刷新前端页面查看效果。');
    console.log('='.repeat(50));

  } catch (err) {
    console.error('\n✗ 修复过程中发生错误:', err);
  } finally {
    if (conn) await conn.end();
    process.exit(0);
  }
}

main();
