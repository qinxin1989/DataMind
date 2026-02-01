/**
 * 启用前钩子
 */

import type { ModuleContext } from '../../../../src/module-system/types';

export async function beforeEnable(context: ModuleContext): Promise<void> {
  console.log('[file-tools] 执行启用前检查...');

  // 检查数据库连接
  const { db } = context;
  try {
    await db.get('SELECT 1');
    console.log('[file-tools] 数据库连接正常');
  } catch (error) {
    throw new Error('数据库连接失败，无法启用模块');
  }

  // 检查上传目录
  const fs = require('fs');
  const path = require('path');
  const uploadDir = path.join(process.cwd(), 'uploads', 'file-tools');
  
  if (!fs.existsSync(uploadDir)) {
    throw new Error('上传目录不存在，请重新安装模块');
  }

  console.log('[file-tools] 启用前检查通过');
}
