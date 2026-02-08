
import { pool } from '../src/admin/core/database';

async function fixMenus() {
    console.log('Connecting to database...');
    const connection = await pool.getConnection();
    try {
        console.log('Fixing menus...');

        // 1. Ensure 'data-collection' exists
        // This is the parent menu for crawler management
        await connection.execute(`
      INSERT INTO sys_menus (id, title, path, icon, parent_id, sort_order, permission_code, is_system, visible, module_code)
      VALUES ('data-collection', '数据采集中心', NULL, 'CloudServerOutlined', NULL, 10, 'crawler:view', 1, 1, 'system')
      ON DUPLICATE KEY UPDATE title='数据采集中心', visible=1
    `);
        console.log('Ensure data-collection menu exists.');

        // 2. Add 'crawler-results-all'
        // This is the new menu for crawler results list
        await connection.execute(`
      INSERT INTO sys_menus (id, title, path, icon, parent_id, sort_order, permission_code, is_system, visible, module_code)
      VALUES ('crawler-results-all', '采集结果库', '/ai/crawler-results', 'TableOutlined', 'data-collection', 4, 'crawler:view', 0, 1, 'crawler-management')
      ON DUPLICATE KEY UPDATE title='采集结果库', path='/ai/crawler-results', parent_id='data-collection', sort_order=4, visible=1
    `);
        console.log('Added Crawler Results menu.');

        // 3. Add 'workbench'
        // User requested this at the very top
        await connection.execute(`
      INSERT INTO sys_menus (id, title, path, icon, parent_id, sort_order, permission_code, is_system, visible, module_code)
      VALUES ('workbench', '工作台', '/workbench', 'DashboardOutlined', NULL, 0, 'dashboard:view', 1, 1, 'dashboard')
      ON DUPLICATE KEY UPDATE title='工作台', sort_order=0, visible=1, module_code='dashboard', permission_code='dashboard:view'
    `);
        console.log('Added Workbench menu.');

        console.log('Menus fixed successfully.');
    } catch (error) {
        console.error('Error fixing menus:', error);
    } finally {
        connection.release();
        // Allow time for logs to flush
        setTimeout(() => process.exit(0), 100);
    }
}

fixMenus();
