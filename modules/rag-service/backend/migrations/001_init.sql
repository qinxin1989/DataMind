-- RAG 知识库服务数据库迁移
-- Version: 1.0.0

-- 知识分类表
CREATE TABLE IF NOT EXISTS knowledge_categories (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  parent_id VARCHAR(36),
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES knowledge_categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 知识文档表
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id VARCHAR(36) PRIMARY KEY,
  knowledge_base_id VARCHAR(36),
  user_id VARCHAR(36) NOT NULL,
  type ENUM('datasource', 'document', 'webpage', 'note') NOT NULL DEFAULT 'document',
  title VARCHAR(255) NOT NULL,
  content LONGTEXT,
  category_id VARCHAR(36),
  status ENUM('pending', 'indexed', 'failed') DEFAULT 'pending',
  chunk_count INT DEFAULT 0,
  file_size BIGINT DEFAULT 0,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_category_id (category_id),
  INDEX idx_type (type),
  INDEX idx_status (status),
  FULLTEXT INDEX ft_content (title, content)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 知识分块表
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id VARCHAR(36) PRIMARY KEY,
  document_id VARCHAR(36) NOT NULL,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  embedding JSON,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_document_id (document_id),
  FOREIGN KEY (document_id) REFERENCES knowledge_documents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 知识实体表（知识图谱）
CREATE TABLE IF NOT EXISTS knowledge_entities (
  id VARCHAR(36) PRIMARY KEY,
  knowledge_base_id VARCHAR(36),
  type VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  name_cn VARCHAR(255),
  description TEXT,
  properties JSON,
  source_document_id VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_type (type),
  INDEX idx_name (name),
  INDEX idx_source_document (source_document_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 知识关系表（知识图谱）
CREATE TABLE IF NOT EXISTS knowledge_relations (
  id VARCHAR(36) PRIMARY KEY,
  knowledge_base_id VARCHAR(36),
  type VARCHAR(50) NOT NULL,
  source_id VARCHAR(36) NOT NULL,
  target_id VARCHAR(36) NOT NULL,
  properties JSON,
  weight DECIMAL(5,4) DEFAULT 1.0,
  source_document_id VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_source_id (source_id),
  INDEX idx_target_id (target_id),
  INDEX idx_type (type),
  FOREIGN KEY (source_id) REFERENCES knowledge_entities(id) ON DELETE CASCADE,
  FOREIGN KEY (target_id) REFERENCES knowledge_entities(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入默认分类
INSERT INTO knowledge_categories (id, name, description, sort_order) VALUES
  (UUID(), '技术文档', '系统技术相关文档', 1),
  (UUID(), '业务知识', '业务流程和规则文档', 2),
  (UUID(), '常见问题', 'FAQ 和帮助文档', 3)
ON DUPLICATE KEY UPDATE name = VALUES(name);
