
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
    const pool = mysql.createPool({
        host: process.env.CONFIG_DB_HOST || 'localhost',
        port: parseInt(process.env.CONFIG_DB_PORT || '3306'),
        user: process.env.CONFIG_DB_USER || 'root',
        password: process.env.CONFIG_DB_PASSWORD || '',
        database: 'datamind'
    });

    try {
        const [results] = await pool.query("SELECT * FROM crawler_results ORDER BY created_at DESC LIMIT 5");
        console.log("Recent Results:");
        console.table(results);

        const [rows] = await pool.query("SELECT row_count FROM (SELECT count(*) as row_count FROM crawler_result_rows) t");
        console.log("Total rows in crawler_result_rows:", (rows as any)[0].row_count);

        const [items] = await pool.query("SELECT item_count FROM (SELECT count(*) as item_count FROM crawler_result_items) t");
        console.log("Total items in crawler_result_items:", (items as any)[0].item_count);
    } catch (error) {
        console.error(error);
    } finally {
        await pool.end();
    }
}

check();
