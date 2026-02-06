
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function syncModule(moduleName: string) {
    console.log(`正在同步模块: ${moduleName}`);

    const manifestPath = path.join(__dirname, `../modules/${moduleName}/module.json`);
    if (!fs.existsSync(manifestPath)) {
        console.error(`找不到模块清单: ${manifestPath}`);
        return;
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

    const pool = mysql.createPool({
        host: process.env.CONFIG_DB_HOST || 'localhost',
        port: parseInt(process.env.CONFIG_DB_PORT || '3306'),
        user: process.env.CONFIG_DB_USER || 'root',
        password: process.env.CONFIG_DB_PASSWORD || '',
        database: process.env.CONFIG_DB_NAME || 'DataMind'
    });

    try {
        await pool.query('START TRANSACTION');

        // 1. 更新 sys_module_menus
        console.log('更新 sys_module_menus...');
        await pool.execute('DELETE FROM sys_module_menus WHERE module_name = ?', [moduleName]);
        if (manifest.menus) {
            for (const menu of manifest.menus) {
                await pool.execute(
                    'INSERT INTO sys_module_menus (id, module_name, menu_id, title, path, icon, parent_id, sort_order, permission_code) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?)',
                    [moduleName, menu.id, menu.title, menu.path, menu.icon || null, menu.parentId || null, menu.sortOrder || 0, menu.permission || null]
                );
            }
        }

        // 2. 更新 sys_menus
        console.log('更新 sys_menus...');
        if (manifest.menus) {
            for (const menu of manifest.menus) {
                const [existing]: any = await pool.execute('SELECT id FROM sys_menus WHERE id = ? AND module_name = ?', [menu.id, moduleName]);
                if (existing.length > 0) {
                    await pool.execute(
                        'UPDATE sys_menus SET title = ?, path = ?, icon = ?, parent_id = ?, sort_order = ?, permission_code = ?, updated_at = NOW() WHERE id = ? AND module_name = ?',
                        [menu.title, menu.path, menu.icon || null, menu.parentId || null, menu.sortOrder || 0, menu.permission || null, menu.id, moduleName]
                    );
                } else {
                    await pool.execute(
                        'INSERT INTO sys_menus (id, title, path, icon, parent_id, sort_order, permission_code, module_name, visible, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())',
                        [menu.id, menu.title, menu.path, menu.icon || null, menu.parentId || null, menu.sortOrder || 0, menu.permission || null, moduleName]
                    );
                }
            }
        }

        // 3. 更新 sys_module_backend
        if (manifest.backend?.routes) {
            console.log('更新 sys_module_backend...');
            const [existingBackend]: any = await pool.execute('SELECT id FROM sys_module_backend WHERE module_name = ?', [moduleName]);
            if (existingBackend.length > 0) {
                await pool.execute(
                    'UPDATE sys_module_backend SET routes_prefix = ?, routes_file = ? WHERE module_name = ?',
                    [manifest.backend.routes.prefix, manifest.backend.routes.file, moduleName]
                );
            } else {
                await pool.execute(
                    'INSERT INTO sys_module_backend (id, module_name, entry_file, routes_prefix, routes_file) VALUES (UUID(), ?, ?, ?, ?)',
                    [moduleName, manifest.backend.entry, manifest.backend.routes.prefix, manifest.backend.routes.file]
                );
            }
        }

        await pool.query('COMMIT');
        console.log(`${moduleName} 同步成功！`);
    } catch (error: any) {
        await pool.query('ROLLBACK');
        console.error(`${moduleName} 同步失败:`, error.message);
    } finally {
        await pool.end();
    }
}

async function main() {
    await syncModule('ai-qa');
    await syncModule('ai-config');
}

main();
