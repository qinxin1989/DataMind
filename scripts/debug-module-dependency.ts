
import { pool } from '../src/admin/core/database';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
    const moduleName = 'rag-service';
    try {
        // 1. Check file content
        const filePath = path.resolve(__dirname, `../modules/${moduleName}/module.json`);
        const content = fs.readFileSync(filePath, 'utf-8');
        const manifest = JSON.parse(content);
        console.log(`[File] ${moduleName} dependencies:`, manifest.dependencies);

        // 2. Check DB content before delete
        const [rowsBefore] = await pool.execute(
            'SELECT * FROM sys_module_dependencies WHERE module_name = ?',
            [moduleName]
        );
        console.log(`[DB] Before delete, dependencies count: ${(rowsBefore as any[]).length}`);
        console.log(`[DB] Dependencies:`, rowsBefore);

        // 3. Delete module
        console.log(`Deleting module ${moduleName}...`);
        await pool.execute('DELETE FROM sys_modules WHERE name = ?', [moduleName]);

        // 4. Check DB content after delete
        const [rowsAfter] = await pool.execute(
            'SELECT * FROM sys_module_dependencies WHERE module_name = ?',
            [moduleName]
        );
        console.log(`[DB] After delete, dependencies count: ${(rowsAfter as any[]).length}`);

        if ((rowsAfter as any[]).length === 0) {
            console.log('Cascade delete works!');
        } else {
            console.error('Cascade delete FAILED!');
            // Force delete dependencies manually
            await pool.execute('DELETE FROM sys_module_dependencies WHERE module_name = ?', [moduleName]);
            console.log('Force deleted dependencies.');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

main();
