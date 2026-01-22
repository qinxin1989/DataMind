
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.join(__dirname, '../.env') });

async function check() {
    console.log('Connecting to DB...');
    console.log('Host:', process.env.CONFIG_DB_HOST);

    const pool = mysql.createPool({
        host: process.env.CONFIG_DB_HOST || 'localhost',
        user: process.env.CONFIG_DB_USER || 'root',
        password: process.env.CONFIG_DB_PASSWORD || '',
        database: process.env.CONFIG_DB_NAME || 'ai-data-platform',
        port: Number(process.env.CONFIG_DB_PORT) || 3306,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    try {
        // 1. Check Table Exists
        const [tables] = await pool.execute(`SHOW TABLES LIKE 'chat_history'`);
        console.log('Tables found:', tables);

        if ((tables as any[]).length === 0) {
            console.error('CRITICAL: chat_history table does not exist!');
            return;
        }

        // 2. Check Columns
        const [columns] = await pool.execute(`SHOW COLUMNS FROM chat_history`);
        console.log('Columns:');
        (columns as any[]).forEach(c => console.log(` - ${c.Field} (${c.Type})`));

        // 3. User ID Check
        const hasUserId = (columns as any[]).some(c => c.Field === 'user_id');
        console.log('Has user_id column:', hasUserId);

        // 3. Check Rows
        const [rows] = await pool.execute(`SELECT COUNT(*) as count FROM chat_history`);
        console.log('Row count:', (rows as any[])[0].count);

        // 4. Sample Data
        const [samples] = await pool.execute(`SELECT * FROM chat_history ORDER BY updated_at DESC LIMIT 1`);
        console.log('Latest session:', samples);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

check();
