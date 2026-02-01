/**
 * 配置管理器
 * 负责管理模块的配置
 */

import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { query } from '../../admin/core/database';

/**
 * 配置验证结果接口
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * 配置管理器类
 */
export class ConfigManager {
  private encryptionKey: string;

  constructor(encryptionKey?: string) {
    this.encryptionKey = encryptionKey || process.env.CONFIG_ENCRYPTION_KEY || 'default-key-change-me';
  }

  /**
   * 获取模块配置
   */
  async getConfig(moduleName: string): Promise<any> {
    try {
      const configs = await query(
        'SELECT config_key, config_value, is_encrypted FROM sys_module_configs WHERE module_name = ?',
        [moduleName]
      );

      const result: any = {};

      for (const config of configs) {
        const value = config.is_encrypted
          ? this.decrypt(config.config_value)
          : config.config_value;

        // 尝试解析 JSON
        try {
          result[config.config_key] = JSON.parse(value);
        } catch {
          result[config.config_key] = value;
        }
      }

      return result;
    } catch (error) {
      throw new Error(`Failed to get config for module ${moduleName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 更新模块配置
   */
  async updateConfig(moduleName: string, config: any): Promise<void> {
    try {
      for (const [key, value] of Object.entries(config)) {
        const isEncrypted = this.shouldEncrypt(key);
        const configValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
        const storedValue = isEncrypted ? this.encrypt(configValue) : configValue;

        // 检查配置是否存在
        const existing = await query(
          'SELECT id FROM sys_module_configs WHERE module_name = ? AND config_key = ?',
          [moduleName, key]
        );

        if (existing.length > 0) {
          // 更新现有配置
          await query(
            `UPDATE sys_module_configs 
             SET config_value = ?, is_encrypted = ?, updated_at = NOW()
             WHERE module_name = ? AND config_key = ?`,
            [storedValue, isEncrypted, moduleName, key]
          );
        } else {
          // 插入新配置
          await query(
            `INSERT INTO sys_module_configs 
             (id, module_name, config_key, config_value, is_encrypted, updated_at)
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [uuidv4(), moduleName, key, storedValue, isEncrypted]
          );
        }
      }

      console.log(`Config updated for module ${moduleName}`);
    } catch (error) {
      throw new Error(`Failed to update config for module ${moduleName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 重置为默认配置
   */
  async resetConfig(moduleName: string): Promise<void> {
    try {
      await query(
        'DELETE FROM sys_module_configs WHERE module_name = ?',
        [moduleName]
      );

      console.log(`Config reset for module ${moduleName}`);
    } catch (error) {
      throw new Error(`Failed to reset config for module ${moduleName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 验证配置
   */
  async validateConfig(moduleName: string, config: any): Promise<ValidationResult> {
    const errors: string[] = [];

    // 基本验证
    if (!config || typeof config !== 'object') {
      errors.push('Config must be an object');
      return { valid: false, errors };
    }

    // TODO: 实现 JSON Schema 验证
    // 这里可以加载模块的 schema 文件并验证

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 判断是否应该加密
   */
  private shouldEncrypt(key: string): boolean {
    const sensitiveKeys = ['password', 'secret', 'key', 'token', 'apiKey', 'api_key'];
    return sensitiveKeys.some(k => key.toLowerCase().includes(k));
  }

  /**
   * 加密配置值
   */
  private encrypt(value: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(this.encryptionKey.padEnd(32, '0').slice(0, 32)),
      iv
    );

    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * 解密配置值
   */
  private decrypt(value: string): string {
    const parts = value.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];

    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(this.encryptionKey.padEnd(32, '0').slice(0, 32)),
      iv
    );

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * 获取配置项
   */
  async getConfigValue(moduleName: string, key: string): Promise<any> {
    try {
      const result = await query(
        'SELECT config_value, is_encrypted FROM sys_module_configs WHERE module_name = ? AND config_key = ?',
        [moduleName, key]
      );

      if (result.length === 0) {
        return null;
      }

      const value = result[0].is_encrypted
        ? this.decrypt(result[0].config_value)
        : result[0].config_value;

      // 尝试解析 JSON
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    } catch (error) {
      throw new Error(`Failed to get config value: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 设置配置项
   */
  async setConfigValue(moduleName: string, key: string, value: any): Promise<void> {
    const config = { [key]: value };
    await this.updateConfig(moduleName, config);
  }
}

// 导出单例实例
export const configManager = new ConfigManager();
