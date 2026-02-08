
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'datamind'
    });

    try {
        const [columns] = await pool.query("SHOW COLUMNS FROM crawler_results");
        console.log("Columns in crawler_results:");
        console.table(columns);

        const [rows] = await pool.query("SHOW COLUMNS FROM crawler_result_rows");
        console.log("Columns in crawler_result_rows:");
        console.table(rows);

        const [items] = await pool.query("SHOW COLUMNS FROM crawler_result_items");
        console.log("Columns in crawler_result_items:");
        console.table(items);
    } catch (error) {
        console.error(error);
    } finally {
        await pool.end();
    }
}

check();
