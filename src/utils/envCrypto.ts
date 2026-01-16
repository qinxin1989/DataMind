/**
 * 环境配置加密工具
 * 使用国密 SM4 加密 .env 文件中的敏感配置
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as readline from 'readline';
// @ts-ignore
import { sm4 } from 'sm-crypto';

const ENV_FILE = path.join(process.cwd(), '.env');
const ENV_ENCRYPTED_FILE = path.join(process.cwd(), '.env.encrypted');
const SM4_PREFIX = 'SM4ENC:';

// 敏感配置项（需要加密的字段）
const SENSITIVE_KEYS = [
  'CONFIG_DB_PASSWORD',
  'FILE_ENCRYPTION_KEY',
  'JWT_SECRET',
];

/**
 * 从主密码生成 SM4 密钥
 */
function deriveKey(masterPassword: string): string {
  // 使用 PBKDF2 派生密钥
  const salt = 'ai-data-platform-salt';
  const key = crypto.pbkdf2Sync(masterPassword, salt, 10000, 16, 'sha256');
  return key.toString('hex');
}

/**
 * SM4 加密
 */
function encrypt(text: string, key: string): string {
  return sm4.encrypt(text, key);
}

/**
 * SM4 解密
 */
function decrypt(cipherText: string, key: string): string {
  return sm4.decrypt(cipherText, key);
}

/**
 * 加密 .env 文件，生成 .env.encrypted
 */
export async function encryptEnvFile(masterPassword: string): Promise<void> {
  if (!fs.existsSync(ENV_FILE)) {
    throw new Error('.env 文件不存在');
  }

  const key = deriveKey(masterPassword);
  const content = fs.readFileSync(ENV_FILE, 'utf-8');
  const lines = content.split('\n');
  const encryptedLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    
    // 跳过空行和注释
    if (!trimmed || trimmed.startsWith('#')) {
      encryptedLines.push(line);
      continue;
    }

    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) {
      encryptedLines.push(line);
      continue;
    }

    const keyName = line.substring(0, eqIndex).trim();
    const value = line.substring(eqIndex + 1);

    // 检查是否是敏感配置
    if (SENSITIVE_KEYS.includes(keyName) && value) {
      const encrypted = encrypt(value, key);
      encryptedLines.push(`${keyName}=${SM4_PREFIX}${encrypted}`);
    } else {
      encryptedLines.push(line);
    }
  }

  fs.writeFileSync(ENV_ENCRYPTED_FILE, encryptedLines.join('\n'));
  console.log(`已生成加密配置文件: ${ENV_ENCRYPTED_FILE}`);
  console.log(`加密的配置项: ${SENSITIVE_KEYS.join(', ')}`);
}

/**
 * 解密 .env.encrypted 并加载到 process.env
 */
export function loadEncryptedEnv(masterPassword: string): void {
  if (!fs.existsSync(ENV_ENCRYPTED_FILE)) {
    // 如果没有加密文件，尝试加载普通 .env
    if (fs.existsSync(ENV_FILE)) {
      require('dotenv').config();
      return;
    }
    throw new Error('找不到配置文件 (.env 或 .env.encrypted)');
  }

  const key = deriveKey(masterPassword);
  const content = fs.readFileSync(ENV_ENCRYPTED_FILE, 'utf-8');
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    
    // 跳过空行和注释
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) continue;

    const keyName = line.substring(0, eqIndex).trim();
    let value = line.substring(eqIndex + 1);

    // 检查是否是加密值
    if (value.startsWith(SM4_PREFIX)) {
      const cipherText = value.substring(SM4_PREFIX.length);
      try {
        value = decrypt(cipherText, key);
      } catch (error) {
        throw new Error(`解密失败: ${keyName}，请检查主密码是否正确`);
      }
    }

    process.env[keyName] = value;
  }

  console.log('已加载加密配置');
}

/**
 * 交互式输入主密码
 */
export function promptPassword(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // 隐藏输入（Windows 下可能不完全隐藏）
    if (process.stdin.isTTY) {
      process.stdout.write(prompt);
      let password = '';
      
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      
      const onData = (char: string) => {
        if (char === '\n' || char === '\r' || char === '\u0004') {
          process.stdin.setRawMode(false);
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          rl.close();
          resolve(password);
        } else if (char === '\u0003') {
          // Ctrl+C
          process.exit();
        } else if (char === '\u007F' || char === '\b') {
          // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else {
          password += char;
          process.stdout.write('*');
        }
      };
      
      process.stdin.on('data', onData);
    } else {
      rl.question(prompt, (answer) => {
        rl.close();
        resolve(answer);
      });
    }
  });
}

/**
 * 验证主密码是否正确
 */
export function verifyPassword(masterPassword: string): boolean {
  if (!fs.existsSync(ENV_ENCRYPTED_FILE)) {
    return true; // 没有加密文件，无需验证
  }

  const key = deriveKey(masterPassword);
  const content = fs.readFileSync(ENV_ENCRYPTED_FILE, 'utf-8');
  const lines = content.split('\n');

  for (const line of lines) {
    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) continue;

    const value = line.substring(eqIndex + 1);
    if (value.startsWith(SM4_PREFIX)) {
      try {
        const cipherText = value.substring(SM4_PREFIX.length);
        decrypt(cipherText, key);
        return true; // 解密成功
      } catch {
        return false; // 解密失败
      }
    }
  }

  return true;
}
