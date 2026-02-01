/**
 * 卸载前钩子
 */

import { pool } from '../../../../src/admin/core/database';

export default async function beforeUninstall() {
  console.log('[role-management] 准备卸载角色管理模块...');
  
  // 检查是否有角色正在使用
  try {
    const [rows] = await pool.execute('SELECT COUNT(*) as count FROM sys_roles WHERE is_system = FALSE');
    const count = (rows as any[])[0].count;
    
    if (count > 0) {
      console.warn(`[role-management] 警告: 存在 ${count} 个自定义角色`);
    }
  } catch (error) {
    console.error('[role-management] 检查角色失败:', error);
  }
  
  return { success: true };
}
