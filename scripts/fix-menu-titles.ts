import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

async function fixMenuTitles() {
    const config = {
        host: process.env.CONFIG_DB_HOST || 'localhost',
        port: parseInt(process.env.CONFIG_DB_PORT || '3306'),
        user: process.env.CONFIG_DB_USER || 'root',
        password: process.env.CONFIG_DB_PASSWORD || 'qinxin',
        database: process.env.CONFIG_DB_NAME || 'DataMind'
    };

    const conn = await mysql.createConnection(config);

    try {
        console.log('=== Fixing Menu Titles and Visibility ===');

        // 1. Update Root Menu Titles to match init.sql
        console.log('Updating Root Menu Titles...');
        await conn.execute('UPDATE sys_menus SET title = "AI 创新中心" WHERE id = "00000000-0000-0000-0000-000000000005"');
        await conn.execute('UPDATE sys_menus SET title = "基础系统管理" WHERE id = "00000000-0000-0000-0000-000000000010"');
        await conn.execute('UPDATE sys_menus SET title = "数据采集中心" WHERE id = "00000000-0000-0000-0000-000000000021"');

        // 2. Ensure Root Menus are Visible
        console.log('Ensuring Root Menus are visible...');
        await conn.execute('UPDATE sys_menus SET visible = TRUE WHERE id IN ("00000000-0000-0000-0000-000000000005", "00000000-0000-0000-0000-000000000010", "00000000-0000-0000-0000-000000000021")');

        // 3. Ensure Child Menus are Visible
        console.log('Ensuring Child Menus are visible...');
        // Audit Log, Notification, Dashboard, Crawler
        await conn.execute('UPDATE sys_menus SET visible = TRUE WHERE id IN ("audit-log-main", "notification-main", "dashboard-main", "00000000-0000-0000-0000-000000000014", "crawler-management-main")');

        console.log('Menu Fixes Applied Successfully.');

    } catch (e) {
        console.error(e);
    } finally {
        await conn.end();
    }
}

fixMenuTitles();
