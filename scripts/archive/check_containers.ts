
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
        const [templates] = await pool.query("SELECT id, name, url, container_selector, pagination_enabled FROM crawler_templates");
        console.log("Templates:");
        console.table(templates);
    } catch (error) {
        console.error(error);
    } finally {
        await pool.end();
    }
}

check();
