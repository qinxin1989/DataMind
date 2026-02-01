/**
 * 安装后钩子
 */

import type { ModuleContext } from '../../../../src/module-system/types';

export async function afterInstall(context: ModuleContext): Promise<void> {
  console.log('[file-tools] 执行安装后操作...');

  const { db } = context;

  // 验证数据库表是否创建成功
  try {
    const result = await db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='file_conversion_history'"
    );
    
    if (!result) {
      throw new Error('数据库表创建失败');
    }

    console.log('[file-tools] 数据库表验证成功');
  } catch (error: any) {
    console.error('[file-tools] 数据库表验证失败:', error);
    throw error;
  }

  // 创建必要的目录
  const fs = require('fs');
  const path = require('path');
  
  const dirs = [
    path.join(process.cwd(), 'uploads', 'file-tools'),
    path.join(process.cwd(), 'uploads', 'file-tools', 'temp'),
    path.join(process.cwd(), 'uploads', 'temp')
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`[file-tools] 创建目录: ${dir}`);
    }
  }

  console.log('[file-tools] 安装后操作完成');
}
