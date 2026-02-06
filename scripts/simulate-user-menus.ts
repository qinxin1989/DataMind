import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

async function simulateGetUserMenus() {
    const config = {
        host: process.env.CONFIG_DB_HOST || 'localhost',
        port: parseInt(process.env.CONFIG_DB_PORT || '3306'),
        user: process.env.CONFIG_DB_USER || 'root',
        password: process.env.CONFIG_DB_PASSWORD || 'qinxin',
        database: process.env.CONFIG_DB_NAME || 'DataMind'
    };

    const conn = await mysql.createConnection(config);

    try {
        console.log('=== Simulating Get User Menus for Admin ===');

        // 1. Get Admin Role
        const [roles] = await conn.execute('SELECT id FROM sys_roles WHERE code = "admin"');
        const roleId = (roles as any[])[0]?.id || '00000000-0000-0000-0000-000000000002';
        console.log(`Admin Role ID: ${roleId}`);

        // 2. Get Permissions
        const [perms] = await conn.execute(
            'SELECT permission_code FROM sys_role_permissions WHERE role_id = ?',
            [roleId]
        );
        const permissionCodes = (perms as any[]).map(p => p.permission_code);
        console.log(`Permissions (${permissionCodes.length}):`, permissionCodes.join(', '));

        const isAdmin = permissionCodes.includes('*');

        // 3. Get All Menus
        const [allMenus] = await conn.execute('SELECT * FROM sys_menus ORDER BY sort_order');
        const menus = allMenus as any[];
        console.log(`Total Menus in DB: ${menus.length}`);

        // 4. Filter Menus
        const visibleMenus = menus.filter(menu => {
            // Basic visibility check
            if (!menu.visible) return false;

            // Permission check
            if (isAdmin) return true;
            if (!menu.permission_code) return true; // Public menu
            return permissionCodes.includes(menu.permission_code);
        });

        console.log(`Visible Menus for Admin: ${visibleMenus.length}`);

        // 5. Build Tree
        const menuMap = new Map();
        visibleMenus.forEach(m => menuMap.set(m.id, { ...m, children: [] }));

        const tree: any[] = [];
        visibleMenus.forEach(m => {
            if (m.parent_id && menuMap.has(m.parent_id)) {
                menuMap.get(m.parent_id).children.push(menuMap.get(m.id));
            } else {
                tree.push(menuMap.get(m.id));
            }
        });

        // 6. Print Tree Structure
        function printTree(nodes: any[], level = 0) {
            nodes.forEach(node => {
                console.log(`${'  '.repeat(level)}[${node.id}] ${node.title} (${node.path}) - visible: ${node.visible}`);
                if (node.children && node.children.length > 0) {
                    printTree(node.children, level + 1);
                }
            });
        }

        console.log('\n=== Menu Tree Structure ===');
        printTree(tree);

        // Specific check for System Management children
        const sysMgmt = visibleMenus.find(m => m.id === '00000000-0000-0000-0000-000000000010');
        if (sysMgmt) {
            console.log('\nChecking System Management Children specifically:');
            const children = visibleMenus.filter(m => m.parent_id === '00000000-0000-0000-0000-000000000010');
            children.forEach(c => console.log(` - ${c.title} (${c.id})`));
        } else {
            console.error('\nCRITICAL: System Management menu is missing or not visible!');
        }

    } catch (e) {
        console.error(e);
    } finally {
        await conn.end();
    }
}

simulateGetUserMenus();
