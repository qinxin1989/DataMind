/**
 * 数据库初始化脚本 v2
 * 使用Node.js直接操作数据库
 */

import { pool } from '../src/admin/core/database';

async function initDatabase() {
  console.log('========================================');
  console.log('数据库初始化 (MySQL 8.0)');
  console.log('========================================\n');

  const connection = await pool.getConnection();

  try {
    console.log('[1/6] 增强 crawler_templates 表...');

    // 检查现有字段
    const [columns] = await connection.query('SHOW COLUMNS FROM crawler_templates');
    const existingFields = (columns as any[]).map((c: any) => c.Field);

    console.log('  现有字段:', existingFields.length, '个');

    // 需要添加的字段
    const fieldsToAdd = [
      { name: 'page_type', type: "VARCHAR(20) DEFAULT 'static'", comment: '页面类型: static/dynamic' },
      { name: 'auto_generated', type: 'BOOLEAN DEFAULT FALSE', comment: '是否AI自动生成' },
      { name: 'confidence', type: 'DECIMAL(5,2) DEFAULT 100.00', comment: '置信度(0-100)' },
      { name: 'last_used_at', type: 'TIMESTAMP NULL', comment: '最后使用时间' },
      { name: 'usage_count', type: 'INT DEFAULT 0', comment: '使用次数' },
      { name: 'tags', type: 'JSON', comment: '标签数组' }
    ];

    for (const field of fieldsToAdd) {
      if (!existingFields.includes(field.name)) {
        try {
          const sql = `ALTER TABLE crawler_templates ADD COLUMN ${field.name} ${field.type} COMMENT '${field.comment}'`;
          await connection.query(sql);
          console.log(`  ✓ 添加字段: ${field.name}`);
        } catch (error: any) {
          if (error.code !== 'ER_DUP_FIELDNAME') {
            console.log(`  ✗ 添加字段失败 ${field.name}: ${error.message}`);
          }
        }
      } else {
        console.log(`  ⊘ 字段已存在: ${field.name}`);
      }
    }

    console.log('\n[2/6] 创建索引...');

    const indexes = [
      { name: 'idx_page_type', column: 'page_type', table: 'crawler_templates' },
      { name: 'idx_auto_generated', column: 'auto_generated', table: 'crawler_templates' },
      { name: 'idx_last_used', column: 'last_used_at', table: 'crawler_templates' }
    ];

    for (const index of indexes) {
      try {
        await connection.query(`CREATE INDEX ${index.name} ON ${index.table}(${index.column})`);
        console.log(`  ✓ 创建索引: ${index.name}`);
      } catch (error: any) {
        if (error.code !== 'ER_DUP_KEYNAME' && !error.message.includes('duplicate key name')) {
          console.log(`  ⊘ 索引已存在或创建失败: ${index.name}`);
        }
      }
    }

    console.log('\n[3/6] 创建新表...');

    // 创建通知表
    try {
      await connection.query(`
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
          INDEX idx_type (type)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='爬虫通知表'
      `);
      console.log('  ✓ crawler_notifications');
    } catch (e: any) {
      console.log('  ⊘ crawler_notifications (已存在)');
    }

    // 创建内容分类表
    try {
      await connection.query(`
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
          INDEX idx_result_item (result_item_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='内容分类表'
      `);
      console.log('  ✓ crawler_content_classify');
    } catch (e: any) {
      console.log('  ⊘ crawler_content_classify (已存在)');
    }

    // 创建去重表
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS crawler_deduplication (
          id VARCHAR(36) PRIMARY KEY,
          template_id VARCHAR(36) NOT NULL,
          content_hash VARCHAR(64) NOT NULL COMMENT '内容SHA256哈希',
          original_item_id VARCHAR(36) COMMENT '原始数据ID',
          is_duplicate BOOLEAN DEFAULT FALSE COMMENT '是否重复',
          duplicate_of VARCHAR(36) COMMENT '重复的数据ID',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_template_hash (template_id, content_hash),
          INDEX idx_duplicate (is_duplicate)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='去重记录表'
      `);
      console.log('  ✓ crawler_deduplication');
    } catch (e: any) {
      console.log('  ⊘ crawler_deduplication (已存在)');
    }

    console.log('\n[4/6] 创建系统用户...');
    try {
      await connection.query(`
        INSERT IGNORE INTO sys_users (id, username, password, name, role, status)
        VALUES ('00000000-0000-0000-0000-000000000000', 'system', 'SYSTEM_USER', '系统', 'system', 1)
      `);
      console.log('  ✓ 系统用户');
    } catch (e) {
      console.log('  ⊘ 系统用户 (已存在)');
    }

    console.log('\n[5/6] 创建视图...');
    try {
      await connection.query(`
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
        GROUP BY t.id
      `);
      console.log('  ✓ v_crawler_template_stats');
    } catch (e) {
      console.log('  ✗ 视图创建失败');
    }

    console.log('\n[6/6] 创建触发器...');
    try {
      await connection.query(`
        DROP TRIGGER IF EXISTS trg_crawler_template_usage
      `);
    } catch (e) {}

    try {
      await connection.query(`
        CREATE TRIGGER trg_crawler_template_usage
        BEFORE INSERT ON crawler_results
        FOR EACH ROW
        BEGIN
          IF NEW.template_id IS NOT NULL THEN
            UPDATE crawler_templates
            SET usage_count = usage_count + 1,
                last_used_at = NOW()
            WHERE id = NEW.template_id;
          END IF;
        END
      `);
      console.log('  ✓ trg_crawler_template_usage');
    } catch (e: any) {
      console.log('  ✗ 触发器创建失败:', e.message);
    }

    console.log('\n========================================');
    console.log('✓ 数据库初始化完成！');
    console.log('========================================\n');

    // 最终验证
    console.log('最终验证:\n');

    const [tables] = await connection.query('SHOW TABLES LIKE "crawler_%"');
    console.log(`✓ 爬虫表数量: ${(tables as any[]).length} 个`);

    const [cols] = await connection.query('SHOW COLUMNS FROM crawler_templates');
    console.log(`✓ 模板表字段: ${(cols as any[]).length} 个`);

    const newFields = ['page_type', 'auto_generated', 'confidence', 'last_used_at', 'usage_count', 'tags'];
    const existing = (cols as any[]).map((c: any) => c.Field);
    const hasNewFields = newFields.every(f => existing.includes(f));

    console.log(`${hasNewFields ? '✓' : '✗'} 新字段都已添加`);

    connection.release();

    console.log('\n下一步:');
    console.log('  npm run bootstrap:templates  # 初始化省级模板');
    console.log('  npm run dev                 # 启动服务器\n');

  } catch (error: any) {
    console.error('\n✗ 初始化失败:', error.message);
    connection.release();
    process.exit(1);
  }
}

initDatabase()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
