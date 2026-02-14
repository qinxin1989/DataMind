
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function checkTables() {
    const config = {
        host: process.env.CONFIG_DB_HOST || 'localhost',
        port: parseInt(process.env.CONFIG_DB_PORT || '3306'),
        user: process.env.CONFIG_DB_USER || 'root',
        password: process.env.CONFIG_DB_PASSWORD || 'qinxin',
        database: 'datamind'
    };

    const connection = await mysql.createConnection(config);
    const [rows] = await connection.query('SHOW TABLES');
    console.log('当前数据库中的表:');
    console.log(rows);
    await connection.end();
}

checkTables();
