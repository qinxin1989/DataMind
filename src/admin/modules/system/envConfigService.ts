/**
 * 环境配置服务
 * 管理 .env.encrypted 中的数据库配置
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
// @ts-ignore
import { sm4 } from 'sm-crypto';

const ENV_FILE = path.join(process.cwd(), '.env');
const ENV_ENCRYPTED_FILE = path.join(process.cwd(), '.env.encrypted');
const SM4_PREFIX = 'SM4ENC:';

// 可通过前端修改的数据库配置项
const EDITABLE_DB_KEYS = [
  'CONFIG_DB_HOST',
  'CONFIG_DB_PORT',
  'CONFIG_DB_USER',
  'CONFIG_DB_PASSWORD',
  'CONFIG_DB_NAME',
];

// 敏感配置项（需要加密）
const SENSITIVE_KEYS = [
  'CONFIG_DB_PASSWORD',
  'FILE_ENCRYPTION_KEY',
  'JWT_SECRET',
];

export interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

/**
 * 从主密码生成 SM4 密钥
 */
function deriveKey(masterPassword: string): string {
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
 * 读取配置文件内容
 */
function readEnvFile(): { lines: string[]; isEncrypted: boolean } {
  if (fs.existsSync(ENV_ENCRYPTED_FILE)) {
    return {
      lines: fs.readFileSync(ENV_ENCRYPTED_FILE, 'utf-8').split('\n'),
      isEncrypted: true,
    };
  }
  if (fs.existsSync(ENV_FILE)) {
    return {
      lines: fs.readFileSync(ENV_FILE, 'utf-8').split('\n'),
      isEncrypted: false,
    };
  }
  throw new Error('找不到配置文件');
}

/**
 * 解析配置行
 */
function parseLine(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  
  const eqIndex = line.indexOf('=');
  if (eqIndex === -1) return null;
  
  return {
    key: line.substring(0, eqIndex).trim(),
    value: line.substring(eqIndex + 1),
  };
}

class EnvConfigService {
  private masterPassword: string | null = null;

  /**
   * 设置主密码（启动时调用）
   */
  setMasterPassword(password: string): void {
    this.masterPassword = password;
  }

  /**
   * 获取主密码
   */
  private getKey(): string {
    // 优先使用设置的主密码
    if (this.masterPassword) {
      return deriveKey(this.masterPassword);
    }
    // 否则使用环境变量中的密码
    const envPassword = process.env.ENV_MASTER_PASSWORD;
    if (envPassword) {
      return deriveKey(envPassword);
    }
    throw new Error('未设置主密码，无法操作加密配置');
  }

  /**
   * 获取数据库配置（用于前端显示）
   */
  async getDbConfig(): Promise<DbConfig> {
    const { lines, isEncrypted } = readEnvFile();
    const config: Record<string, string> = {};

    for (const line of lines) {
      const parsed = parseLine(line);
      if (!parsed) continue;
      
      const { key, value } = parsed;
      if (!EDITABLE_DB_KEYS.includes(key)) continue;

      // 解密敏感值
      if (isEncrypted && value.startsWith(SM4_PREFIX) && SENSITIVE_KEYS.includes(key)) {
        try {
          const cipherText = value.substring(SM4_PREFIX.length);
          config[key] = decrypt(cipherText, this.getKey());
        } catch {
          config[key] = '******'; // 解密失败显示掩码
        }
      } else {
        config[key] = value;
      }
    }

    return {
      host: config.CONFIG_DB_HOST || 'localhost',
      port: parseInt(config.CONFIG_DB_PORT || '3306', 10),
      user: config.CONFIG_DB_USER || 'root',
      password: config.CONFIG_DB_PASSWORD || '',
      database: config.CONFIG_DB_NAME || '',
    };
  }

  /**
   * 更新数据库配置
   */
  async updateDbConfig(newConfig: Partial<DbConfig>): Promise<DbConfig> {
    const { lines, isEncrypted } = readEnvFile();
    const key = isEncrypted ? this.getKey() : null;
    
    // 映射前端字段到环境变量名
    const fieldMap: Record<string, string> = {
      host: 'CONFIG_DB_HOST',
      port: 'CONFIG_DB_PORT',
      user: 'CONFIG_DB_USER',
      password: 'CONFIG_DB_PASSWORD',
      database: 'CONFIG_DB_NAME',
    };

    const updatedLines: string[] = [];
    const updatedKeys = new Set<string>();

    for (const line of lines) {
      const parsed = parseLine(line);
      
      if (!parsed) {
        updatedLines.push(line);
        continue;
      }

      const { key: envKey } = parsed;
      let newValue: string | undefined;

      // 检查是否需要更新
      for (const [field, envName] of Object.entries(fieldMap)) {
        if (envKey === envName && newConfig[field as keyof DbConfig] !== undefined) {
          newValue = String(newConfig[field as keyof DbConfig]);
          updatedKeys.add(envKey);
          break;
        }
      }

      if (newValue !== undefined) {
        // 敏感字段需要加密
        if (isEncrypted && SENSITIVE_KEYS.includes(envKey) && key) {
          const encrypted = encrypt(newValue, key);
          updatedLines.push(`${envKey}=${SM4_PREFIX}${encrypted}`);
        } else {
          updatedLines.push(`${envKey}=${newValue}`);
        }
      } else {
        updatedLines.push(line);
      }
    }

    // 写入文件
    const targetFile = isEncrypted ? ENV_ENCRYPTED_FILE : ENV_FILE;
    fs.writeFileSync(targetFile, updatedLines.join('\n'));

    // 更新当前进程的环境变量
    for (const [field, envName] of Object.entries(fieldMap)) {
      if (newConfig[field as keyof DbConfig] !== undefined) {
        process.env[envName] = String(newConfig[field as keyof DbConfig]);
      }
    }

    return this.getDbConfig();
  }

  /**
   * 测试数据库连接
   */
  async testConnection(config: DbConfig): Promise<{ success: boolean; message: string }> {
    const mysql = require('mysql2/promise');
    
    try {
      const connection = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        connectTimeout: 5000,
      });
      
      await connection.ping();
      await connection.end();
      
      return { success: true, message: '连接成功' };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }
}

export const envConfigService = new EnvConfigService();
