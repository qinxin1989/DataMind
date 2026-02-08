
import { pool } from './src/admin/core/database';

async function checkSchema() {
    try {
        const [rows] = await pool.query("DESC crawler_templates");
        console.log("Columns in crawler_templates:");
        console.table(rows);
    } catch (err) {
        console.error("Error checking schema:", err);
    } finally {
        process.exit();
    }
}

checkSchema();
