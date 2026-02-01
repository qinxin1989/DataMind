/**
 * After Uninstall Hook
 * 卸载后钩子
 */

import fs from 'fs';
import path from 'path';

export async function afterUninstall(): Promise<void> {
  console.log('[Dashboard] 大屏管理模块已卸载');
  
  // 清理数据目录
  const dataDir = path.join(process.cwd(), 'data', 'dashboards');
  if (fs.existsSync(dataDir)) {
    try {
      fs.rmSync(dataDir, { recursive: true, force: true });
      console.log('[Dashboard] 数据目录已清理');
    } catch (error) {
      console.error('[Dashboard] 清理数据目录失败:', error);
    }
  }
  
  console.log('[Dashboard] 卸载完成');
}
