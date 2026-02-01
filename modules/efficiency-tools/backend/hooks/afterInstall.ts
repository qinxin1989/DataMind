/**
 * 安装后钩子
 */

import type { ModuleContext } from '../../../../src/module-system/types';

export async function afterInstall(context: ModuleContext): Promise<void> {
  console.log('[EfficiencyTools] 模块安装完成');
  console.log('[EfficiencyTools] 已创建模板表');
  console.log('[EfficiencyTools] 功能包括: SQL格式化、数据转换、正则助手、模板管理');
}
