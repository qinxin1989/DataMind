/**
 * 检查对话历史表中的数据
 */

import { pool } from '../src/admin/core/database';

async function checkConversations() {
  const connection = await pool.getConnection();
  
  try {
    console.log('检查对话历史表...\n');

    // 1. 检查表是否存在
    const [tables] = await connection.execute(
      `SHOW TABLES LIKE 'crawler_assistant_conversations'`
    );

    if ((tables as any[]).length === 0) {
      console.log('❌ 表 crawler_assistant_conversations 不存在！');
      return;
    }

    console.log('✓ 表存在\n');

    // 2. 查看所有记录
    const [rows] = await connection.execute(
      'SELECT id, user_id, title, LENGTH(messages) as msg_length, created_at, updated_at FROM crawler_assistant_conversations'
    );

    console.log('对话记录:');
    console.table(rows);

    // 3. 检查是否有空的或无效的 messages 字段
    const [invalidRows] = await connection.execute(
      `SELECT id, user_id, title, messages FROM crawler_assistant_conversations 
       WHERE messages IS NULL OR messages = '' OR messages = 'null'`
    );

    if ((invalidRows as any[]).length > 0) {
      console.log('\n⚠️ 发现无效的 messages 字段:');
      console.table(invalidRows);
      
      console.log('\n修复这些记录...');
      for (const row of invalidRows as any[]) {
        await connection.execute(
          'UPDATE crawler_assistant_conversations SET messages = ? WHERE id = ?',
          [JSON.stringify([]), row.id]
        );
        console.log(`✓ 已修复记录: ${row.id}`);
      }
    } else {
      console.log('\n✓ 所有记录的 messages 字段都有效');
    }

    console.log('\n✅ 检查完成！');

  } catch (error) {
    console.error('检查失败:', error);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

checkConversations().catch(console.error);
