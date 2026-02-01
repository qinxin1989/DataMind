/**
 * 安装后钩子
 */

import type { ModuleContext } from '../../../../src/module-system/types';

export async function afterInstall(context: ModuleContext): Promise<void> {
  console.log('[OfficialDoc] 模块安装完成');
  console.log('[OfficialDoc] 已创建模板表和历史表');
  console.log('[OfficialDoc] 支持工作报告、通知公告、会议纪要、计划方案');
}
