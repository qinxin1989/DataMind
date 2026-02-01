/**
 * 卸载后钩子
 */

import type { ModuleContext } from '../../../../src/module-system/types';

export async function afterUninstall(context: ModuleContext): Promise<void> {
  console.log('[file-tools] 执行卸载后清理...');

  const { db } = context;

  // 删除数据库表
  try {
    await db.run('DROP TABLE IF EXISTS file_conversion_history');
    console.log('[file-tools] 数据库表已删除');
  } catch (error) {
    console.error('[file-tools] 删除数据库表失败:', error);
  }

  // 清理上传目录（可选）
  const fs = require('fs');
  const path = require('path');
  const uploadDir = path.join(process.cwd(), 'uploads', 'file-tools');
  
  try {
    if (fs.existsSync(uploadDir)) {
      // 递归删除目录
      fs.rmSync(uploadDir, { recursive: true, force: true });
      console.log('[file-tools] 上传目录已清理');
    }
  } catch (error) {
    console.error('[file-tools] 清理上传目录失败:', error);
  }

  console.log('[file-tools] 卸载后清理完成');
}
