/**
 * 模块禁用钩子
 */

export async function afterDisable(): Promise<void> {
  console.log('[menu-management] 模块已禁用');
}

