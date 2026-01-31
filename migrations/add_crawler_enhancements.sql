-- 爬虫系统增强 - 数据库迁移
-- 执行: mysql -u root -p your_database < migrations/add_crawler_enhancements.sql

USE ai_data_platform;

-- 1. 增强 crawler_templates 表
ALTER TABLE crawler_templates
ADD COLUMN IF NOT EXISTS page_type VARCHAR(20) DEFAULT 'static' COMMENT '页面类型: static/dynamic',
ADD COLUMN IF NOT EXISTS auto_generated BOOLEAN DEFAULT FALSE COMMENT '是否AI自动生成',
ADD COLUMN IF NOT EXISTS confidence DECIMAL(5,2) DEFAULT 100.00 COMMENT '置信度(0-100)',
ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP NULL COMMENT '最后使用时间',
ADD COLUMN IF NOT EXISTS usage_count INT DEFAULT 0 COMMENT '使用次数',
ADD COLUMN IF NOT EXISTS tags JSON COMMENT '标签数组';

-- 2. 添加索引
CREATE INDEX IF NOT EXISTS idx_page_type ON crawler_templates(page_type);
CREATE INDEX IF NOT EXISTS idx_auto_generated ON crawler_templates(auto_generated);
CREATE INDEX IF NOT EXISTS idx_tags ON crawler_templates((CAST(tags AS CHAR(255))));

-- 3. 创建通知表
CREATE TABLE IF NOT EXISTS crawler_notifications (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    task_id VARCHAR(36) NULL,
    template_id VARCHAR(36) NULL,
    template_name VARCHAR(100) NULL,
    type VARCHAR(20) NOT NULL COMMENT 'new_data/error/success',
    message TEXT,
    data_count INT DEFAULT 0,
    read_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_read (user_id, read_at),
    INDEX idx_type (type),
    FOREIGN KEY (user_id) REFERENCES sys_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='爬虫通知表';

-- 4. 创建内容分类表
CREATE TABLE IF NOT EXISTS crawler_content_classify (
    id VARCHAR(36) PRIMARY KEY,
    result_item_id VARCHAR(36) NOT NULL,
    category VARCHAR(50) COMMENT '政策/解读/新闻/通知',
    confidence DECIMAL(3,2) COMMENT '分类置信度',
    keywords JSON COMMENT '提取的关键词',
    doc_number VARCHAR(100) COMMENT '文号',
    publisher VARCHAR(200) COMMENT '发文单位',
    publish_date DATE COMMENT '发布日期',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_result_item (result_item_id),
    FOREIGN KEY (result_item_id) REFERENCES crawler_result_items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='内容分类表';

-- 5. 创建去重记录表
CREATE TABLE IF NOT EXISTS crawler_deduplication (
    id VARCHAR(36) PRIMARY KEY,
    template_id VARCHAR(36) NOT NULL,
    content_hash VARCHAR(64) NOT NULL COMMENT '内容SHA256哈希',
    original_item_id VARCHAR(36) COMMENT '原始数据ID',
    is_duplicate BOOLEAN DEFAULT FALSE COMMENT '是否重复',
    duplicate_of VARCHAR(36) COMMENT '重复的数据ID',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_template_hash (template_id, content_hash),
    INDEX idx_duplicate (is_duplicate),
    FOREIGN KEY (template_id) REFERENCES crawler_templates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='去重记录表';

-- 6. 添加系统用户ID用于模板导入
-- 检查是否存在系统用户，不存在则创建
INSERT IGNORE INTO sys_users (id, username, password, name, role, status)
VALUES ('00000000-0000-0000-0000-000000000000', 'system', 'SYSTEM_USER', '系统', 'system', 1);

-- 7. 创建视图：模板统计
CREATE OR REPLACE VIEW v_crawler_template_stats AS
SELECT
    t.id,
    t.name,
    t.user_id,
    t.page_type,
    t.auto_generated,
    t.usage_count,
    t.last_used_at,
    t.confidence,
    COUNT(DISTINCT r.id) as result_count,
    SUM(r.row_count) as total_rows,
    MAX(r.created_at) as last_result_at
FROM crawler_templates t
LEFT JOIN crawler_results r ON t.id = r.template_id
GROUP BY t.id;

-- 8. 创建触发器：更新模板使用统计
DELIMITER $$

CREATE TRIGGER IF NOT EXISTS trg_crawler_template_usage
BEFORE INSERT ON crawler_results
FOR EACH ROW
BEGIN
    IF NEW.template_id IS NOT NULL THEN
        UPDATE crawler_templates
        SET usage_count = usage_count + 1,
            last_used_at = NOW()
        WHERE id = NEW.template_id;
    END IF;
END$$

DELIMITER ;

-- 9. 添加表注释
ALTER TABLE crawler_templates COMMENT='爬虫模板表';
ALTER TABLE crawler_results COMMENT='爬虫结果批次表';
ALTER TABLE crawler_tasks COMMENT='定时任务表';

-- 10. 创建存储过程：检测重复数据
DELIMITER $$

CREATE PROCEDURE IF NOT EXISTS sp_detect_crawler_duplicates(
    IN p_template_id VARCHAR(36),
    IN p_result_id VARCHAR(36)
)
BEGIN
    DECLARE v_count INT DEFAULT 0;

    -- 检测重复（基于标题哈希）
    INSERT IGNORE INTO crawler_deduplication (id, template_id, content_hash, original_item_id, is_duplicate)
    SELECT
        UUID(),
        p_template_id,
        SHA2(CONCAT(COALESCE(field_value, '')), 256),
        row_id,
        0
    FROM crawler_result_items
    WHERE result_id IN (
        SELECT id FROM crawler_result_rows WHERE result_id = p_result_id
    )
    AND field_name = '标题';

    -- 标记重复项
    UPDATE crawler_deduplication d1
    JOIN crawler_deduplication d2 ON d1.content_hash = d2.content_hash AND d1.id < d2.id
    SET d1.is_duplicate = TRUE, d1.duplicate_of = d2.original_item_id
    WHERE d1.template_id = p_template_id;

    SELECT COUNT(*) INTO v_count
    FROM crawler_deduplication
    WHERE template_id = p_template_id AND is_duplicate = TRUE;

    SELECT v_count as duplicate_count;
END$$

DELIMITER ;

COMMIT;
