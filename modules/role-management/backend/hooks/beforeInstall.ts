/**
 * 安装前钩子
 */

export default async function beforeInstall() {
  console.log('[role-management] 准备安装角色管理模块...');
  
  // 检查依赖模块
  console.log('[role-management] 检查依赖: user-management');
  
  return { success: true };
}
