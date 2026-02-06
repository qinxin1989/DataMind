import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function cleanupDuplicates() {
    const config = {
        host: process.env.CONFIG_DB_HOST || 'localhost',
        port: parseInt(process.env.CONFIG_DB_PORT || '3306'),
        user: process.env.CONFIG_DB_USER || 'root',
        password: process.env.CONFIG_DB_PASSWORD || 'qinxin',
        database: process.env.CONFIG_DB_NAME || 'DataMind'
    };

    const conn = await mysql.createConnection(config);

    try {
        console.log('=== CLEANING UP DUPLICATE MENUS ===');

        // List of legacy IDs to delete IF they exist
        // We assume the UUID versions are already inserted and correct
        const legacyIds = [
            'user-management-menu',
            'role-management-menu',
            'menu-management-menu',
            'notification-main',
            // 'system-center', // Already deleted
            // 'system-management' // Already deleted
        ];

        for (const id of legacyIds) {
            console.log(`Deleting legacy menu: ${id}...`);
            const [result] = await conn.execute('DELETE FROM sys_menus WHERE id = ?', [id]);
            console.log(` - Deleted ${(result as any).affectedRows} rows.`);
        }

        console.log('=== CLEANUP COMPLETE ===');

    } catch (e) {
        console.error(e);
    } finally {
        await conn.end();
    }
}

cleanupDuplicates();
