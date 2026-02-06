#!/usr/bin/env node

/**
 * 将数据库中的JSON字段迁移到分表存储
 * 涉及的表和字段：
 * 1. datasource_config.config (JSON) -> datasource_configs 分表
 * 2. schema_analysis.tables (JSON) -> schema_tables, schema_columns 分表
 * 3. schema_analysis.suggested_questions (JSON) -> schema_questions 分表
 * 4. sys_audit_logs.details (JSON) -> audit_log_details 分表
 * 5. chat_history.messages (MEDIUMTEXT JSON) -> chat_messages 分表
 */

const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// 数据库连接配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'qinxin',
  database: process.env.DB_NAME || 'DataMind',
  charset: 'utf8mb4'
};

let connection;

// 颜色输出
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 创建新的分表结构
async function createNewTables() {
  log('📋 创建新的分表结构...', 'blue');

  const createTableQueries = [
    // 1. 数据源配置分表
    `CREATE TABLE IF NOT EXISTS datasource_configs (
      id VARCHAR(36) PRIMARY KEY,
      datasource_id VARCHAR(36) NOT NULL,
      config_key VARCHAR(100) NOT NULL,
      config_value TEXT,
      config_type VARCHAR(20) DEFAULT 'string', -- string, number, boolean, object
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_datasource (datasource_id),
      INDEX idx_key (config_key),
      FOREIGN KEY (datasource_id) REFERENCES datasource_config(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    // 2. Schema 表信息
    `CREATE TABLE IF NOT EXISTS schema_tables (
      id VARCHAR(36) PRIMARY KEY,
      analysis_id INT NOT NULL,
      table_name VARCHAR(100) NOT NULL,
      table_name_cn VARCHAR(100),
      table_comment VARCHAR(500),
      row_count INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_analysis (analysis_id),
      INDEX idx_table_name (table_name),
      FOREIGN KEY (analysis_id) REFERENCES schema_analysis(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    // 3. Schema 字段信息
    `CREATE TABLE IF NOT EXISTS schema_columns (
      id VARCHAR(36) PRIMARY KEY,
      table_id VARCHAR(36) NOT NULL,
      column_name VARCHAR(100) NOT NULL,
      column_name_cn VARCHAR(100),
      column_type VARCHAR(50),
      column_comment VARCHAR(500),
      is_nullable BOOLEAN DEFAULT TRUE,
      is_primary_key BOOLEAN DEFAULT FALSE,
      default_value VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_table (table_id),
      INDEX idx_column_name (column_name),
      FOREIGN KEY (table_id) REFERENCES schema_tables(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    // 4. Schema 推荐问题
    `CREATE TABLE IF NOT EXISTS schema_questions (
      id VARCHAR(36) PRIMARY KEY,
      analysis_id INT NOT NULL,
      question TEXT NOT NULL,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_analysis (analysis_id),
      INDEX idx_sort (sort_order),
      FOREIGN KEY (analysis_id) REFERENCES schema_analysis(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    // 5. 审计日志详情
    `CREATE TABLE IF NOT EXISTS audit_log_details (
      id VARCHAR(36) PRIMARY KEY,
      audit_log_id VARCHAR(36) NOT NULL,
      detail_key VARCHAR(100) NOT NULL,
      detail_value TEXT,
      detail_type VARCHAR(20) DEFAULT 'string',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_log (audit_log_id),
      INDEX idx_key (detail_key),
      FOREIGN KEY (audit_log_id) REFERENCES sys_audit_logs(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    // 6. 聊天消息
    `CREATE TABLE IF NOT EXISTS chat_messages (
      id VARCHAR(36) PRIMARY KEY,
      chat_id VARCHAR(36) NOT NULL,
      role VARCHAR(20) NOT NULL, -- user, assistant, system
      content MEDIUMTEXT NOT NULL,
      message_order INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_chat (chat_id),
      INDEX idx_order (message_order),
      FOREIGN KEY (chat_id) REFERENCES chat_history(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  ];

  for (const query of createTableQueries) {
    try {
      await connection.execute(query);
      log('  ✅ 表创建成功', 'green');
    } catch (error) {
      log(`  ❌ 表创建失败: ${error.message}`, 'red');
      throw error;
    }
  }

  log('✅ 所有新表创建完成', 'green');
}

// 迁移数据源配置
async function migrateDatasourceConfigs() {
  log('\n📊 迁移数据源配置...', 'blue');

  const [rows] = await connection.execute(
    'SELECT id, config FROM datasource_config WHERE config IS NOT NULL'
  );

  let migratedCount = 0;
  let errorCount = 0;

  for (const row of rows) {
    try {
      const config = JSON.parse(row.config);
      
      // 将JSON对象的每个键值对插入到分表中
      for (const [key, value] of Object.entries(config)) {
        let configType = 'string';
        let configValue = value;

        if (typeof value === 'number') {
          configType = 'number';
          configValue = value.toString();
        } else if (typeof value === 'boolean') {
          configType = 'boolean';
          configValue = value.toString();
        } else if (typeof value === 'object' && value !== null) {
          configType = 'object';
          configValue = JSON.stringify(value);
        } else {
          configValue = String(value);
        }

        await connection.execute(
          `INSERT INTO datasource_configs (id, datasource_id, config_key, config_value, config_type) 
           VALUES (?, ?, ?, ?, ?)`,
          [uuidv4(), row.id, key, configValue, configType]
        );
      }

      migratedCount++;
      log(`  ✅ 数据源 ${row.id} 配置迁移完成`, 'green');
    } catch (error) {
      errorCount++;
      log(`  ❌ 数据源 ${row.id} 配置迁移失败: ${error.message}`, 'red');
    }
  }

  log(`📊 数据源配置迁移完成: 成功 ${migratedCount}, 失败 ${errorCount}`, 'blue');
}

// 迁移Schema分析数据
async function migrateSchemaAnalysis() {
  log('\n📋 迁移Schema分析数据...', 'blue');

  const [rows] = await connection.execute(
    'SELECT id, tables, suggested_questions FROM schema_analysis WHERE tables IS NOT NULL'
  );

  let migratedCount = 0;
  let errorCount = 0;

  for (const row of rows) {
    try {
      // 迁移表信息
      if (row.tables) {
        const tables = JSON.parse(row.tables);
        
        for (const table of tables) {
          const tableId = uuidv4();
          
          // 插入表信息
          await connection.execute(
            `INSERT INTO schema_tables (id, analysis_id, table_name, table_name_cn, table_comment, row_count) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              tableId,
              row.id,
              table.tableName || table.name,
              table.tableNameCn || table.nameCn,
              table.tableComment || table.comment,
              table.rowCount || 0
            ]
          );

          // 插入字段信息
          if (table.columns && Array.isArray(table.columns)) {
            for (const column of table.columns) {
              await connection.execute(
                `INSERT INTO schema_columns (id, table_id, column_name, column_name_cn, column_type, column_comment, is_nullable, is_primary_key, default_value) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  uuidv4(),
                  tableId,
                  column.name,
                  column.nameCn,
                  column.type,
                  column.comment,
                  column.nullable !== false,
                  column.primaryKey === true,
                  column.defaultValue
                ]
              );
            }
          }
        }
      }

      // 迁移推荐问题
      if (row.suggested_questions) {
        const questions = JSON.parse(row.suggested_questions);
        
        if (Array.isArray(questions)) {
          for (let i = 0; i < questions.length; i++) {
            await connection.execute(
              `INSERT INTO schema_questions (id, analysis_id, question, sort_order) 
               VALUES (?, ?, ?, ?)`,
              [uuidv4(), row.id, questions[i], i + 1]
            );
          }
        }
      }

      migratedCount++;
      log(`  ✅ Schema分析 ${row.id} 迁移完成`, 'green');
    } catch (error) {
      errorCount++;
      log(`  ❌ Schema分析 ${row.id} 迁移失败: ${error.message}`, 'red');
    }
  }

  log(`📋 Schema分析迁移完成: 成功 ${migratedCount}, 失败 ${errorCount}`, 'blue');
}

// 迁移审计日志详情
async function migrateAuditLogDetails() {
  log('\n📝 迁移审计日志详情...', 'blue');

  const [rows] = await connection.execute(
    'SELECT id, details FROM sys_audit_logs WHERE details IS NOT NULL'
  );

  let migratedCount = 0;
  let errorCount = 0;

  for (const row of rows) {
    try {
      const details = JSON.parse(row.details);
      
      // 将JSON对象的每个键值对插入到分表中
      for (const [key, value] of Object.entries(details)) {
        let detailType = 'string';
        let detailValue = value;

        if (typeof value === 'number') {
          detailType = 'number';
          detailValue = value.toString();
        } else if (typeof value === 'boolean') {
          detailType = 'boolean';
          detailValue = value.toString();
        } else if (typeof value === 'object' && value !== null) {
          detailType = 'object';
          detailValue = JSON.stringify(value);
        } else {
          detailValue = String(value);
        }

        await connection.execute(
          `INSERT INTO audit_log_details (id, audit_log_id, detail_key, detail_value, detail_type) 
           VALUES (?, ?, ?, ?, ?)`,
          [uuidv4(), row.id, key, detailValue, detailType]
        );
      }

      migratedCount++;
      log(`  ✅ 审计日志 ${row.id} 详情迁移完成`, 'green');
    } catch (error) {
      errorCount++;
      log(`  ❌ 审计日志 ${row.id} 详情迁移失败: ${error.message}`, 'red');
    }
  }

  log(`📝 审计日志详情迁移完成: 成功 ${migratedCount}, 失败 ${errorCount}`, 'blue');
}

// 迁移聊天消息
async function migrateChatMessages() {
  log('\n💬 迁移聊天消息...', 'blue');

  const [rows] = await connection.execute(
    'SELECT id, messages FROM chat_history WHERE messages IS NOT NULL AND messages != ""'
  );

  let migratedCount = 0;
  let errorCount = 0;

  for (const row of rows) {
    try {
      const messages = JSON.parse(row.messages);
      
      if (Array.isArray(messages)) {
        for (let i = 0; i < messages.length; i++) {
          const message = messages[i];
          
          await connection.execute(
            `INSERT INTO chat_messages (id, chat_id, role, content, message_order) 
             VALUES (?, ?, ?, ?, ?)`,
            [
              uuidv4(),
              row.id,
              message.role || 'user',
              message.content || message.message || '',
              i + 1
            ]
          );
        }
      }

      migratedCount++;
      log(`  ✅ 聊天记录 ${row.id} 消息迁移完成`, 'green');
    } catch (error) {
      errorCount++;
      log(`  ❌ 聊天记录 ${row.id} 消息迁移失败: ${error.message}`, 'red');
    }
  }

  log(`💬 聊天消息迁移完成: 成功 ${migratedCount}, 失败 ${errorCount}`, 'blue');
}

// 验证迁移结果
async function verifyMigration() {
  log('\n🔍 验证迁移结果...', 'blue');

  const verificationQueries = [
    { name: '数据源配置', table: 'datasource_configs' },
    { name: 'Schema表信息', table: 'schema_tables' },
    { name: 'Schema字段信息', table: 'schema_columns' },
    { name: 'Schema推荐问题', table: 'schema_questions' },
    { name: '审计日志详情', table: 'audit_log_details' },
    { name: '聊天消息', table: 'chat_messages' }
  ];

  for (const query of verificationQueries) {
    try {
      const [rows] = await connection.execute(`SELECT COUNT(*) as count FROM ${query.table}`);
      const count = rows[0].count;
      log(`  ✅ ${query.name}: ${count} 条记录`, count > 0 ? 'green' : 'yellow');
    } catch (error) {
      log(`  ❌ ${query.name}: 验证失败 - ${error.message}`, 'red');
    }
  }
}

// 创建备份原JSON字段的脚本
async function createBackupScript() {
  log('\n💾 创建备份脚本...', 'blue');

  const backupScript = `-- JSON字段备份脚本
-- 在确认迁移成功后，可以选择性地删除原JSON字段

-- 备份原始数据（可选）
CREATE TABLE IF NOT EXISTS datasource_config_backup AS SELECT * FROM datasource_config;
CREATE TABLE IF NOT EXISTS schema_analysis_backup AS SELECT * FROM schema_analysis;
CREATE TABLE IF NOT EXISTS sys_audit_logs_backup AS SELECT * FROM sys_audit_logs;
CREATE TABLE IF NOT EXISTS chat_history_backup AS SELECT * FROM chat_history;

-- 删除JSON字段（谨慎操作！）
-- ALTER TABLE datasource_config DROP COLUMN config;
-- ALTER TABLE schema_analysis DROP COLUMN tables, DROP COLUMN suggested_questions;
-- ALTER TABLE sys_audit_logs DROP COLUMN details;
-- ALTER TABLE chat_history DROP COLUMN messages;

-- 如果需要恢复，可以使用备份表
-- INSERT INTO datasource_config SELECT * FROM datasource_config_backup;
`;

  require('fs').writeFileSync('backup-json-fields.sql', backupScript);
  log('  ✅ 备份脚本已创建: backup-json-fields.sql', 'green');
}

// 主函数
async function main() {
  try {
    log('🚀 开始JSON字段迁移到分表存储', 'blue');
    log('=' * 50, 'blue');

    // 连接数据库
    connection = await mysql.createConnection(dbConfig);
    log('✅ 数据库连接成功', 'green');

    // 创建新表结构
    await createNewTables();

    // 迁移数据
    await migrateDatasourceConfigs();
    await migrateSchemaAnalysis();
    await migrateAuditLogDetails();
    await migrateChatMessages();

    // 验证迁移结果
    await verifyMigration();

    // 创建备份脚本
    await createBackupScript();

    log('\n🎉 JSON字段迁移完成！', 'green');
    log('📋 迁移摘要:', 'blue');
    log('  - 创建了6个新的分表来存储JSON数据', 'blue');
    log('  - 原JSON字段保持不变，可以在验证后选择删除', 'blue');
    log('  - 已生成备份脚本: backup-json-fields.sql', 'blue');
    log('  - 建议先在测试环境验证迁移结果', 'yellow');

  } catch (error) {
    log(`❌ 迁移失败: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 运行迁移
main().catch(error => {
  log(`❌ 迁移运行失败: ${error.message}`, 'red');
  process.exit(1);
});