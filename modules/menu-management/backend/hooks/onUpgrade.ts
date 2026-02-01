/**
 * 模块升级钩子
 */

export async function onUpgrade(fromVersion: string, toVersion: string): Promise<void> {
  console.log(`[menu-management] 模块从 ${fromVersion} 升级到 ${toVersion}`);
}
