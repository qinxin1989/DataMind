/**
 * AI 提供商服务
 * 支持按优先级调用，自动故障转移
 */

import OpenAI from 'openai';
import { aiConfigService } from '../admin/modules/ai/aiConfigService';
import { pool } from '../admin/core/database';
import { v4 as uuidv4 } from 'uuid';

export interface AICallResult {
  success: boolean;
  content?: string;
  provider?: string;
  model?: string;
  error?: string;
  fallbackUsed?: boolean;
  originalProvider?: string;
}

export interface AICallOptions {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  maxTokens?: number;
  temperature?: number;
  userId?: string;
}

class AIProviderService {
  /**
   * 调用 AI，按优先级尝试，失败自动切换
   */
  async call(options: AICallOptions): Promise<AICallResult> {
    const configs = await aiConfigService.getActiveConfigsByPriority();
    
    if (configs.length === 0) {
      return { success: false, error: '没有可用的 AI 配置' };
    }

    let lastError = '';
    let originalProvider = '';

    for (let i = 0; i < configs.length; i++) {
      const config = configs[i];
      
      if (i === 0) {
        originalProvider = config.name;
      }

      try {
        const openai = new OpenAI({
          apiKey: config.apiKey,
          baseURL: config.baseUrl || undefined,
        });

        const response = await openai.chat.completions.create({
          model: config.model,
          messages: options.messages,
          max_tokens: options.maxTokens || 4096,
          temperature: options.temperature ?? 0.7,
        });

        const content = response.choices[0]?.message?.content || '';
        
        // 如果不是第一个配置，说明发生了故障转移
        if (i > 0) {
          // 发送通知
          await this.sendFallbackNotification(
            options.userId,
            originalProvider,
            config.name,
            lastError
          );
        }

        return {
          success: true,
          content,
          provider: config.name,
          model: config.model,
          fallbackUsed: i > 0,
          originalProvider: i > 0 ? originalProvider : undefined,
        };
      } catch (err: any) {
        lastError = err.message || '调用失败';
        console.error(`AI 调用失败 [${config.name}]:`, lastError);
        // 继续尝试下一个配置
      }
    }

    // 所有配置都失败了
    await this.sendAllFailedNotification(options.userId, lastError);
    
    return {
      success: false,
      error: `所有 AI 配置都无法访问: ${lastError}`,
    };
  }

  /**
   * 发送故障转移通知
   */
  private async sendFallbackNotification(
    userId: string | undefined,
    originalProvider: string,
    fallbackProvider: string,
    error: string
  ): Promise<void> {
    try {
      // 发送给所有管理员
      const [admins] = await pool.execute(
        `SELECT u.id FROM sys_users u 
         JOIN sys_user_roles ur ON u.id = ur.user_id 
         JOIN sys_roles r ON ur.role_id = r.id 
         WHERE r.code IN ('super_admin', 'admin') AND u.status = 'active'`
      );

      const adminIds = (admins as any[]).map(a => a.id);
      
      // 如果有当前用户，也通知他
      if (userId && !adminIds.includes(userId)) {
        adminIds.push(userId);
      }

      for (const adminId of adminIds) {
        await pool.execute(
          `INSERT INTO sys_notifications (id, user_id, title, content, type) VALUES (?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            adminId,
            'AI 服务自动切换',
            `原服务 "${originalProvider}" 调用失败 (${error})，已自动切换到 "${fallbackProvider}"`,
            'warning',
          ]
        );
      }
    } catch (err) {
      console.error('发送通知失败:', err);
    }
  }

  /**
   * 发送全部失败通知
   */
  private async sendAllFailedNotification(
    userId: string | undefined,
    error: string
  ): Promise<void> {
    try {
      const [admins] = await pool.execute(
        `SELECT u.id FROM sys_users u 
         JOIN sys_user_roles ur ON u.id = ur.user_id 
         JOIN sys_roles r ON ur.role_id = r.id 
         WHERE r.code IN ('super_admin', 'admin') AND u.status = 'active'`
      );

      const adminIds = (admins as any[]).map(a => a.id);
      
      if (userId && !adminIds.includes(userId)) {
        adminIds.push(userId);
      }

      for (const adminId of adminIds) {
        await pool.execute(
          `INSERT INTO sys_notifications (id, user_id, title, content, type) VALUES (?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            adminId,
            'AI 服务全部不可用',
            `所有 AI 配置都无法访问，请检查配置。最后错误: ${error}`,
            'error',
          ]
        );
      }
    } catch (err) {
      console.error('发送通知失败:', err);
    }
  }

  /**
   * 获取当前可用的 AI 配置（按优先级）
   */
  async getAvailableConfigs() {
    return aiConfigService.getActiveConfigsByPriority();
  }
}

export const aiProviderService = new AIProviderService();
