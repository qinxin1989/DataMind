/**
 * 卸载后钩子
 */

import * as fs from 'fs';
import * as path from 'path';

export async function afterUninstall(): Promise<void> {
  console.log('[notification] 通知模块已卸载');
  
  // 可选：清理通知数据目录
  const dataDir = path.join(process.cwd(), 'data', 'notifications');
  if (fs.existsSync(dataDir)) {
    // 注意：这里不自动删除数据，由管理员决定
    console.log('[notification] 通知数据目录保留在:', dataDir);
    console.log('[notification] 如需删除，请手动删除该目录');
  }
}
