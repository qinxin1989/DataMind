/**
 * 重构对话历史表结构 - 将JSON改为分表存储
 */

import { pool } from '../src/admin/core/database';

async function refactorConversationTables() {
  const connection = await pool.getConnection();
  
  try {
    console.log('开始重构对话历史表结构...\n');

    // 1. 备份现有数据
    console.log('1. 备份现有数据...');
    const [existingConversations] = await connection.execute(
      'SELECT * FROM crawler_assistant_conversations'
    );
    console.log(`✓ 找到 ${(existingConversations as any[]).length} 条对话记录\n`);

    // 2. 创建新的消息表（不带外键）
    console.log('2. 创建新的消息表...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS crawler_assistant_messages (
        id VARCHAR(36) PRIMARY KEY,
        conversation_id VARCHAR(36) NOT NULL,
        role ENUM('user', 'ai') NOT NULL,
        type VARCHAR(50) NOT NULL DEFAULT 'text',
        content TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_conversation_id (conversation_id),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ 消息表创建成功\n');

    // 3. 迁移现有数据
    console.log('3. 迁移现有数据到新表...');
    const { v4: uuidv4 } = require('uuid');
    
    for (const conv of existingConversations as any[]) {
      try {
        const messages = JSON.parse(conv.messages || '[]');
        
        for (const msg of messages) {
          const messageId = uuidv4();
          await connection.execute(
            `INSERT INTO crawler_assistant_messages 
             (id, conversation_id, role, type, content, created_at) 
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [
              messageId,
              conv.id,
              msg.role || 'user',
              msg.type || 'text',
              JSON.stringify(msg.content || msg)
            ]
          );
        }
        
        console.log(`✓ 已迁移对话 ${conv.id} 的 ${messages.length} 条消息`);
      } catch (err) {
        console.error(`✗ 迁移对话 ${conv.id} 失败:`, err);
      }
    }
    console.log('\n');

    // 4. 修改对话表结构 - 删除 messages 字段
    console.log('4. 修改对话表结构...');
    await connection.execute(
      'ALTER TABLE crawler_assistant_conversations DROP COLUMN messages'
    );
    console.log('✓ 已删除 messages 字段\n');

    // 5. 显示新的表结构
    console.log('5. 新的表结构:');
    
    const [convColumns] = await connection.execute(
      'DESCRIBE crawler_assistant_conversations'
    );
    console.log('\ncrawler_assistant_conversations:');
    console.table(convColumns);

    const [msgColumns] = await connection.execute(
      'DESCRIBE crawler_assistant_messages'
    );
    console.log('\ncrawler_assistant_messages:');
    console.table(msgColumns);

    // 6. 验证数据
    console.log('\n6. 验证迁移结果:');
    const [convCount] = await connection.execute(
      'SELECT COUNT(*) as count FROM crawler_assistant_conversations'
    );
    const [msgCount] = await connection.execute(
      'SELECT COUNT(*) as count FROM crawler_assistant_messages'
    );
    
    console.log(`对话数量: ${(convCount as any[])[0].count}`);
    console.log(`消息数量: ${(msgCount as any[])[0].count}`);

    console.log('\n✅ 表结构重构完成！');

  } catch (error) {
    console.error('重构失败:', error);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

refactorConversationTables().catch(console.error);
