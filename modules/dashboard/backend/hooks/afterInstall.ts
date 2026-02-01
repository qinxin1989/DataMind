/**
 * After Install Hook
 * 安装后钩子
 */

import fs from 'fs';
import path from 'path';

export async function afterInstall(): Promise<void> {
  console.log('[Dashboard] 大屏管理模块安装完成');
  
  // 创建数据目录
  const dataDir = path.join(process.cwd(), 'data', 'dashboards');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('[Dashboard] 数据目录创建成功:', dataDir);
  }
  
  // 创建初始数据文件
  const dashboardsFile = path.join(dataDir, 'dashboards.json');
  if (!fs.existsSync(dashboardsFile)) {
    fs.writeFileSync(dashboardsFile, '[]');
    console.log('[Dashboard] 初始数据文件创建成功');
  }
  
  console.log('[Dashboard] 模块初始化完成');
}
