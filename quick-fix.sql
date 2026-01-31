-- 快速修复脚本
USE `ai-data-platform`;

-- 1. 添加菜单
DELETE FROM admin_menus WHERE id = 'ai-crawler-assistant';
INSERT INTO admin_menus (id, title, path, icon, parent_id, sort_order, is_system, visible)
VALUES ('ai-crawler-assistant', 'AI爬虫助手', '/ai/crawler-assistant', 'RobotOutlined', '00000000-0000-0000-0000-000000000005', 5, TRUE, TRUE);

-- 2. 添加测试模板
DELETE FROM crawler_template_fields WHERE template_id = 'test-template-001';
DELETE FROM crawler_templates WHERE id = 'test-template-001';
INSERT INTO crawler_templates (id, user_id, name, url, container_selector)
VALUES ('test-template-001', 'admin', '示例新闻爬虫', 'https://example.com/news', '.news-item');

INSERT INTO crawler_template_fields (id, template_id, field_name, field_selector) VALUES
('test-field-001', 'test-template-001', '标题', '.title'),
('test-field-002', 'test-template-001', '链接', 'a.href');

-- 3. 添加测试数据
DELETE FROM crawler_result_items WHERE row_id IN ('test-row-001', 'test-row-002', 'test-row-003');
DELETE FROM crawler_result_rows WHERE id IN ('test-row-001', 'test-row-002', 'test-row-003');
DELETE FROM crawler_results WHERE id = 'test-result-001';

INSERT INTO crawler_results (id, user_id, template_id, status, row_count)
VALUES ('test-result-001', 'admin', 'test-template-001', 'completed', 3);

INSERT INTO crawler_result_rows (id, result_id) VALUES
('test-row-001', 'test-result-001'),
('test-row-002', 'test-result-001'),
('test-row-003', 'test-result-001');

INSERT INTO crawler_result_items (id, row_id, field_name, field_value) VALUES
('test-item-001', 'test-row-001', '标题', '<a href="https://example.com/news/1">测试新闻1</a>'),
('test-item-002', 'test-row-001', '链接', 'https://example.com/news/1'),
('test-item-003', 'test-row-002', '标题', '<a href="https://example.com/news/2">测试新闻2</a>'),
('test-item-004', 'test-row-002', '链接', 'https://example.com/news/2'),
('test-item-005', 'test-row-003', '标题', '<a href="https://example.com/news/3">测试新闻3</a>'),
('test-item-006', 'test-row-003', '链接', 'https://example.com/news/3');

-- 验证
SELECT '✅ 完成！请刷新浏览器查看' as message;
