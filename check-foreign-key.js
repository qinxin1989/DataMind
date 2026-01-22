const mysql = require('mysql2/promise');

// 使用与项目相同的数据库配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'ai-data-platform'
};

async function checkForeignKey() {
  try {
    // 创建数据库连接
    const connection = await mysql.createConnection(dbConfig);
    console.log('✅ 成功连接到数据库！');
    
    // 检查datasource_config表的外键约束
    const [constraints] = await connection.execute(`
      SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ?
      AND TABLE_NAME = 'datasource_config'
      AND REFERENCED_TABLE_NAME IS NOT NULL
    `, [dbConfig.database]);
    
    console.log('\ndatasource_config表的外键约束:');
    if (constraints.length === 0) {
      console.log('❌ 没有外键约束');
    } else {
      let hasError = false;
      constraints.forEach(constraint => {
        console.log(`- 约束名称: ${constraint.CONSTRAINT_NAME}`);
        console.log(`  列: ${constraint.COLUMN_NAME}`);
        console.log(`  引用: ${constraint.REFERENCED_TABLE_NAME}.${constraint.REFERENCED_COLUMN_NAME}`);
        
        if (constraint.REFERENCED_TABLE_NAME === 'users') {
          console.log('  ❌ 错误：引用了不存在的users表！');
          hasError = true;
        } else if (constraint.REFERENCED_TABLE_NAME === 'sys_users') {
          console.log('  ✅ 正确：引用了sys_users表！');
        } else {
          console.log('  ⚠️  警告：引用了未知表！');
        }
      });
      
      if (hasError) {
        console.log('\n❌ 测试失败：存在指向错误表(users)的外键约束！');
      } else {
        console.log('\n✅ 测试通过：所有外键约束都指向正确的表(sys_users)！');
      }
    }
    
    // 检查sys_users表是否存在
    const [sysUsersExists] = await connection.execute('SHOW TABLES LIKE "sys_users"');
    console.log('\nsys_users表存在:', sysUsersExists.length > 0 ? '✅' : '❌');
    
    // 关闭连接
    await connection.end();
    console.log('\n数据库连接已关闭');
    
  } catch (error) {
    console.error('❌ 连接数据库失败:', error.message);
    return false;
  }
}

// 运行检查
checkForeignKey();