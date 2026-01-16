/**
 * 同步系统菜单 - 添加系统管理和AI管理的子菜单
 */

import { pool } from '../src/admin/core/database';

async function syncMenus() {
  try {
    console.log('开始同步菜单...');

    // 查找AI管理和系统管理的父菜单ID
    const [aiMenus] = await pool.execute(
      "SELECT id FROM sys_menus WHERE title = 'AI管理' LIMIT 1"
    );
    const [systemMenus] = await pool.execute(
      "SELECT id FROM sys_menus WHERE title = '系统管理' LIMIT 1"
    );

    const aiParentId = (aiMenus as any[])[0]?.id;
    const systemParentId = (systemMenus as any[])[0]?.id;

    if (!aiParentId) {
      console.log('AI管理菜单不存在，创建中...');
      await pool.execute(
        `INSERT INTO sys_menus (id, title, path, icon, parent_id, sort_order, is_system) 
         VALUES ('ai-management', 'AI管理', NULL, 'RobotOutlined', NULL, 5, TRUE)`
      );
    }

    if (!systemParentId) {
      console.log('系统管理菜单不存在，创建中...');
      await pool.execute(
        `INSERT INTO sys_menus (id, title, path, icon, parent_id, sort_order, is_system) 
         VALUES ('system-management', '系统管理', NULL, 'SettingOutlined', NULL, 7, TRUE)`
      );
    }

    // 重新获取ID
    const [aiMenus2] = await pool.execute(
      "SELECT id FROM sys_menus WHERE title = 'AI管理' LIMIT 1"
    );
    const [systemMenus2] = await pool.execute(
      "SELECT id FROM sys_menus WHERE title = '系统管理' LIMIT 1"
    );

    const finalAiParentId = (aiMenus2 as any[])[0]?.id;
    const finalSystemParentId = (systemMenus2 as any[])[0]?.id;

    // AI管理子菜单
    const aiSubMenus = [
      { id: 'ai-chat', title: 'AI问答', path: '/ai/chat', icon: 'MessageOutlined', order: 1 },
      { id: 'ai-knowledge', title: '知识库', path: '/ai/knowledge', icon: 'BookOutlined', order: 2 },
      { id: 'ai-config', title: 'AI配置', path: '/ai/config', icon: 'SettingOutlined', order: 3 },
      { id: 'ai-stats', title: '使用统计', path: '/ai/stats', icon: 'BarChartOutlined', order: 4 },
      { id: 'ai-history', title: '对话历史', path: '/ai/history', icon: 'HistoryOutlined', order: 5 },
    ];

    // 系统管理子菜单
    const systemSubMenus = [
      { id: 'system-config', title: '系统配置', path: '/system/config', icon: 'SettingOutlined', order: 1 },
      { id: 'system-status', title: '系统状态', path: '/system/status', icon: 'DashboardOutlined', order: 2 },
      { id: 'system-audit', title: '审计日志', path: '/system/audit', icon: 'FileTextOutlined', order: 3 },
      { id: 'system-backup', title: '备份恢复', path: '/system/backup', icon: 'CloudUploadOutlined', order: 4 },
    ];

    // 插入AI子菜单
    for (const menu of aiSubMenus) {
      await pool.execute(
        `INSERT INTO sys_menus (id, title, path, icon, parent_id, sort_order, is_system, visible) 
         VALUES (?, ?, ?, ?, ?, ?, TRUE, TRUE)
         ON DUPLICATE KEY UPDATE title = VALUES(title), path = VALUES(path), icon = VALUES(icon), parent_id = VALUES(parent_id), sort_order = VALUES(sort_order)`,
        [menu.id, menu.title, menu.path, menu.icon, finalAiParentId, menu.order]
      );
      console.log(`✓ 同步菜单: ${menu.title}`);
    }

    // 插入系统管理子菜单
    for (const menu of systemSubMenus) {
      await pool.execute(
        `INSERT INTO sys_menus (id, title, path, icon, parent_id, sort_order, is_system, visible) 
         VALUES (?, ?, ?, ?, ?, ?, TRUE, TRUE)
         ON DUPLICATE KEY UPDATE title = VALUES(title), path = VALUES(path), icon = VALUES(icon), parent_id = VALUES(parent_id), sort_order = VALUES(sort_order)`,
        [menu.id, menu.title, menu.path, menu.icon, finalSystemParentId, menu.order]
      );
      console.log(`✓ 同步菜单: ${menu.title}`);
    }

    // 添加大屏管理菜单
    await pool.execute(
      `INSERT INTO sys_menus (id, title, path, icon, parent_id, sort_order, is_system, visible) 
       VALUES ('dashboard-management', '大屏管理', '/dashboard/list', 'FundOutlined', NULL, 8, TRUE, TRUE)
       ON DUPLICATE KEY UPDATE title = VALUES(title), path = VALUES(path), icon = VALUES(icon), sort_order = VALUES(sort_order)`
    );
    console.log(`✓ 同步菜单: 大屏管理`);

    console.log('✅ 菜单同步完成！');
    process.exit(0);
  } catch (error) {
    console.error('❌ 菜单同步失败:', error);
    process.exit(1);
  }
}

syncMenus();
