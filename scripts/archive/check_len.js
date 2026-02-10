
const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
    const pool = mysql.createPool({
        host: process.env.CONFIG_DB_HOST || 'localhost',
        port: parseInt(process.env.CONFIG_DB_PORT || '3306'),
        user: process.env.CONFIG_DB_USER || 'root',
        password: process.env.CONFIG_DB_PASSWORD || '',
        database: process.env.CONFIG_DB_NAME || 'ai-data-platform',
    });

    try {
        const [rows] = await pool.execute('SELECT name, api_key FROM sys_ai_configs');
        for (const row of rows) {
            const key = row.api_key || '';
            console.log(`${row.name}: len=${key.length}, key=${key}`);
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

run();
