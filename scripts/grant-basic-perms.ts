import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

async function grantBasicPermissions() {
    const config = {
        host: process.env.CONFIG_DB_HOST || 'localhost',
        port: parseInt(process.env.CONFIG_DB_PORT || '3306'),
        user: process.env.CONFIG_DB_USER || 'root',
        password: process.env.CONFIG_DB_PASSWORD,
        database: process.env.CONFIG_DB_NAME || 'DataMind'
    };

    const conn = await mysql.createConnection(config);

    try {
        console.log('=== Granting Basic Permissions to Admin ===');

        // Get Admin Role ID
        const [roles] = await conn.execute('SELECT id FROM sys_roles WHERE code = "admin"');
        const roleId = (roles as any[])[0]?.id || '00000000-0000-0000-0000-000000000002';

        console.log(`Admin ID: ${roleId}`);

        const permissions = [
            'user:view', 'user:create', 'user:update', 'user:delete',
            'role:view', 'role:create', 'role:update', 'role:delete', 'role:assign-permissions',
            'menu:view', 'menu:create', 'menu:update', 'menu:delete', 'menu:sort',
            'system:config', 'system:view'
        ];

        for (const perm of permissions) {
            await conn.execute(
                `INSERT IGNORE INTO sys_role_permissions (role_id, permission_code) VALUES (?, ?)`,
                [roleId, perm]
            );
            console.log(`Granted ${perm}`);
        }

        // Ensure the menu items are visible in sys_menus (just in case)
        // IDs matching the ones I set in module.json
        const menuIds = [
            '00000000-0000-0000-0000-000000000010', // Basic System
            '00000000-0000-0000-0000-000000000011', // User
            '00000000-0000-0000-0000-000000000012', // Role
            '00000000-0000-0000-0000-000000000015'  // Menu (ID I chose)
        ];

        for (const id of menuIds) {
            await conn.execute('UPDATE sys_menus SET visible = TRUE WHERE id = ?', [id]);
        }

        console.log('Permissions Granted and Menus/Visibility Secured.');

    } catch (e) {
        console.error(e);
    } finally {
        await conn.end();
    }
}

grantBasicPermissions();
