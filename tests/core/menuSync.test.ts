import { beforeAll, beforeEach, afterEach, describe, expect, it } from 'vitest';
import { initAdminTables, pool, syncSystemMenus } from '../../src/admin/core/database';
import { menuService } from '../../modules/menu-management/backend/service';
import { menuManager } from '../../src/module-system/core/MenuManager';

async function resetMenuState() {
  await menuService.clearAll(true);
  const connection = await pool.getConnection();
  try {
    await syncSystemMenus(connection);
  } finally {
    connection.release();
  }
}

describe('System Menu Sync', () => {
  beforeAll(async () => {
    await initAdminTables();
  });

  beforeEach(async () => {
    await resetMenuState();
  });

  afterEach(async () => {
    await resetMenuState();
  });

  it('should merge legacy system menu containers into system-management', async () => {
    const legacyRootId = 'legacy-system-root';
    const legacyChildId = 'legacy-system-child';
    const legacyRoleId = 'legacy-system-role';
    const connection = await pool.getConnection();

    try {
      await connection.execute(
        `INSERT INTO sys_menus
         (id, title, path, icon, parent_id, sort_order, visible, permission_code, is_system, menu_type, created_at, updated_at, module_name)
         VALUES (?, '系统菜单', NULL, 'SettingOutlined', NULL, 999, TRUE, '*', FALSE, 'internal', NOW(), NOW(), 'legacy-system-module')`,
        [legacyRootId]
      );

      await connection.execute(
        `INSERT INTO sys_menus
         (id, title, path, icon, parent_id, sort_order, visible, permission_code, is_system, menu_type, created_at, updated_at)
         VALUES (?, '旧系统子菜单', '/system/legacy-child', 'MenuOutlined', ?, 1, TRUE, 'menu:view', FALSE, 'internal', NOW(), NOW())`,
        [legacyChildId, legacyRootId]
      );

      await connection.execute(
        'INSERT INTO sys_role_menus (role_id, menu_id) VALUES (?, ?)',
        [legacyRoleId, legacyRootId]
      );

      await syncSystemMenus(connection);
    } finally {
      connection.release();
    }

    const [legacyRootRows] = await pool.execute('SELECT id FROM sys_menus WHERE id = ?', [legacyRootId]);
    const [legacyChildRows] = await pool.execute('SELECT parent_id FROM sys_menus WHERE id = ?', [legacyChildId]);
    const [roleMenuRows] = await pool.execute('SELECT menu_id FROM sys_role_menus WHERE role_id = ?', [legacyRoleId]);

    expect(legacyRootRows as any[]).toHaveLength(0);
    expect((legacyChildRows as any[])[0]?.parent_id).toBe('system-management');
    expect((roleMenuRows as any[]).map(row => row.menu_id)).toContain('system-management');
    expect((roleMenuRows as any[]).map(row => row.menu_id)).not.toContain(legacyRootId);
  });

  it('should keep custom root menus that are not legacy system containers', async () => {
    const customRootId = 'custom-root-menu';
    const connection = await pool.getConnection();

    try {
      await connection.execute(
        `INSERT INTO sys_menus
         (id, title, path, icon, parent_id, sort_order, visible, permission_code, is_system, menu_type, created_at, updated_at)
         VALUES (?, '自定义根菜单', '/custom-root', 'AppstoreOutlined', NULL, 888, TRUE, '*', FALSE, 'internal', NOW(), NOW())`,
        [customRootId]
      );

      await syncSystemMenus(connection);
    } finally {
      connection.release();
    }

    const [customRootRows] = await pool.execute(
      'SELECT id, parent_id FROM sys_menus WHERE id = ?',
      [customRootId]
    );

    expect(customRootRows as any[]).toHaveLength(1);
    expect((customRootRows as any[])[0]?.parent_id).toBeNull();
  });

  it('should remove stale module menus when a module no longer declares any menus', async () => {
    await menuManager.registerMenus('approval', [
      {
        id: 'approval',
        title: '审批管理',
        path: '/datasource/approval',
        icon: 'AuditOutlined',
        parentId: 'ops-management',
        sortOrder: 600,
        permission: 'approval:view',
      },
    ]);

    await menuManager.registerMenus('approval', []);

    const [moduleMenuRows] = await pool.execute(
      'SELECT id FROM sys_menus WHERE module_name = ?',
      ['approval']
    );

    expect(moduleMenuRows as any[]).toHaveLength(0);
  });
});
