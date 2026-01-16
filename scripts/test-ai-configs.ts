/**
 * 测试 AI 配置脚本
 * 运行: npx ts-node scripts/test-ai-configs.ts
 */

import OpenAI from 'openai';
import { pool } from '../src/admin/core/database';
import { decrypt } from '../src/admin/utils/crypto';

async function testAIConfigs() {
  console.log('=== 测试 AI 配置 ===\n');

  try {
    const [rows] = await pool.execute(
      'SELECT * FROM sys_ai_configs WHERE status = ? ORDER BY priority ASC',
      ['active']
    );

    const configs = rows as any[];
    
    if (configs.length === 0) {
      console.log('没有找到启用的 AI 配置！');
      process.exit(1);
    }

    console.log(`找到 ${configs.length} 个配置:\n`);

    for (const config of configs) {
      console.log(`--- ${config.name} (${config.provider}) ---`);
      console.log(`  模型: ${config.model}`);
      console.log(`  优先级: ${config.priority}`);
      console.log(`  Base URL: ${config.base_url || '未设置'}`);
      
      // 解密 API Key
      let apiKey: string;
      try {
        apiKey = decrypt(config.api_key);
        console.log(`  API Key: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`);
      } catch (e) {
        console.log(`  API Key: 解密失败！`);
        continue;
      }

      // 测试连接
      console.log(`  测试中...`);
      try {
        const openai = new OpenAI({
          apiKey,
          baseURL: config.base_url || undefined,
          timeout: 10000,
        });

        const response = await openai.chat.completions.create({
          model: config.model,
          messages: [{ role: 'user', content: '你好，请回复"测试成功"' }],
          max_tokens: 20,
        });

        const reply = response.choices[0]?.message?.content || '';
        console.log(`  ✅ 成功! 回复: ${reply.substring(0, 50)}`);
      } catch (error: any) {
        console.log(`  ❌ 失败: ${error.message}`);
        
        // 给出修复建议
        if (error.message.includes('401')) {
          console.log(`  💡 建议: API Key 无效，请检查是否正确`);
        } else if (error.message.includes('429')) {
          console.log(`  💡 建议: 余额不足或请求过多，请充值或稍后重试`);
        } else if (error.message.includes('Connection')) {
          console.log(`  💡 建议: 连接失败，请检查 Base URL 是否正确`);
          if (config.provider === 'qwen') {
            console.log(`     通义千问正确的 URL: https://dashscope.aliyuncs.com/compatible-mode/v1`);
          } else if (config.provider === 'zhipu') {
            console.log(`     智谱AI正确的 URL: https://open.bigmodel.cn/api/paas/v4`);
          } else if (config.provider === 'siliconflow') {
            console.log(`     SiliconFlow正确的 URL: https://api.siliconflow.cn/v1`);
          }
        }
      }
      console.log('');
    }

  } catch (error: any) {
    console.error('数据库连接失败:', error.message);
  } finally {
    await pool.end();
  }
}

testAIConfigs();
