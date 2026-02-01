/**
 * 安装前钩子
 */

import type { ModuleContext } from '../../../../src/module-system/types';

export async function beforeInstall(context: ModuleContext): Promise<void> {
  console.log('[ai-qa] 准备安装AI智能问答模块...');
  
  // 检查依赖模块
  const dependencies = ['ai-config'];
  for (const dep of dependencies) {
    const [rows] = await context.db.query(
      "SELECT status FROM sys_modules WHERE name = ?",
      [dep]
    );
    
    if ((rows as any[]).length === 0) {
      throw new Error(`依赖模块 ${dep} 未安装，请先安装该模块`);
    }
    
    const status = (rows as any[])[0].status;
    if (status !== 'enabled') {
      throw new Error(`依赖模块 ${dep} 未启用，请先启用该模块`);
    }
  }
  
  console.log('[ai-qa] 依赖检查通过');
}
