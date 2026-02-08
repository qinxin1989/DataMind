
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'qinxin',
        database: process.env.DB_NAME || 'datamind'
    });

    try {
        const [templates] = await pool.query("SELECT id, name FROM crawler_templates");
        console.log("Templates:");
        console.table(templates);

        for (const t of templates as any[]) {
            const [fields] = await pool.query("SELECT * FROM crawler_template_fields WHERE template_id = ?", [t.id]);
            console.log(`Fields for template ${t.name} (${t.id}):`);
            console.table(fields);
        }

        const [results] = await pool.query("SELECT * FROM crawler_results ORDER BY created_at DESC LIMIT 5");
        console.log("Recent Results:");
        console.table(results);

    } catch (error) {
        console.error(error);
    } finally {
        await pool.end();
    }
}

check();
