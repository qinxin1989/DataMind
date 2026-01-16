/**
 * 加密工具
 * 使用国密 SM4 算法加密敏感数据（如 API Key）
 */

import crypto from 'crypto';
// @ts-ignore
import { sm4 } from 'sm-crypto';

const SM4_PREFIX = 'SM4:';  // SM4 加密标识前缀

// 从环境变量获取加密密钥，确保是16字节（128位）
function getEncryptionKey(): string {
  const key = process.env.FILE_ENCRYPTION_KEY || 'default-key-change';
  // SM4 需要 16 字节密钥，使用 MD5 哈希生成
  return crypto.createHash('md5').update(key).digest('hex').substring(0, 32);
}

/**
 * 使用 SM4 加密字符串
 */
export function encrypt(text: string): string {
  if (!text) return text;
  
  const key = getEncryptionKey();
  const encrypted = sm4.encrypt(text, key);
  
  // 添加前缀标识这是 SM4 加密的数据
  return `${SM4_PREFIX}${encrypted}`;
}

/**
 * 使用 SM4 解密字符串
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return encryptedText;
  
  // 检查是否是 SM4 加密格式
  if (encryptedText.startsWith(SM4_PREFIX)) {
    try {
      const key = getEncryptionKey();
      const cipherText = encryptedText.substring(SM4_PREFIX.length);
      const decrypted = sm4.decrypt(cipherText, key);
      if (decrypted) {
        return decrypted;
      }
      // 解密结果为空，返回占位符
      console.error('SM4 decryption returned empty result');
      return '[解密失败-请重新配置]';
    } catch (error) {
      console.error('SM4 decryption failed:', error);
      // 解密失败，返回占位符而不是原文
      return '[解密失败-请重新配置]';
    }
  }
  
  // 检查是否是旧的 AES-GCM 格式 (iv:authTag:data)
  if (encryptedText.includes(':')) {
    try {
      return decryptLegacyAES(encryptedText);
    } catch (error) {
      // 解密失败，返回占位符
      return '[解密失败-请重新配置]';
    }
  }
  
  // 未加密的明文，直接返回
  return encryptedText;
}

/**
 * 解密旧的 AES-GCM 格式数据（兼容迁移）
 */
function decryptLegacyAES(encryptedText: string): string {
  const ALGORITHM = 'aes-256-gcm';
  const key = crypto.createHash('sha256').update(process.env.FILE_ENCRYPTION_KEY || '').digest();
  
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    return encryptedText;
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * 检查字符串是否已用 SM4 加密
 */
export function isEncrypted(text: string): boolean {
  if (!text) return false;
  return text.startsWith(SM4_PREFIX);
}

/**
 * 检查是否是旧格式加密
 */
export function isLegacyEncrypted(text: string): boolean {
  if (!text) return false;
  const parts = text.split(':');
  return parts.length === 3 && parts[0].length === 32;
}
