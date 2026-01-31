-- 为 crawler_templates 表添加分页配置字段
-- 需求: 9.1, 9.2, 9.3, 9.4, 9.5

ALTER TABLE crawler_templates 
ADD COLUMN pagination_enabled TINYINT(1) DEFAULT 0 COMMENT '是否启用分页',
ADD COLUMN max_pages INT DEFAULT 1 COMMENT '最大采集页数',
ADD COLUMN url_pattern VARCHAR(500) DEFAULT NULL COMMENT 'URL分页模式，如 https://example.com/page/{page}',
ADD COLUMN next_page_selector VARCHAR(255) DEFAULT NULL COMMENT '下一页按钮的CSS选择器';
