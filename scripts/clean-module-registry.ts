
import { pool } from '../src/admin/core/database';

async function main() {
    try {
        const modulesToDelete = ['rag-service', 'skills-service'];
        console.log(`Deleting modules: ${modulesToDelete.join(', ')}...`);

        // 使用 IN 子句删除
        const placeholders = modulesToDelete.map(() => '?').join(',');
        const query = `DELETE FROM sys_modules WHERE name IN (${placeholders})`;

        const [result] = await pool.execute(query, modulesToDelete);
        console.log('Deleted result:', result);
        console.log('Modules deleted successfully. Restarting the server will re-register them with updated dependencies.');
    } catch (error) {
        console.error('Error deleting modules:', error);
    } finally {
        await pool.end();
    }
}

main();
