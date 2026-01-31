-- ============================================
-- 修复脚本：自动查找正确的用户ID
-- ============================================

USE `ai-data-platform`;

-- 设置变量（MySQL 8.0+）或使用子查询
-- 先查找admin用户的ID
SET @admin_id = (SELECT id FROM users WHERE username = 'admin' LIMIT 1);

-- 显示找到的用户ID
SELECT '使用管理员用户ID: ' as info, @admin_id as user_id;

-- 如果找不到admin用户，使用第一个用户
SET @admin_id = IFNULL(@admin_id, (SELECT id FROM users LIMIT 1));


-- ========== 第一部分：添加菜单（使用 sys_menus） ==========

-- 1. 删除可能存在的旧菜单
DELETE FROM sys_menus WHERE id = 'ai-crawler-assistant';
DELETE FROM sys_menus WHERE path = '/ai/crawler-assistant';

-- 2. 添加 AI 爬虫助手菜单
INSERT INTO sys_menus (id, title, path, icon, parent_id, sort_order, is_system, visible)
VALUES ('ai-crawler-assistant', 'AI爬虫助手', '/ai/crawler-assistant', 'RobotOutlined', '00000000-0000-0000-0000-000000000005', 5, TRUE, TRUE);

-- 3. 验证菜单
SELECT '========== 菜单验证 ==========' as '';
SELECT id, title, path, sort_order FROM sys_menus WHERE id = 'ai-crawler-assistant';


-- ========== 第二部分：添加测试数据 ==========

-- 清理旧数据
DELETE FROM crawler_result_items WHERE row_id IN (SELECT id FROM crawler_result_rows WHERE result_id = 'test-result-001');
DELETE FROM crawler_result_rows WHERE result_id = 'test-result-001';
DELETE FROM crawler_results WHERE id = 'test-result-001';
DELETE FROM crawler_template_fields WHERE template_id = 'test-template-001';
DELETE FROM crawler_templates WHERE id = 'test-template-001';

-- 1. 创建测试模板（使用动态用户ID）
INSERT INTO crawler_templates (id, user_id, name, url, container_selector, created_at)
VALUES ('test-template-001', @admin_id, '示例新闻爬虫', 'https://example.com/news', '.news-item', NOW());

-- 2. 创建模板字段
INSERT INTO crawler_template_fields (id, template_id, field_name, field_selector) VALUES
('test-field-001', 'test-template-001', '标题', '.title'),
('test-field-002', 'test-template-001', '链接', 'a.href'),
('test-field-003', 'test-template-001', '时间', '.time'),
('test-field-004', 'test-template-001', '摘要', '.summary');

-- 3. 创建采集结果批次
INSERT INTO crawler_results (id, user_id, template_id, status, row_count, created_at)
VALUES ('test-result-001', @admin_id, 'test-template-001', 'completed', 3, NOW());

-- 4. 创建数据行
INSERT INTO crawler_result_rows (id, result_id, created_at) VALUES
('test-row-001', 'test-result-001', NOW()),
('test-row-002', 'test-result-001', NOW()),
('test-row-003', 'test-result-001', NOW());

-- 5. 创建字段值
INSERT INTO crawler_result_items (id, row_id, field_name, field_value) VALUES
-- 第一条
('test-item-001', 'test-row-001', '标题', '<a href="https://example.com/news/1">人工智能技术取得重大突破</a>'),
('test-item-002', 'test-row-001', '链接', 'https://example.com/news/1'),
('test-item-003', 'test-row-001', '时间', '2024-01-15 10:30:00'),
('test-item-004', 'test-row-001', '摘要', '最新研究表明，AI在多个领域取得突破性进展...'),
-- 第二条
('test-item-005', 'test-row-002', '标题', '<a href="https://example.com/news/2">全球气候峰会达成新协议</a>'),
('test-item-006', 'test-row-002', '链接', 'https://example.com/news/2'),
('test-item-007', 'test-row-002', '时间', '2024-01-15 09:15:00'),
('test-item-008', 'test-row-002', '摘要', '各国代表在气候峰会上签署了新的减排协议...'),
-- 第三条
('test-item-009', 'test-row-003', '标题', '<a href="https://example.com/news/3">股市今日大涨，科技股领涨</a>'),
('test-item-010', 'test-row-003', '链接', 'https://example.com/news/3'),
('test-item-011', 'test-row-003', '时间', '2024-01-15 15:45:00'),
('test-item-012', 'test-row-003', '摘要', '受多项利好消息影响，今日股市大幅上涨...');


-- ========== 第三部分：验证 ==========

SELECT '' as '';
SELECT '========== 数据验证 ==========' as '';

SELECT '✅ 用户表：' as '';
SHOW TABLES LIKE 'user%';

SELECT '✅ Admin用户：' as '';
SELECT id, username FROM users WHERE username = 'admin';

SELECT '✅ 菜单：' as '';
SELECT id, title FROM sys_menus WHERE id = 'ai-crawler-assistant';

SELECT '✅ 爬虫模板：' as '';
SELECT id, user_id, name FROM crawler_templates;

SELECT '' as '';
SELECT '========================================' as '';
SELECT '✅ 修复完成！' as '';
SELECT '========================================' as '';
SELECT '请刷新浏览器查看' as '';
SELECT '========================================' as '';
