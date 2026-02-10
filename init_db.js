const mysql = require('mysql2/promise');

async function main() {
    const dbName = 'datamind';
    console.log(`正在检查数据库: ${dbName}...`);

    try {
        const pool = mysql.createPool({
            host: 'localhost',
            user: 'root',
            password: 'qinxin',
            database: dbName
        });

        const tables = [
            {
                name: 'system_backups',
                sql: `
          CREATE TABLE IF NOT EXISTS system_backups (
            id VARCHAR(36) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            backup_size BIGINT DEFAULT 0,
            file_count INT DEFAULT 0,
            backup_path VARCHAR(512) NOT NULL,
            status VARCHAR(20) DEFAULT 'pending',
            created_by VARCHAR(36),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME,
            error_message TEXT
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `
            },
            {
                name: 'system_configs',
                sql: `
          CREATE TABLE IF NOT EXISTS system_configs (
            id VARCHAR(36) PRIMARY KEY,
            config_key VARCHAR(100) NOT NULL UNIQUE,
            config_value TEXT,
            value_type VARCHAR(20) DEFAULT 'string',
            description VARCHAR(255),
            config_group VARCHAR(50) DEFAULT 'general',
            is_editable TINYINT(1) DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `
            },
            {
                name: 'sys_audit_logs',
                sql: `
          CREATE TABLE IF NOT EXISTS sys_audit_logs (
            id VARCHAR(36) PRIMARY KEY,
            user_id VARCHAR(36),
            username VARCHAR(100),
            action VARCHAR(100) NOT NULL,
            module VARCHAR(50) DEFAULT 'admin',
            target_type VARCHAR(50),
            target_id VARCHAR(100),
            details TEXT,
            ip_address VARCHAR(50),
            user_agent VARCHAR(255),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `
            },
            {
                name: 'sys_chat_history',
                sql: `
          CREATE TABLE IF NOT EXISTS sys_chat_history (
            id VARCHAR(36) PRIMARY KEY,
            user_id VARCHAR(36),
            username VARCHAR(100),
            datasource_id VARCHAR(36),
            datasource_name VARCHAR(100),
            question TEXT,
            answer TEXT,
            sql_query TEXT,
            tokens_used INT DEFAULT 0,
            response_time INT DEFAULT 0,
            status VARCHAR(20) DEFAULT 'success',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `
            }
        ];

        for (const table of tables) {
            await pool.execute(table.sql);
            console.log(`✅ 成功！已在数据库 ${dbName} 中创建/确认 ${table.name} 表。`);
        }

        await pool.end();
    } catch (e) {
        console.error(`❌ 访问 ${dbName} 时出错:`, e.message);
    }
}

main().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
