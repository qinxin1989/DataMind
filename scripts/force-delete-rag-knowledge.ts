import { pool } from '../src/admin/core/database';

async function forceDeleteRagKnowledge() {
  const conn = await pool.getConnection();
  try {
    console.log('=== 强制删除 rag-knowledge 菜单 ===\n');
    
    // 不管 parent_id 是什么，直接删除 rag-knowledge
    const [result] = await conn.execute(
      "DELETE FROM sys_menus WHERE id = 'rag-knowledge'"
    );
    
    console.log(`删除结果: ${JSON.stringify(result)}`);
    
    // 检查是否还有重复的知识库菜单
    const [rows] = await conn.execute(
      "SELECT id, title, parent_id FROM sys_menus WHERE id = 'rag-knowledge' OR (title LIKE '%知识库%' AND title != '知识库管理')"
    );
    
    if ((rows as any[]).length > 0) {
      console.log('\n发现其他知识库菜单:');
      for (const r of rows as any[]) {
        console.log(`  - ${r.id}: ${r.title} (parent: ${r.parent_id})`);
      }
    } else {
      console.log('\n✅ rag-knowledge 已彻底删除');
    }
    
    // 显示最终 AI 创新中心下的菜单
    console.log('\n=== AI 创新中心下的菜单 ===');
    const [aiMenus] = await conn.execute(
      "SELECT id, title FROM sys_menus WHERE parent_id = 'ai-center' ORDER BY sort_order"
    );
    
    for (const m of aiMenus as any[]) {
      console.log(`  └─ ${m.title} (${m.id})`);
    }
    
  } catch (e) {
    console.error('错误:', e);
  } finally {
    conn.release();
    pool.end();
  }
}

forceDeleteRagKnowledge();
