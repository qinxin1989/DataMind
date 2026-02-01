/**
 * 配置变更钩子
 */

export async function onConfigChange(oldConfig: any, newConfig: any): Promise<void> {
  console.log('[menu-management] 配置已更新');
}
