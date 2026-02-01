/**
 * 安装后钩子
 */

import { PoolConnection } from 'mysql2/promise';

export async function afterInstall(connection: PoolConnection): Promise<void> {
  console.log('[crawler-template-config] 执行安装后操作...');
  
  // 检查是否有默认模板，如果没有则创建示例模板
  const [rows] = await connection.query<any[]>(
    'SELECT COUNT(*) as count FROM crawler_templates'
  );
  
  const count = rows[0].count;
  
  if (count === 0) {
    console.log('[crawler-template-config] 创建示例模板...');
    
    await connection.query(
      `INSERT INTO crawler_templates (
        name, department, data_type, url, container_selector, fields,
        pagination_enabled, pagination_next_selector, pagination_max_pages,
        created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        '示例模板',
        '示例部门',
        '通知公告',
        'https://example.com',
        '.list-item',
        JSON.stringify([
          { name: '标题', selector: 'a' },
          { name: '链接', selector: 'a::attr(href)' },
          { name: '发布日期', selector: '.date' }
        ]),
        true,
        '.next-page',
        50,
        1
      ]
    );
    
    console.log('[crawler-template-config] 示例模板创建成功');
  }
  
  console.log('[crawler-template-config] 安装完成');
}
