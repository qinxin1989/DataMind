/**
 * 测试菜单数据
 */

const mysql = require('mysql2/promise');

async function testMenuData() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'ai_platform',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  try {
    const connection = await pool.getConnection();
    
    console.log('=== 查询数据采集中心菜单 ===');
    const [rows] = await connection.execute(
      'SELECT id, title, icon, path FROM sys_menus WHERE id = ?',
      ['data-collection']
    );
    
    if (rows.length === 0) {
      console.log('❌ 菜单不存在');
    } else {
      const menu = rows[0];
      console.log('✓ 菜单数据:');
      console.log(`  ID: ${menu.id}`);
      console.log(`  标题: ${menu.title}`);
      console.log(`  图标: ${menu.icon}`);
      console.log(`  路径: ${menu.path}`);
      
      if (menu.icon === 'FileSearchOutlined') {
        console.log('✓ 图标已正确更新为 FileSearchOutlined');
      } else {
        console.log(`❌ 图标不对，当前是: ${menu.icon}`);
      }
    }
    
    connection.release();
    await pool.end();
  } catch (err) {
    console.error('❌ 错误:', err.message);
    process.exit(1);
  }
}

testMenuData();
