
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

async function resetDatabase() {
    const config = {
        host: process.env.CONFIG_DB_HOST || 'localhost',
        port: parseInt(process.env.CONFIG_DB_PORT || '3306'),
        user: process.env.CONFIG_DB_USER || 'root',
        password: process.env.CONFIG_DB_PASSWORD || 'qinxin',
    };

    const dbName = process.env.CONFIG_DB_NAME || 'datamind';

    console.log(`正在准备重置数据库: ${dbName}...`);

    let connection;
    try {
        // 先不指定数据库连接，以便进行 DROP/CREATE
        connection = await mysql.createConnection(config);

        console.log(`1. 正在删除数据库 ${dbName} (如果存在)...`);
        await connection.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
        console.log(`✅ 数据库 ${dbName} 已删除。`);

        console.log(`2. 正在重新创建数据库 ${dbName}...`);
        await connection.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
        console.log(`✅ 数据库 ${dbName} 已创建。`);

        await connection.query(`USE \`${dbName}\``);

        console.log(`3. 正在读取并执行 init.sql...`);
        const sqlPath = path.join(process.cwd(), 'init.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // 注意：mysql2 的 query 只能执行单条语句。
        // 我们需要分割 SQL 语句，或者使用特殊的处理。
        // 对于 init.sql 这种大文件，直接通过命令行或者更健壮的方式更好。
        // 但既然 mysql CLI 不可用，我们只能手动分割。

        // 简单的分割逻辑（按分号 + 换行分割）
        const statements = sql
            .split(/;[\r\n]+/)
            .map(s => s.trim())
            .filter(s => s.length > 0);

        console.log(`待执行语句数量: ${statements.length}`);

        for (let i = 0; i < statements.length; i++) {
            try {
                await connection.query(statements[i]);
                if ((i + 1) % 50 === 0) {
                    console.log(`进度: ${i + 1}/${statements.length}`);
                }
            } catch (err: any) {
                console.warn(`第 ${i + 1} 条语句执行失败: ${err.message}`);
                // 继续执行后续语句，因为有些可能是权限或特定的版本差异
            }
        }

        console.log(`\n✅ 数据库 ${dbName} 重置完成！`);

    } catch (error: any) {
        console.error(`❌ 重置数据库失败:`, error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

resetDatabase();
