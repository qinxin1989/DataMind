/**
 * 启用前钩子
 */

export default async function beforeEnable() {
  console.log('[role-management] 准备启用角色管理模块...');
  
  return { success: true };
}
