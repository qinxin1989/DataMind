/**
 * 安装后钩子
 */

export async function afterInstall(context: any): Promise<void> {
  console.log('[system-config] 系统配置模块安装完成');
  
  // 验证数据表是否创建成功
  try {
    const result = await context.db.get('SELECT COUNT(*) as count FROM system_configs');
    console.log(`[system-config] 默认配置已加载: ${result.count} 项`);
  } catch (error) {
    console.error('[system-config] 验证失败:', error);
  }
}
