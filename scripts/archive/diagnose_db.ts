
import { pool } from './src/admin/core/database';

async function diagnose() {
    try {
        const [rows] = await pool.execute('SELECT DISTINCT IsOfficial FROM countrylanguage');
        console.log('IsOfficial valid values:', rows);

        const [sample] = await pool.execute('SELECT * FROM countrylanguage WHERE IsOfficial = "T" LIMIT 2');
        console.log('Sample Official languages:', sample);

        const [sampleManual] = await pool.execute('SELECT * FROM countrylanguage WHERE IsOfficial = "Official" LIMIT 2');
        console.log('Sample "Official" matching rows:', sampleManual);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

diagnose();
