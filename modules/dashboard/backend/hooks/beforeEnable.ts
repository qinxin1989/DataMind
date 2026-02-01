/**
 * Before Enable Hook
 * 启用前钩子
 */

import fs from 'fs';
import path from 'path';

export async function beforeEnable(): Promise<void> {
  console.log('[Dashboard] 准备启用大屏管理模块...');
  
  // 检查数据目录
  const dataDir = path.join(process.cwd(), 'data', 'dashboards');
  if (!fs.existsSync(dataDir)) {
    console.log('[Dashboard] 数据目录不存在，正在创建...');
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  console.log('[Dashboard] 启用前检查完成');
}
