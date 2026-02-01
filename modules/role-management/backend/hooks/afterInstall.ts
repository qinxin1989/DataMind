/**
 * 安装后钩子
 */

import { pool } from '../../../../src/admin/core/database';

export default async function afterInstall() {
  console.log('[role-management] 角色管理模块安装完成');
  
  // 初始化默认角色
  try {
    const [rows] = await pool.execute('SELECT COUNT(*) as count FROM sys_roles');
    const count = (rows as any[])[0].count;
    
    if (count === 0) {
      console.log('[role-management] 初始化默认角色...');
      // 这里可以创建默认角色
    }
  } catch (error) {
    console.error('[role-management] 初始化默认角色失败:', error);
  }
  
  return { success: true };
}
