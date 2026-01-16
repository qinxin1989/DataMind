/**
 * 使用国密 SM4 加密数据库中的 API Key
 * 支持从明文或旧 AES 格式迁移到 SM4
 */

import mysql from 'mysql2/promise';
import crypto from 'crypto';
// @ts-ignore
import { sm4 } from 'sm-crypto';
import dotenv from 'dotenv';

dotenv.config();

const SM4_PREFIX = 'SM4:';
const AES_ALGORITHM = 'aes-256-gcm';

function getSM4Key(): string {
  const key = process.env.FILE_ENCRYPTION_KEY || 'default-key-change';
  return crypto.createHash('md5').update(key).digest('hex').substring(0, 32);
}

function getAESKey(): Buffer {
  const key = process.env.FILE_ENCRYPTION_KEY || '';
  return crypto.createHash('sha256').update(key).digest();
}

function encryptSM4(text: string): string {
  if (!text) return text;
  const key = getSM4Key();
  const encrypted = sm4.encrypt(text, key);
  return `${SM4_PREFIX}${encrypted}`;
}

function decryptLegacyAES(encryptedText: string): string {
  const key = getAESKey();
  const parts = encryptedText.split(':');
  if (parts.length !== 3) return encryptedText;
  
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  
  const decipher = crypto.createDecipheriv(AES_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function isEncryptedSM4(text: string): boolean {
  return text?.startsWith(SM4_PREFIX) || false;
}

function isEncryptedAES(text: string): boolean {
  if (!text) return false;
  const parts = text.split(':');
  return parts.length === 3 && parts[0].length === 32;
}

async function migrateToSM4() {
  const pool = mysql.createPool({
    host: process.env.CONFIG_DB_HOST || 'localhost',
    port: parseInt(process.env.CONFIG_DB_PORT || '3306'),
    user: process.env.CONFIG_DB_USER || 'root',
    password: process.env.CONFIG_DB_PASSWORD || '',
    database: process.env.CONFIG_DB_NAME || 'ai-data-platform',
  });

  const connection = await pool.getConnection();

  try {
    const [rows] = await connection.execute('SELECT id, name, api_key FROM sys_ai_configs');
    const configs = rows as any[];

    let migratedCount = 0;
    let skippedCount = 0;

    for (const config of configs) {
      // 已经是 SM4 加密，跳过
      if (isEncryptedSM4(config.api_key)) {
        console.log(`跳过 (已是SM4): ${config.name}`);
        skippedCount++;
        continue;
      }

      let plainText = config.api_key;

      // 如果是旧的 AES 加密，先解密
      if (isEncryptedAES(config.api_key)) {
        try {
          plainText = decryptLegacyAES(config.api_key);
          console.log(`从 AES 解密: ${config.name}`);
        } catch (e) {
          console.error(`AES 解密失败: ${config.name}`, e);
          continue;
        }
      }

      // 使用 SM4 加密
      const sm4Encrypted = encryptSM4(plainText);
      await connection.execute(
        'UPDATE sys_ai_configs SET api_key = ? WHERE id = ?',
        [sm4Encrypted, config.id]
      );
      console.log(`已用 SM4 加密: ${config.name}`);
      migratedCount++;
    }

    console.log(`\n完成！迁移到 SM4: ${migratedCount} 个，跳过: ${skippedCount} 个`);

  } finally {
    connection.release();
    await pool.end();
  }
}

migrateToSM4().catch(console.error);
