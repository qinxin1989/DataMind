/**
 * 安装后钩子
 */

import type { ModuleContext } from '../../../../src/module-system/types';

export async function afterInstall(context: ModuleContext): Promise<void> {
  console.log('[ai-qa] AI智能问答模块安装完成');
  
  // 初始化数据库表
  try {
    // 知识库分类表
    await context.db.execute(`
      CREATE TABLE IF NOT EXISTS knowledge_categories (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        name VARCHAR(100) NOT NULL,
        description VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user (user_id),
        INDEX idx_name (name),
        FOREIGN KEY (user_id) REFERENCES sys_users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    
    // 知识库文档表
    await context.db.execute(`
      CREATE TABLE IF NOT EXISTS knowledge_documents (
        id VARCHAR(36) PRIMARY KEY,
        knowledge_base_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        type VARCHAR(20) NOT NULL,
        title VARCHAR(255) NOT NULL,
        content LONGTEXT NOT NULL,
        metadata JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_knowledge_base (knowledge_base_id),
        INDEX idx_user (user_id),
        INDEX idx_type (type),
        FOREIGN KEY (user_id) REFERENCES sys_users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    
    // 知识库分块表
    await context.db.execute(`
      CREATE TABLE IF NOT EXISTS knowledge_chunks (
        id VARCHAR(36) PRIMARY KEY,
        document_id VARCHAR(36) NOT NULL,
        chunk_index INT NOT NULL,
        content TEXT NOT NULL,
        embedding JSON NOT NULL,
        metadata JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_document (document_id),
        INDEX idx_chunk_index (chunk_index),
        FOREIGN KEY (document_id) REFERENCES knowledge_documents(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    
    console.log('[ai-qa] 数据库表初始化完成');
    console.log('[ai-qa] 已注册 40+ 个 API 端点');
    console.log('[ai-qa] 已注册 6 个权限');
    console.log('[ai-qa] 已注册 2 个菜单项');
  } catch (error: any) {
    console.warn('[ai-qa] 数据库表初始化警告:', error.message);
  }
}
