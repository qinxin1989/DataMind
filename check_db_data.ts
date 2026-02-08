
import { pool } from './src/admin/core/database';

async function checkData() {
    try {
        const [rows] = await pool.query("SELECT id, name, pagination_enabled, pagination_max_pages FROM crawler_templates");
        console.log("Data in crawler_templates:");
        console.table(rows);
    } catch (err) {
        console.error("Error checking data:", err);
    } finally {
        process.exit();
    }
}

checkData();
