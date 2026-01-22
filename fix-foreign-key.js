const mysql = require('mysql2/promise');

// 使用与项目相同的数据库配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'qinxin',
  database: 'ai-data-platform'
};

async function fixForeignKey() {
  try {
    // 创建数据库连接
    const connection = await mysql.createConnection(dbConfig);
    console.log('Connected to database!');

    // 1. 检查当前的外键约束
    const [constraints] = await connection.execute(`
      SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ?
      AND TABLE_NAME = 'datasource_config'
      AND REFERENCED_TABLE_NAME IS NOT NULL
    `, [dbConfig.database]);

    console.log('Current foreign key constraints:');
    constraints.forEach(constraint => {
      console.log(`- ${constraint.CONSTRAINT_NAME}: ${constraint.COLUMN_NAME} -> ${constraint.REFERENCED_TABLE_NAME}.${constraint.REFERENCED_COLUMN_NAME}`);
    });

    // 2. 删除指向users表的外键约束
    for (const constraint of constraints) {
      if (constraint.REFERENCED_TABLE_NAME === 'users') {
        console.log(`\nDeleting foreign key constraint: ${constraint.CONSTRAINT_NAME}`);
        await connection.execute(`
          ALTER TABLE datasource_config
          DROP FOREIGN KEY ${constraint.CONSTRAINT_NAME}
        `);
        console.log(`Successfully deleted constraint: ${constraint.CONSTRAINT_NAME}`);
      }
    }

    // 3. 检查sys_users表是否存在
    const [sysUsersExists] = await connection.execute('SHOW TABLES LIKE "sys_users"');
    if (sysUsersExists.length === 0) {
      console.log('\nERROR: sys_users table does not exist!');
      await connection.end();
      return;
    }

    // 4. 添加指向sys_users表的外键约束
    console.log('\nAdding new foreign key constraint to sys_users...');
    await connection.execute(`
      ALTER TABLE datasource_config
      ADD CONSTRAINT datasource_config_user_id_fk
      FOREIGN KEY (user_id)
      REFERENCES sys_users(id)
      ON DELETE CASCADE
    `);
    console.log('Successfully added foreign key constraint to sys_users(id)');

    // 5. 验证修复后的约束
    const [fixedConstraints] = await connection.execute(`
      SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ?
      AND TABLE_NAME = 'datasource_config'
      AND REFERENCED_TABLE_NAME IS NOT NULL
    `, [dbConfig.database]);

    console.log('\nFixed foreign key constraints:');
    fixedConstraints.forEach(constraint => {
      console.log(`- ${constraint.CONSTRAINT_NAME}: ${constraint.COLUMN_NAME} -> ${constraint.REFERENCED_TABLE_NAME}.${constraint.REFERENCED_COLUMN_NAME}`);
    });

    // 关闭连接
    await connection.end();
    console.log('\nFix completed successfully!');
  } catch (error) {
    console.error('Error during fix:', error.message);
    console.error('Full error:', error);
  }
}

// 运行修复脚本
fixForeignKey();