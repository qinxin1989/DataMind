/**
 * 卸载后钩子
 */

export default async function afterUninstall() {
  console.log('[role-management] 角色管理模块已卸载');
  console.log('[role-management] 注意: 角色数据已保留，如需清理请手动删除');
  
  return { success: true };
}
