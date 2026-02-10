const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

async function seed() {
    const config = {
        host: 'localhost',
        user: 'root',
        password: 'qinxin',
        database: 'datamind'
    };

    console.log('Connecting to database...');
    const connection = await mysql.createConnection(config);

    const logs = [
        {
            user_id: 'admin-id',
            username: 'admin',
            action: 'login',
            module: 'auth',
            target_type: 'session',
            target_id: 'sess-' + Date.now(),
            details: 'User logged in successfully',
            ip_address: '192.168.1.10',
            user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            created_at: new Date() // Now
        },
        {
            user_id: 'admin-id',
            username: 'admin',
            action: 'create_backup',
            module: 'system',
            target_type: 'backup',
            target_id: uuidv4(),
            details: 'Created system backup: daily-backup',
            ip_address: '192.168.1.10',
            user_agent: 'Mozilla/5.0',
            created_at: new Date(Date.now() - 3600000) // 1 hour ago
        },
        {
            user_id: 'user-1',
            username: 'zhangsan',
            action: 'query_data',
            module: 'datasource',
            target_type: 'table',
            target_id: 'users',
            details: 'Queried user table',
            ip_address: '10.0.0.5',
            user_agent: 'Chrome/90.0',
            created_at: new Date(Date.now() - 86400000) // 1 day ago
        }
    ];

    console.log(`Inserting ${logs.length} audit logs...`);

    for (const log of logs) {
        await connection.execute(
            `INSERT INTO sys_audit_logs 
            (id, user_id, username, action, module, target_type, target_id, details, ip_address, user_agent, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                uuidv4(),
                log.user_id,
                log.username,
                log.action,
                log.module,
                log.target_type,
                log.target_id,
                JSON.stringify({ message: log.details }), // Wrap details in JSON object
                log.ip_address,
                log.user_agent,
                log.created_at
            ]
        );
    }

    console.log('Done!');
    await connection.end();
}

seed().catch(console.error);
