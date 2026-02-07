
import { pool } from '../src/admin/core/database';

async function fixChatHistoryTable() {
    try {
        console.log('正在检查 chat_history 表结构...');
        const [columns] = await pool.execute('SHOW COLUMNS FROM chat_history');
        console.log('当前列:', (columns as any[]).map(c => c.Field).join(', '));

        const fields = (columns as any[]).map(c => c.Field);

        if (!fields.includes('messages')) {
            console.log('检测到缺失 messages 列，正在添加...');
            // 添加 messages 列，类型为 MEDIUMTEXT 以支持长对话
            // 如果存在旧的 content 列，我们可能需要迁移数据，但首先确保列存在
            await pool.execute('ALTER TABLE chat_history ADD COLUMN messages MEDIUMTEXT');
            console.log('messages 列添加成功');
        } else {
            console.log('messages 列已存在');
        }

        // 顺便检查 user_id
        if (!fields.includes('user_id')) {
            console.log('检测到缺失 user_id 列，正在添加...');
            await pool.execute("ALTER TABLE chat_history ADD COLUMN user_id VARCHAR(36) NOT NULL DEFAULT '' AFTER id");
            console.log('user_id 列添加成功');
        }

        console.log('修复完成');
    } catch (error) {
        console.error('修复失败:', error);
    } finally {
        process.exit();
    }
}

fixChatHistoryTable();
