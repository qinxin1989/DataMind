const mysql = require('mysql2/promise');

// 使用与项目相同的数据库配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'ai-data-platform'
};

async function checkTables() {
  try {
    // 创建数据库连接
    const connection = await mysql.createConnection(dbConfig);
    console.log('Connected to database!');

    // 检查所有表
    const [tables] = await connection.execute('SHOW TABLES');
    console.log('All tables in database:');
    tables.forEach((table, index) => {
      const tableName = Object.values(table)[0];
      console.log(`${index + 1}. ${tableName}`);
    });

    // 检查用户相关表
    const [userTables] = await connection.execute('SHOW TABLES LIKE "%user%"');
    console.log('\nUser-related tables:');
    userTables.forEach((table, index) => {
      const tableName = Object.values(table)[0];
      console.log(`${index + 1}. ${tableName}`);
    });

    // 检查datasource_config表的外键约束
    const [constraints] = await connection.execute(`
      SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ?
      AND TABLE_NAME = 'datasource_config'
      AND REFERENCED_TABLE_NAME IS NOT NULL
    `, [dbConfig.database]);

    console.log('\nForeign key constraints on datasource_config:');
    if (constraints.length === 0) {
      console.log('No foreign key constraints found');
    } else {
      constraints.forEach((constraint, index) => {
        console.log(`${index + 1}. Constraint: ${constraint.CONSTRAINT_NAME}`);
        console.log(`   Column: ${constraint.COLUMN_NAME}`);
        console.log(`   References: ${constraint.REFERENCED_TABLE_NAME}.${constraint.REFERENCED_COLUMN_NAME}`);
      });
    }

    // 关闭连接
    await connection.end();
    console.log('\nConnection closed');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// 运行检查
checkTables();