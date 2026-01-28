
/**
 * 数据库加密迁移脚本
 * 用途：将 sys_ai_configs 中的 API Key 统一为当前的 FILE_ENCRYPTION_KEY 加密格式
 */

const mysql = require('mysql2/promise');
const crypto = require('crypto');
const { sm4 } = require('sm-crypto');
const fs = require('fs');
const path = require('path');

// 变量定义
const SM4_PREFIX = 'SM4:';
let CURRENT_KEY_HEX = '';

// 获取当前密钥的 MD5 哈希（32位 Hex）
function getSm4Key(rawKey) {
    return crypto.createHash('md5').update(rawKey).digest('hex');
}

function encrypt(text, key) {
    if (!text) return '';
    return SM4_PREFIX + sm4.encrypt(text, key);
}

function decrypt(encryptedText, key) {
    if (!encryptedText || !encryptedText.startsWith(SM4_PREFIX)) return encryptedText;
    const cipherText = encryptedText.substring(SM4_PREFIX.length);
    return sm4.decrypt(cipherText, key);
}

async function run() {
    // 1. 获取当前有效的 FILE_ENCRYPTION_KEY
    // 由于用户删除了 .env，我们需要从环境变量中获取，或者让用户在执行时传入
    const rawKey = process.env.FILE_ENCRYPTION_KEY;
    if (!rawKey) {
        console.error('错误: 请先设置环境变量 FILE_ENCRYPTION_KEY');
        console.log('用法: $env:FILE_ENCRYPTION_KEY="your-new-key"; node migrate.js');
        process.exit(1);
    }
    CURRENT_KEY_HEX = getSm4Key(rawKey);
    console.log(`当前密钥哈希: ${CURRENT_KEY_HEX.substring(0, 8)}...`);

    // 2. 连接数据库
    const dbConfig = {
        host: process.env.CONFIG_DB_HOST || 'localhost',
        port: parseInt(process.env.CONFIG_DB_PORT || '3306'),
        user: process.env.CONFIG_DB_USER || 'root',
        password: process.env.CONFIG_DB_PASSWORD || '',
        database: process.env.CONFIG_DB_NAME || 'ai-data-platform',
    };

    const pool = mysql.createPool(dbConfig);

    try {
        const [rows] = await pool.execute('SELECT id, name, api_key FROM sys_ai_configs');
        console.log(`查询到 ${rows.length} 条配置`);

        for (const row of rows) {
            console.log(`--- 处理: ${row.name} ---`);
            let decrypted = '';
            let needsUpdate = false;

            try {
                // 尝试用当前密钥解密
                decrypted = decrypt(row.api_key, CURRENT_KEY_HEX);

                // 验证是否真的解密成功 (SM4 填充校验)
                // 如果解密结果包含不可打印字符或报错，说明密钥不对
                if (!decrypted || /[\x00-\x08\x0E-\x1F]/.test(decrypted)) {
                    throw new Error('Padding/Key mismatch');
                }

                console.log('✅ 已是最新格式或已成功解密');
            } catch (e) {
                console.log('❌ 解密失败 (密钥不匹配)');
                // 如果解密失败，将其重置为空
                decrypted = '';
                needsUpdate = true;
            }

            if (needsUpdate) {
                const newEncrypted = encrypt(decrypted, CURRENT_KEY_HEX);
                await pool.execute('UPDATE sys_ai_configs SET api_key = ? WHERE id = ?', [newEncrypted, row.id]);
                console.log('🔄 已重置损坏的 API Key（请稍后在后台重新录入）');
            }
        }

        // 2. 迁移数据源配置
        console.log('\n--- 迁移数据源配置 ---');
        const [dsRows] = await pool.execute('SELECT id, name, db_password FROM datasource_config');
        console.log(`查询到 ${dsRows.length} 条数据源配置`);

        for (const row of dsRows) {
            console.log(`--- 处理数据源: ${row.name} ---`);
            if (!row.db_password) {
                console.log('没有发现加密密码，跳过');
                continue;
            }

            try {
                // 尝试使用当前密钥解密
                const decrypted = decrypt(row.db_password, CURRENT_KEY_HEX);
                // 验证是否真的解密成功 (SM4 填充校验)
                if (!decrypted || /[\x00-\x08\x0E-\x1F]/.test(decrypted)) {
                    throw new Error('Padding/Key mismatch');
                }
                console.log('✅ 密码解密成功');

                // 重新加密并更新
                const reEncrypted = encrypt(decrypted, CURRENT_KEY_HEX);
                await pool.execute(
                    'UPDATE datasource_config SET db_password = ? WHERE id = ?',
                    [reEncrypted, row.id]
                );
                console.log('✨ 密码已通过新密钥重写');
            } catch (e) {
                console.log('❌ 密码解密失败 (密钥不匹配)');
                // 数据源密码无法简单重置为内容，必须由用户手动重新录入，
                // 但为了防止系统启动崩溃，我们先将其置空。
                await pool.execute(
                    'UPDATE datasource_config SET db_password = "" WHERE id = ?',
                    [row.id]
                );
                console.log('🔄 已清空无法解密的密码（请稍后在后台重新录入）');
            }
        }

        console.log('\n✅ 迁移完成！损坏的配置已处理，数据库已与新密钥同步。');
    } catch (err) {
        console.error('迁移过程中出错:', err);
    } finally {
        await pool.end();
    }
}

run();
