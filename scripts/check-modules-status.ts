
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkModules() {
    console.log('正在连接数据库...');

    const pool = mysql.createPool({
        host: process.env.CONFIG_DB_HOST || 'localhost',
        user: process.env.CONFIG_DB_USER || 'root',
        password: process.env.CONFIG_DB_PASSWORD || '',
        database: process.env.CONFIG_DB_NAME || 'DataMind',
        port: Number(process.env.CONFIG_DB_PORT) || 3306,
    });

    try {
        const [rows] = await pool.execute('SELECT name, status, enabled_at FROM sys_modules');
        console.log('数据库中的模块状态:');
        console.table(rows);
    } catch (error) {
        console.error('查询失败:', error);
    } finally {
        await pool.end();
    }
}

checkModules();
