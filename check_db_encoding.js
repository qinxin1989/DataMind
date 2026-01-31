const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
    try {
        const pool = await mysql.createPool({
            host: process.env.CONFIG_DB_HOST,
            user: process.env.CONFIG_DB_USER,
            password: process.env.CONFIG_DB_PASSWORD,
            database: process.env.CONFIG_DB_NAME
        });

        const [tmps] = await pool.query('SELECT id, name, url FROM crawler_templates');
        console.log('TEMPLATES_START');
        console.log(JSON.stringify(tmps));
        console.log('TEMPLATES_END');

        const [fields] = await pool.query('SELECT field_name FROM crawler_template_fields');
        console.log('FIELDS_START');
        console.log(JSON.stringify(fields));
        console.log('FIELDS_END');

        await pool.end();
    } catch (e) {
        console.error('ERROR:', e);
    }
}
run();
