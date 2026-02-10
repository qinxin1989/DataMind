const mysql = require('mysql2/promise');

async function main() {
    const dbName = 'datamind';
    console.log(`正在连接数据库: ${dbName}...`);

    try {
        const pool = mysql.createPool({
            host: 'localhost',
            user: 'root',
            password: 'qinxin',
            database: dbName
        });

        console.log('连接成功，开始测试查询...');

        // 1. 模拟 queryLogs 的参数
        const page = 1;
        const pageSize = 10;
        const offset = (page - 1) * pageSize;
        const values = []; // 没有过滤条件

        // 2. 模拟 Count 查询
        const countQuery = `SELECT COUNT(*) as total FROM sys_audit_logs WHERE 1=1`;
        console.log('[测试] 执行 Count Query:', countQuery);

        try {
            const [countRows] = await pool.execute(countQuery, values);
            console.log('[成功] Count 结果:', countRows[0]);
        } catch (e) {
            console.error('[失败] Count Query 报错:', e.message);
        }

        // 3. 模拟 Data 查询 (使用字符串插值，模仿最新修复)
        const dataQuery = `
      SELECT * FROM sys_audit_logs 
      WHERE 1=1
      ORDER BY created_at DESC
      LIMIT ${Number(pageSize)} OFFSET ${offset}
    `;

        // 注意：params 不包含 LIMIT 和 OFFSET
        const params = [...values];
        console.log('[测试] 执行 Data Query:', dataQuery);
        console.log('[测试] 参数:', params);

        try {
            const [rows] = await pool.execute(dataQuery, params);
            console.log('[成功] Data 结果条数:', rows.length);
        } catch (e) {
            console.error('[失败] Data Query 报错:', e.message);
            console.error('错误码:', e.code);
        }

        await pool.end();
    } catch (e) {
        console.error('连接数据库失败:', e.message);
    }
}

main();
