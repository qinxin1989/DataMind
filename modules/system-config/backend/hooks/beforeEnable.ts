/**
 * 启用前钩子
 */

export async function beforeEnable(context: any): Promise<void> {
  console.log('[system-config] 准备启用系统配置模块...');
  
  // 检查配置表是否存在
  try {
    await context.db.get('SELECT 1 FROM system_configs LIMIT 1');
    console.log('[system-config] 配置表检查通过');
  } catch (error) {
    throw new Error('配置表不存在，请先安装模块');
  }
}
