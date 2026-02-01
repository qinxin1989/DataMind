/**
 * 安装后钩子
 */

import * as fs from 'fs';
import * as path from 'path';

export async function afterInstall(context: any): Promise<void> {
  console.log('[system-backup] 系统备份模块安装完成');
  
  // 创建备份目录
  const backupDir = path.join(process.cwd(), 'data', 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
    console.log('[system-backup] 备份目录已创建');
  }
}
