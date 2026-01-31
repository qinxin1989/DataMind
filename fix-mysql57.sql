-- ============================================
-- 修复脚本（兼容MySQL 5.7+）
-- ============================================

USE `ai-data-platform`;

-- ========== 第一步：添加菜单（使用 sys_menus） ==========

DELETE FROM sys_menus WHERE id = 'ai-crawler-assistant';
DELETE FROM sys_menus WHERE path = '/ai-crawler-assistant';

INSERT INTO sys_menus (id, title, path, icon, parent_id, sort_order, is_system, visible)
VALUES ('ai-crawler-assistant', 'AI爬虫助手', '/ai/crawler-assistant', 'RobotOutlined', '00000000-0000-0000-0000-000000000005', 5, TRUE, TRUE);


-- ========== 第二步：查找并使用正确的admin用户ID ==========

-- 方案A：使用子查询直接插入（推荐）
INSERT INTO crawler_templates (id, user_id, name, url, container_selector, created_at)
SELECT 'test-template-001', id, '示例新闻爬虫', 'https://example.com/news', '.news-item', NOW()
FROM users
WHERE username = 'admin'
LIMIT 1;


-- ========== 第三步：添加模板字段 ==========

INSERT INTO crawler_template_fields (id, template_id, field_name, field_selector) VALUES
('test-field-001', 'test-template-001', '标题', '.title'),
('test-field-002', 'test-template-001', '链接', 'a.href'),
('test-field-003', 'test-template-001', '时间', '.time'),
('test-field-004', 'test-template-001', '摘要', '.summary');


-- ========== 第四步：添加采集结果 ==========

INSERT INTO crawler_results (id, user_id, template_id, status, row_count, created_at)
SELECT 'test-result-001', u.id, 'test-template-001', 'completed', 3, NOW()
FROM users u
WHERE u.username = 'admin'
LIMIT 1;


-- ========== 第五步：添加数据行 ==========

INSERT INTO crawler_result_rows (id, result_id, created_at) VALUES
('test-row-001', 'test-result-001', NOW()),
('test-row-002', 'test-result-001', NOW()),
('test-row-003', 'test-result-001', NOW());


-- ========== 第六步：添加字段值 ==========

INSERT INTO crawler_result_items (id, row_id, field_name, field_value) VALUES
('test-item-001', 'test-row-001', '标题', '<a href="https://example.com/news/1">人工智能技术取得重大突破</a>'),
('test-item-002', 'test-row-001', '链接', 'https://example.com/news/1'),
('test-item-003', 'test-row-001', '时间', '2024-01-15 10:30:00'),
('test-item-004', 'test-row-001', '摘要', '最新研究表明，AI在多个领域取得突破性进展...'),

('test-item-005', 'test-row-002', '标题', '<a href="https://example.com/news/2">全球气候峰会达成新协议</a>'),
('test-item-006', 'test-row-002', '链接', 'https://example.com/news/2'),
('test-item-007', 'test-row-002', '时间', '2024-01-15 09:15:00'),
('test-item-008', 'test-row-002', '摘要', '各国代表在气候峰会上签署了新的减排协议...'),

('test-item-009', 'test-row-003', '标题', '<a href="https://example.com/news/3">股市今日大涨，科技股领涨</a>'),
('test-item-010', 'test-row-003', '链接', 'https://example.com/news/3'),
('test-item-011', 'test-row-003', '时间', '2024-01-15 15:45:00'),
('test-item-012', 'test-row-003', '摘要', '受多项利好消息影响，今日股市大幅上涨...');


-- ========== 验证 ==========

SELECT '✅ 完成！请刷新浏览器' as message;
