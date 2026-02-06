import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

async function syncModules() {
    const connection = await mysql.createConnection({
        host: process.env.CONFIG_DB_HOST || 'localhost',
        port: parseInt(process.env.CONFIG_DB_PORT || '3306'),
        user: process.env.CONFIG_DB_USER || 'root',
        password: process.env.CONFIG_DB_PASSWORD || 'qinxin',
        database: process.env.CONFIG_DB_NAME || 'DataMind'
    });

    console.log('Connected to database.');

    const modulesDir = path.join(process.cwd(), 'modules');
    const modules = fs.readdirSync(modulesDir);

    for (const moduleName of modules) {
        const moduleJsonPath = path.join(modulesDir, moduleName, 'module.json');
        if (!fs.existsSync(moduleJsonPath)) continue;

        console.log(`\nSyncing module: ${moduleName}`);
        const manifest = JSON.parse(fs.readFileSync(moduleJsonPath, 'utf8'));

        // 1. Sync sys_modules
        try {
            const [existing] = await connection.execute('SELECT id FROM sys_modules WHERE name = ?', [manifest.name]);
            if ((existing as any[]).length > 0) {
                await connection.execute(
                    `UPDATE sys_modules SET display_name = ?, version = ?, description = ?, author = ?, license = ?, type = ?, category = ?, status = ? WHERE name = ?`,
                    [
                        manifest.displayName,
                        manifest.version,
                        manifest.description || null,
                        manifest.author || null,
                        manifest.license || null,
                        manifest.type || null,
                        manifest.category || null,
                        manifest.enabled ? 'enabled' : 'disabled',
                        manifest.name
                    ]
                );
            } else {
                await connection.execute(
                    `INSERT INTO sys_modules (id, name, display_name, version, description, author, license, type, category, status) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        uuidv4(),
                        manifest.name,
                        manifest.displayName,
                        manifest.version,
                        manifest.description || null,
                        manifest.author || null,
                        manifest.license || null,
                        manifest.type || null,
                        manifest.category || null,
                        manifest.enabled ? 'enabled' : 'disabled'
                    ]
                );
            }
        } catch (e: any) {
            console.error(`  Error updating sys_modules for ${manifest.name}: ${e.message}`);
        }

        // 2. Sync sys_module_menus and sys_menus
        if (manifest.menus && manifest.menus.length > 0) {
            console.log('  Updating sys_module_menus and sys_menus...');

            for (const menu of manifest.menus) {
                // Update or Insert into sys_menus
                try {
                    await connection.execute(
                        `INSERT INTO sys_menus (id, title, path, icon, parent_id, sort_order, visible, is_system, permission_code) 
             VALUES (?, ?, ?, ?, ?, ?, TRUE, TRUE, ?) 
             ON DUPLICATE KEY UPDATE 
             title = VALUES(title), path = VALUES(path), icon = VALUES(icon), 
             parent_id = VALUES(parent_id), sort_order = VALUES(sort_order),
             permission_code = VALUES(permission_code)`,
                        [
                            menu.id,
                            menu.title,
                            menu.path,
                            menu.icon || null,
                            menu.parentId || null,
                            menu.sortOrder || 0,
                            menu.permission || null
                        ]
                    );
                } catch (e: any) {
                    console.error(`  Error inserting sys_menu ${menu.id}: ${e.message}`);
                }

                // Update or Insert into sys_module_menus
                try {
                    const [mExisting] = await connection.execute('SELECT id FROM sys_module_menus WHERE module_name = ? AND menu_id = ?', [manifest.name, menu.id]);
                    if ((mExisting as any[]).length > 0) {
                        await connection.execute(
                            `UPDATE sys_module_menus SET title = ?, path = ?, icon = ?, parent_id = ?, sort_order = ?, permission_code = ? 
                 WHERE module_name = ? AND menu_id = ?`,
                            [menu.title, menu.path, menu.icon || null, menu.parentId || null, menu.sortOrder || 0, menu.permission || null, manifest.name, menu.id]
                        );
                    } else {
                        await connection.execute(
                            `INSERT INTO sys_module_menus (id, module_name, menu_id, title, path, icon, parent_id, sort_order, permission_code) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [uuidv4(), manifest.name, menu.id, menu.title, menu.path, menu.icon || null, menu.parentId || null, menu.sortOrder || 0, menu.permission || null]
                        );
                    }
                } catch (e: any) {
                    console.error(`  Error inserting module menu ${menu.id}: ${e.message}`);
                }
            }
        }

        // 3. Sync sys_module_backend
        if (manifest.backend) {
            console.log('  Updating sys_module_backend...');
            try {
                const [bExisting] = await connection.execute('SELECT id FROM sys_module_backend WHERE module_name = ?', [manifest.name]);
                if ((bExisting as any[]).length > 0) {
                    await connection.execute(
                        `UPDATE sys_module_backend SET entry_file = ?, routes_prefix = ?, routes_file = ? WHERE module_name = ?`,
                        [
                            manifest.backend.entry,
                            manifest.backend.routes?.prefix || null,
                            manifest.backend.routes?.file || null,
                            manifest.name
                        ]
                    );
                } else {
                    await connection.execute(
                        `INSERT INTO sys_module_backend (id, module_name, entry_file, routes_prefix, routes_file) 
                 VALUES (?, ?, ?, ?, ?)`,
                        [
                            uuidv4(),
                            manifest.name,
                            manifest.backend.entry,
                            manifest.backend.routes?.prefix || null,
                            manifest.backend.routes?.file || null
                        ]
                    );
                }
            } catch (e: any) {
                console.error(`  Error updating backend for ${manifest.name}: ${e.message}`);
            }
        }
    }

    console.log('\nAll modules synced successfully!');
    await connection.end();
}

syncModules().catch(console.error);
