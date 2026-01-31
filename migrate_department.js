const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
    const config = {
        host: process.env.CONFIG_DB_HOST || 'localhost',
        port: parseInt(process.env.CONFIG_DB_PORT || '3306'),
        user: process.env.CONFIG_DB_USER || 'root',
        password: process.env.CONFIG_DB_PASSWORD || 'qinxin',
        database: process.env.CONFIG_DB_NAME || 'ai-data-platform'
    };

    const connection = await mysql.createConnection(config);
    try {
        console.log('Adding column "department" to "crawler_templates"...');
        await connection.execute('ALTER TABLE crawler_templates ADD COLUMN department VARCHAR(100) AFTER url');
        console.log('Migration successful!');
    } catch (err) {
        if (err.code === 'ER_DUP_COLUMN_NAME') {
            console.log('Column "department" already exists.');
        } else {
            console.error('Migration failed:', err.message);
        }
    } finally {
        await connection.end();
    }
}

migrate();
