const mysql = require('mysql2/promise');

async function checkTables() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '123456',
      database: 'ai-data-platform'
    });

    console.log('Connected to database');

    // 检查所有表
    const [tables] = await connection.execute('SHOW TABLES');
    console.log('All tables:', tables.map(table => Object.values(table)[0]));

    // 检查用户相关表
    const [userTables] = await connection.execute('SHOW TABLES LIKE "%user%"');
    console.log('User tables:', userTables.map(table => Object.values(table)[0]));

    // 检查sys_users表的结构
    const [sysUsersExists] = await connection.execute('SHOW TABLES LIKE "sys_users"');
    if (sysUsersExists.length > 0) {
      console.log('sys_users table exists');
      const [columns] = await connection.execute('DESCRIBE sys_users');
      console.log('sys_users columns:', columns);
    }

    // 检查users表的结构
    const [usersExists] = await connection.execute('SHOW TABLES LIKE "users"');
    if (usersExists.length > 0) {
      console.log('users table exists');
      const [columns] = await connection.execute('DESCRIBE users');
      console.log('users columns:', columns);
    }

    // 检查datasource_config表的外键约束
    const [constraints] = await connection.execute(`
      SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = 'ai-data-platform'
      AND TABLE_NAME = 'datasource_config'
      AND REFERENCED_TABLE_NAME IS NOT NULL
    `);
    console.log('datasource_config foreign keys:', constraints);

    await connection.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkTables();