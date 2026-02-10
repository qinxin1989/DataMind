
import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
dotenv.config();

const dbConfig = {
    host: process.env.CONFIG_DB_HOST || 'localhost',
    user: process.env.CONFIG_DB_USER || 'root',
    password: process.env.CONFIG_DB_PASSWORD || 'qinxin',
    database: process.env.CONFIG_DB_NAME || 'datamind',
};

async function checkTables() {
    const connection = await mysql.createConnection(dbConfig);
    try {
        const [tables] = await connection.execute('SHOW TABLES');
        console.log('数据库中的表:', (tables as any[]).map(t => Object.values(t)[0]));

        const [legacyCount] = await connection.execute('SELECT COUNT(*) as count FROM datasource_config');
        console.log('datasource_config (旧表) 记录数:', (legacyCount as any[])[0].count);

        try {
            const [newCount] = await connection.execute('SELECT COUNT(*) as count FROM datasources');
            console.log('datasources (新表) 记录数:', (newCount as any[])[0].count);
        } catch (e: any) {
            console.log('datasources (新表) 不存在或查询失败:', e.message);
        }
    } catch (error: any) {
        console.error('查询失败:', error.message);
    } finally {
        await connection.end();
    }
}

checkTables();
