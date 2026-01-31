# 爬虫功能设置指南

## 🔧 问题1：菜单没有显示

### 方案A：使用数据库管理工具（推荐）

1. 打开你的数据库管理工具（Navicat、DBeaver、phpMyAdmin等）
2. 连接到 `ai-data-platform` 数据库
3. 执行以下SQL：

```sql
-- 添加 AI 爬虫助手菜单
INSERT INTO admin_menus (id, title, path, icon, parent_id, sort_order, is_system, visible)
VALUES ('ai-crawler-assistant', 'AI爬虫助手', '/ai/crawler-assistant', 'RobotOutlined', '00000000-0000-0000-0000-000000000005', 5, TRUE, TRUE);

-- 验证菜单
SELECT id, title, path, sort_order, visible
FROM admin_menus
WHERE parent_id = '00000000-0000-0000-0000-000000000005'
ORDER BY sort_order;
```

4. 刷新浏览器或重新登录

### 方案B：使用MySQL命令行

```bash
mysql -u root -p ai-data-platform < add_ai_crawler_assistant_menu_fixed.sql
```

---

## 📊 问题2：采集记录报错

这是因为数据库中没有测试数据。执行以下SQL添加测试数据：

```sql
USE `ai-data-platform`;

-- 1. 创建测试模板
INSERT INTO crawler_templates (id, user_id, name, url, container_selector)
VALUES ('test-template-001', 'admin', '测试新闻爬虫', 'https://example.com/news', '.news-item');

-- 2. 创建模板字段
INSERT INTO crawler_template_fields (id, template_id, field_name, field_selector) VALUES
('field-001', 'test-template-001', '标题', '.title'),
('field-002', 'test-template-001', '链接', 'a.href');

-- 3. 创建采集结果批次
INSERT INTO crawler_results (id, user_id, template_id, status, row_count)
VALUES ('result-001', 'admin', 'test-template-001', 'completed', 3);

-- 4. 创建数据行
INSERT INTO crawler_result_rows (id, result_id) VALUES
('row-001', 'result-001'),
('row-002', 'result-001'),
('row-003', 'result-001');

-- 5. 创建字段值（EAV模式）
INSERT INTO crawler_result_items (id, row_id, field_name, field_value) VALUES
('item-001', 'row-001', '标题', '测试新闻标题1'),
('item-002', 'row-001', '链接', 'https://example.com/news/1'),
('item-003', 'row-002', '标题', '测试新闻标题2'),
('item-004', 'row-002', '链接', 'https://example.com/news/2'),
('item-005', 'row-003', '标题', '测试新闻标题3'),
('item-006', 'row-003', '链接', 'https://example.com/news/3');

-- 验证数据
SELECT '✅ 测试数据添加完成！' as message;
```

---

## 🔍 验证步骤

### 1. 检查菜单

```sql
SELECT * FROM admin_menus WHERE path = '/ai/crawler-assistant';
```

应该返回1条记录。

### 2. 检查测试数据

```sql
SELECT COUNT(*) as template_count FROM crawler_templates;
SELECT COUNT(*) as result_count FROM crawler_results;
SELECT COUNT(*) as row_count FROM crawler_result_rows;
```

应该都大于0。

---

## 🚫 问题3：端口被占用

### Windows解决方法：

```cmd
# 查找占用3000端口的进程
netstat -ano | findstr :3000

# 结束进程（替换PID）
taskkill /PID <进程ID> /F
```

或者修改端口：

在 `.env` 文件中添加：
```
PORT=3001
```

---

## 🎯 完整执行流程

1. **添加菜单** → 运行上面的菜单SQL
2. **添加测试数据** → 运行上面的测试数据SQL
3. **刷新浏览器** → 查看新菜单
4. **访问页面** → http://localhost:3000/ai/crawler-assistant
5. **测试爬虫管理** → 采集记录应该能正常显示

---

## ❓ 常见问题

**Q: 菜单SQL执行成功但还是看不到？**
A: 清除浏览器缓存或使用无痕模式，或者重新登录。

**Q: 采集记录还是报错？**
A: 检查浏览器控制台的错误信息，可能是API路径不对。

**Q: 如何查看具体的错误？**
A: 打开浏览器开发者工具（F12），查看Console和Network标签。
