
import { createPool } from 'mysql2/promise';
import * as dotenv from 'dotenv';
import * as path from 'path';

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = createPool({
    host: process.env.CONFIG_DB_HOST,
    user: process.env.CONFIG_DB_USER,
    password: process.env.CONFIG_DB_PASSWORD,
    database: process.env.CONFIG_DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function checkData() {
    try {
        const connection = await pool.getConnection();
        console.log('正在查询 crawler_templates 表...');

        const [rows] = await connection.query('SELECT id, name, department, data_type FROM crawler_templates');
        console.log('查询结果:');
        console.table(rows);

        connection.release();
    } catch (error) {
        console.error('查询失败:', error);
    } finally {
        pool.end();
    }
}

checkData();
