/**
 * 安装前钩子
 */

import { PoolConnection } from 'mysql2/promise';

export async function beforeInstall(connection: PoolConnection): Promise<void> {
  console.log('[crawler-template-config] 开始安装前检查...');
  
  // 检查crawler_templates表是否存在
  const [tables] = await connection.query<any[]>(
    "SHOW TABLES LIKE 'crawler_templates'"
  );
  
  if (tables.length === 0) {
    throw new Error('数据库表 crawler_templates 不存在，请先运行数据库迁移脚本');
  }
  
  console.log('[crawler-template-config] 安装前检查通过');
}
