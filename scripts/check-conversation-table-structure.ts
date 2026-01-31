/**
 * 检查对话表结构
 */

import { pool } from '../src/admin/core/database';

async function checkTableStructure() {
  const connection = await pool.getConnection();
  
  try {
    console.log('检查表结构...\n');

    const [columns] = await connection.execute(
      'DESCRIBE crawler_assistant_conversations'
    );

    console.log('crawler_assistant_conversations 表结构:');
    console.table(columns);

  } catch (error) {
    console.error('检查失败:', error);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

checkTableStructure().catch(console.error);
