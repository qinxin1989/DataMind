-- 添加 description 字段到 crawler_templates 表
ALTER TABLE crawler_templates ADD COLUMN IF NOT EXISTS description TEXT;

-- 更新 crawler_template_fields 表的列名（从 field_selector 改为 selector，如果不存在的话）
-- 注意：如果列已经存在或使用不同名称，此操作需要调整
