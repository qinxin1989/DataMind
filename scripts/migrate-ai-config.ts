/**
 * 将 .env 中的大模型配置迁移到数据库
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

async function migrateAIConfig() {
  const pool = mysql.createPool({
    host: process.env.CONFIG_DB_HOST || 'localhost',
    port: parseInt(process.env.CONFIG_DB_PORT || '3306'),
    user: process.env.CONFIG_DB_USER || 'root',
    password: process.env.CONFIG_DB_PASSWORD || '',
    database: process.env.CONFIG_DB_NAME || 'ai-data-platform',
  });

  const connection = await pool.getConnection();

  try {
    // 清空现有配置
    await connection.execute('DELETE FROM sys_ai_configs');
    console.log('已清空现有 AI 配置');

    const configs = [];

    // SiliconFlow 配置 (设为默认)
    if (process.env.SILICONFLOW_API_KEY) {
      configs.push({
        id: uuidv4(),
        name: 'SiliconFlow Qwen3-32B',
        provider: 'siliconflow',
        model: 'Qwen/Qwen3-32B',
        apiKey: process.env.SILICONFLOW_API_KEY,
        baseUrl: process.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.cn/v1',
        isDefault: true,
        status: 'active',
      });
    }

    // 阿里云千问配置
    if (process.env.QWEN_API_KEY) {
      configs.push({
        id: uuidv4(),
        name: '通义千问',
        provider: 'qwen',
        model: 'qwen-plus',
        apiKey: process.env.QWEN_API_KEY,
        baseUrl: process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        isDefault: !process.env.SILICONFLOW_API_KEY, // 如果没有 SiliconFlow，则设为默认
        status: 'active',
      });
    }

    // OpenAI 配置
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-test-key') {
      configs.push({
        id: uuidv4(),
        name: 'OpenAI GPT-4',
        provider: 'openai',
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        apiKey: process.env.OPENAI_API_KEY,
        baseUrl: process.env.OPENAI_BASE_URL || null,
        isDefault: !process.env.SILICONFLOW_API_KEY && !process.env.QWEN_API_KEY,
        status: 'active',
      });
    }

    // 插入配置
    for (const config of configs) {
      await connection.execute(
        `INSERT INTO sys_ai_configs (id, name, provider, model, api_key, base_url, is_default, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [config.id, config.name, config.provider, config.model, config.apiKey, config.baseUrl, config.isDefault, config.status]
      );
      console.log(`已添加配置: ${config.name} (${config.provider})`);
    }

    console.log(`\n共迁移 ${configs.length} 个 AI 配置到数据库`);

    // 显示结果
    const [rows] = await connection.execute('SELECT id, name, provider, model, is_default, status FROM sys_ai_configs');
    console.log('\n当前数据库中的 AI 配置:');
    console.table(rows);

  } finally {
    connection.release();
    await pool.end();
  }
}

migrateAIConfig().catch(console.error);
