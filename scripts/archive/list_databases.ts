
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: 'root',
        password: 'qinxin',
    });

    try {
        const [rows] = await pool.query("SHOW DATABASES");
        console.log("Databases:");
        console.table(rows);
    } catch (error) {
        console.error(error);
    } finally {
        await pool.end();
    }
}

check();
