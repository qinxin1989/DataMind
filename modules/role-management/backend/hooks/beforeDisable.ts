/**
 * 禁用前钩子
 */

export default async function beforeDisable() {
  console.log('[role-management] 准备禁用角色管理模块...');
  
  return { success: true };
}
