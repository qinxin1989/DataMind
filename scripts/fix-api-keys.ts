/**
 * 修复 API Key 加密
 * 用新的 FILE_ENCRYPTION_KEY 重新加密
 */

import mysql from 'mysql2/promise';
import crypto from 'crypto';
// @ts-ignore
import { sm4 } from 'sm-crypto';
import dotenv from 'dotenv';

dotenv.config();

const SM4_PREFIX = 'SM4:';

function getEncryptionKey(): string {
  const key = process.env.FILE_ENCRYPTION_KEY || 'default-key-change';
  return crypto.createHash('md5').update(key).digest('hex').substring(0, 32);
}

async function fix() {
  const pool = mysql.createPool({
    host: process.env.CONFIG_DB_HOST || 'localhost',
    port: parseInt(process.env.CONFIG_DB_PORT || '3306'),
    user: process.env.CONFIG_DB_USER || 'root',
    password: process.env.CONFIG_DB_PASSWORD || '',
    database: process.env.CONFIG_DB_NAME || 'ai-data-platform',
  });

  console.log('连接数据库...');
  console.log('FILE_ENCRYPTION_KEY:', process.env.FILE_ENCRYPTION_KEY?.substring(0, 10) + '...');

  const [rows] = await pool.execute('SELECT id, name, api_key FROM sys_ai_configs');
  console.log(`找到 ${(rows as any[]).length} 条配置\n`);

  const newKey = getEncryptionKey();
  console.log('加密密钥 (MD5):', newKey.substring(0, 10) + '...\n');

  for (const row of rows as any[]) {
    let plainKey = row.api_key;

    // 如果是 SM4 加密的，先尝试解密
    if (plainKey.startsWith(SM4_PREFIX)) {
      try {
        const cipherText = plainKey.substring(SM4_PREFIX.length);
        const decrypted = sm4.decrypt(cipherText, newKey);
        if (decrypted) {
          console.log(`${row.name} - SM4 解密成功，无需修复`);
          continue;
        }
      } catch (e) {
        // 解密失败，说明是用旧密钥加密的
        console.log(`${row.name} - SM4 解密失败，需要手动输入 API Key`);
        continue;
      }
    }

    // 明文或旧格式，重新加密
    console.log(`${row.name} - 原始值: ${plainKey.substring(0, 20)}...`);
    
    // 如果包含冒号，可能是旧的 AES 格式，跳过
    if (plainKey.includes(':') && !plainKey.startsWith('SM4:')) {
      console.log(`${row.name} - 旧 AES 格式，需要手动重新配置 API Key`);
      continue;
    }

    // 加密
    const encrypted = SM4_PREFIX + sm4.encrypt(plainKey, newKey);
    await pool.execute('UPDATE sys_ai_configs SET api_key = ? WHERE id = ?', [encrypted, row.id]);
    console.log(`${row.name} - 已重新加密\n`);
  }

  await pool.end();
  console.log('\n完成！');
}

fix().catch(console.error);
