/**
 * 禁用后钩子
 */

export default async function afterDisable() {
  console.log('[role-management] 角色管理模块已禁用');
  
  return { success: true };
}
