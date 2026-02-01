/**
 * 启用后钩子
 */

export default async function afterEnable() {
  console.log('[role-management] 角色管理模块已启用');
  
  return { success: true };
}
