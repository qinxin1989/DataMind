/**
 * 安装后钩子
 */

import * as fs from 'fs';
import * as path from 'path';

export async function afterInstall(): Promise<void> {
  console.log('[notification] 通知模块安装完成');
  
  // 创建数据目录
  const dataDir = path.join(process.cwd(), 'data', 'notifications');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('[notification] 创建通知数据目录');
  }
}
