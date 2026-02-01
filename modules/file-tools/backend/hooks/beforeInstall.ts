/**
 * 安装前钩子
 */

import type { ModuleContext } from '../../../../src/module-system/types';

export async function beforeInstall(context: ModuleContext): Promise<void> {
  console.log('[file-tools] 执行安装前检查...');

  // 检查必要的依赖
  const requiredPackages = ['multer', 'pdf-parse', 'xlsx'];
  for (const pkg of requiredPackages) {
    try {
      require.resolve(pkg);
    } catch (error) {
      throw new Error(`缺少必要的依赖包: ${pkg}，请运行 npm install ${pkg}`);
    }
  }

  // 检查上传目录权限
  const fs = require('fs');
  const path = require('path');
  const uploadDir = path.join(process.cwd(), 'uploads', 'file-tools');
  
  try {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    // 测试写入权限
    const testFile = path.join(uploadDir, '.test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
  } catch (error: any) {
    throw new Error(`上传目录权限不足: ${error.message}`);
  }

  console.log('[file-tools] 安装前检查通过');
}
