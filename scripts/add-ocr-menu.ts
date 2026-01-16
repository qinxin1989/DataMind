import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function addOCRMenu() {
  const connection = await mysql.createConnection({
    host: process.env.CONFIG_DB_HOST || 'localhost',
    port: parseInt(process.env.CONFIG_DB_PORT || '3306'),
    user: process.env.CONFIG_DB_USER || 'root',
    password: process.env.CONFIG_DB_PASSWORD || '',
    database: process.env.CONFIG_DB_NAME || 'ai-data-platform',
  });

  try {
    console.log('开始添加 OCR 菜单...');

    // 查找所有顶级菜单
    const [allMenus] = await connection.execute(
      'SELECT id, title, parent_id FROM sys_menus ORDER BY parent_id, sort_order'
    );

    console.log('所有菜单:', allMenus);

    // 查找 AI 管理菜单的 ID（可能是 "AI管理" 或 "AI 管理"）
    const [aiMenus] = await connection.execute(
      'SELECT id FROM sys_menus WHERE (title = ? OR title = ?) AND parent_id IS NULL',
      ['AI管理', 'AI 管理']
    );

    let aiMenuId;
    if (!Array.isArray(aiMenus) || aiMenus.length === 0) {
      console.log('未找到 AI 管理菜单，尝试查找包含 AI 的菜单...');
      const [aiMenusLike] = await connection.execute(
        'SELECT id, title FROM sys_menus WHERE title LIKE ? AND parent_id IS NULL',
        ['%AI%']
      );
      console.log('包含 AI 的菜单:', aiMenusLike);
      
      if (!Array.isArray(aiMenusLike) || aiMenusLike.length === 0) {
        console.error('未找到任何 AI 相关菜单，将创建为顶级菜单');
        aiMenuId = null;
      } else {
        aiMenuId = (aiMenusLike[0] as any).id;
        console.log('使用菜单:', (aiMenusLike[0] as any).title, 'ID:', aiMenuId);
      }
    } else {
      aiMenuId = (aiMenus[0] as any).id;
      console.log('AI 管理菜单 ID:', aiMenuId);
    }

    // 检查 OCR 菜单是否已存在
    const [existing] = await connection.execute(
      'SELECT id FROM sys_menus WHERE path = ?',
      ['/ai/ocr']
    );

    if (Array.isArray(existing) && existing.length > 0) {
      console.log('OCR 菜单已存在，跳过创建');
      return;
    }

    // 获取当前最大排序号
    const [maxSort] = await connection.execute(
      'SELECT MAX(sort_order) as maxSort FROM sys_menus WHERE parent_id = ?',
      [aiMenuId]
    );

    const nextSort = (Array.isArray(maxSort) && maxSort.length > 0 && (maxSort[0] as any).maxSort)
      ? (maxSort[0] as any).maxSort + 1
      : 6;

    // 插入 OCR 菜单
    await connection.execute(
      `INSERT INTO sys_menus (id, parent_id, title, path, icon, sort_order, visible, permission_code, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        'ocr-menu-' + Date.now(),
        aiMenuId,
        'OCR识别',
        '/ai/ocr',
        'ScanOutlined',
        nextSort,
        1,
        'ai:ocr:view',
      ]
    );

    console.log('✅ OCR 菜单添加成功');

    // 为所有角色添加 OCR 权限
    const [roles] = await connection.execute('SELECT id FROM sys_roles');

    if (Array.isArray(roles)) {
      for (const role of roles) {
        const roleId = (role as any).id;

        // 获取角色当前权限
        const [roleData] = await connection.execute(
          'SELECT permissions FROM sys_roles WHERE id = ?',
          [roleId]
        );

        if (Array.isArray(roleData) && roleData.length > 0) {
          const currentPermissions = (roleData[0] as any).permissions || '[]';
          const permissions = JSON.parse(currentPermissions);

          // 添加 OCR 权限
          if (!permissions.includes('ai:ocr:view')) {
            permissions.push('ai:ocr:view');

            await connection.execute(
              'UPDATE sys_roles SET permissions = ? WHERE id = ?',
              [JSON.stringify(permissions), roleId]
            );

            console.log(`✅ 为角色 ${roleId} 添加 OCR 权限`);
          }
        }
      }
    }

    console.log('✅ 所有操作完成');
  } catch (error) {
    console.error('❌ 添加 OCR 菜单失败:', error);
  } finally {
    await connection.end();
  }
}

addOCRMenu();
