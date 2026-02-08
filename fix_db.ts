
import { pool } from './src/admin/core/database';

async function fixSchema() {
    try {
        console.log("Adding pagination columns to crawler_templates...");
        await pool.query(`
            ALTER TABLE crawler_templates 
            ADD COLUMN pagination_enabled TINYINT(1) DEFAULT 0, 
            ADD COLUMN pagination_next_selector VARCHAR(255), 
            ADD COLUMN pagination_max_pages INT DEFAULT 1
        `);
        console.log("Columns added successfully.");

        // Also check if result tables need any updates
        const [rows] = await pool.query("DESC crawler_templates");
        console.table(rows);
    } catch (err) {
        console.error("Error fixing schema:", err);
    } finally {
        process.exit();
    }
}

fixSchema();
