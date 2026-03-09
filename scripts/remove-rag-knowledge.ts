import { pool } from '../src/admin/core/database';

async function removeRagKnowledge() {
  const conn = await pool.getConnection();
  try {
    console.log('=== 删除知识库重复菜单 ===\n');
    
    // 1. 删除 rag-knowledge
    await conn.execute("DELETE FROM sys_menus WHERE id = 'rag-knowledge'");
    console.log('✓ 已删除 rag-knowledge');
    
    // 2. 查找所有标题包含"知识库"但不是"知识库管理"的菜单
    const [rows] = await conn.execute(
      "SELECT id, title, parent_id FROM sys_menus WHERE title LIKE '%知识库%' AND id != 'knowledge-base'"
    );
    
    if ((rows as any[]).length > 0) {
      console.log('发现其他知识库菜单:');
      for (const r of rows as any[]) {
        console.log(`  - ${r.id}: ${r.title}`);
        await conn.execute('DELETE FROM sys_menus WHERE id = ?', [r.id]);
        console.log(`    ✓ 已删除`);
      }
    }
    
    // 3. 显示最终结果
    console.log('\n=== AI创新中心下的菜单 ===');
    const [aiMenus] = await conn.execute(
      "SELECT id, title FROM sys_menus WHERE parent_id = 'ai-center' ORDER BY sort_order"
    );
    
    for (const m of aiMenus as any[]) {
      console.log(`  └─ ${m.title} (${m.id})`);
    }
    
    console.log('\n✅ 知识库菜单已清理完成！');
  } catch (e) {
    console.error('错误:', e);
  } finally {
    conn.release();
    pool.end();
  }
}

removeRagKnowledge();
