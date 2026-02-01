/**
 * 安装前钩子
 */

import type { ModuleContext } from '../../../../src/module-system/types';

export async function beforeInstall(context: ModuleContext): Promise<void> {
  console.log('[ai-config] 准备安装模块...');
  
  // 检查数据库表是否存在
  const [rows] = await context.db.query(
    "SHOW TABLES LIKE 'sys_ai_configs'"
  );
  
  if ((rows as any[]).length === 0) {
    console.log('[ai-config] 数据库表不存在，需要先运行数据库迁移');
  }
}
