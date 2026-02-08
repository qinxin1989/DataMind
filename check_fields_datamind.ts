
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
        const [templates] = await pool.query("SELECT id, name FROM crawler_templates");
        console.log("Templates:");
        console.table(templates);

        const [fields] = await pool.query("SELECT id, template_id, field_name, field_selector FROM crawler_template_fields");
        console.log("Fields:");
        console.table(fields);

    } catch (error) {
        console.error(error);
    } finally {
        await pool.end();
    }
}

check();
