/**
 * 将 users 表数据迁移到 sys_users 表
 */

import { pool } from '../src/admin/core/database';

async function migrateUsers() {
  const connection = await pool.getConnection();
  
  try {
    console.log('开始迁移用户数据...');
    
    // 检查 users 表是否存在
    const [tables] = await connection.execute(
      `SELECT TABLE_NAME FROM information_schema.TABLES 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`
    );
    
    if ((tables as any[]).length === 0) {
      console.log('users 表不存在，无需迁移');
      return;
    }
    
    // 获取 users 表中的所有用户
    const [users] = await connection.execute('SELECT * FROM users');
    const userList = users as any[];
    
    if (userList.length === 0) {
      console.log('users 表中没有数据');
      return;
    }
    
    console.log(`找到 ${userList.length} 个用户需要迁移`);
    
    let migrated = 0;
    let skipped = 0;
    
    for (const user of userList) {
      // 检查 sys_users 中是否已存在该用户
      const [existing] = await connection.execute(
        'SELECT id FROM sys_users WHERE id = ? OR username = ?',
        [user.id, user.username]
      );
      
      if ((existing as any[]).length > 0) {
        console.log(`跳过用户 ${user.username}（已存在）`);
        skipped++;
        continue;
      }
      
      // 插入到 sys_users
      await connection.execute(
        `INSERT INTO sys_users (id, username, password_hash, email, full_name, role, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user.id,
          user.username,
          user.password,  // users 表的密码字段名是 password
          user.email,
          user.full_name,
          user.role || 'user',
          user.status || 'active',
          user.created_at,
          user.updated_at
        ]
      );
      
      console.log(`已迁移用户: ${user.username}`);
      migrated++;
    }
    
    console.log(`\n迁移完成！`);
    console.log(`- 成功迁移: ${migrated} 个用户`);
    console.log(`- 跳过: ${skipped} 个用户`);
    
    // 询问是否删除 users 表
    console.log('\n如需删除 users 表，请手动执行: DROP TABLE users;');
    
  } catch (error: any) {
    console.error('迁移失败:', error.message);
  } finally {
    connection.release();
    process.exit(0);
  }
}

migrateUsers();
