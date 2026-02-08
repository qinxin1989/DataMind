
import { pool } from '../src/admin/core/database';

async function main() {
    console.log('🔄 开始重置模块系统...');
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 1. 清空所有模块记录 (级联删除会导致依赖、菜单、权限等全部被删除)
        console.log('正在清空 sys_modules 表...');
        await connection.execute('DELETE FROM sys_modules');

        // 2. 为了保险起见，手动清理可能残留的非级联表数据 (如果 FK 不完善)
        console.log('正在清理相关表...');
        await connection.execute('DELETE FROM sys_module_dependencies');
        await connection.execute('DELETE FROM sys_module_menus');
        await connection.execute('DELETE FROM sys_module_permissions');
        await connection.execute('DELETE FROM sys_module_tags');
        await connection.execute('DELETE FROM sys_module_backend');
        await connection.execute('DELETE FROM sys_module_frontend');
        await connection.execute('DELETE FROM sys_module_api_endpoints');

        // 3. 清理系统菜单表中由模块管理的菜单 (防止重复或残留)
        // 检查 sys_menus 是否有 module_name 列
        const [menuCols] = await connection.query("SHOW COLUMNS FROM sys_menus LIKE 'module_name'");
        if ((menuCols as any[]).length > 0) {
            console.log('正在清理系统菜单...');
            await connection.execute("DELETE FROM sys_menus WHERE module_name IS NOT NULL AND module_name != ''");
        } else {
            console.log('⚠️ sys_menus 表缺少 module_name 列，跳过清理系统菜单 (重启服务后会自动修复表结构)');
        }

        // 同样清理权限表
        const [permCols] = await connection.query("SHOW COLUMNS FROM sys_permissions LIKE 'module_name'");
        if ((permCols as any[]).length > 0) {
            console.log('正在清理系统权限...');
            await connection.execute("DELETE FROM sys_permissions WHERE module_name IS NOT NULL AND module_name != ''");
        } else {
            console.log('⚠️ sys_permissions 表缺少 module_name 列，跳过清理系统权限');
        }

        await connection.commit();
        console.log('✅ 模块系统重置成功！');
        console.log('请重启服务以重新扫描和注册所有模块。');

    } catch (error) {
        await connection.rollback();
        console.error('❌ 重置失败:', error);
    } finally {
        connection.release();
        await pool.end();
    }
}

main();
