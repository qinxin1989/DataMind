import OpenAI from 'openai';
import { pool } from '../src/admin/core/database';
import { decrypt } from '../src/admin/utils/crypto';

async function testEmbedding() {
  console.log('=== 测试嵌入生成 ===\n');

  try {
    const [rows] = await pool.execute(
      'SELECT * FROM sys_ai_configs WHERE status = ? AND is_default = TRUE LIMIT 1',
      ['active']
    );

    const configs = rows as any[];
    
    if (configs.length === 0) {
      console.log('❌ 没有找到默认的启用配置！');
      process.exit(1);
    }

    const config = configs[0];
    console.log(`测试配置: ${config.name} (${config.provider})`);
    console.log(`模型: ${config.model}`);
    console.log(`Base URL: ${config.base_url}\n`);

    let apiKey: string;
    try {
      apiKey = decrypt(config.api_key);
      console.log(`API Key: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}\n`);
    } catch (e) {
      console.log(`❌ API Key 解密失败！\n`);
      process.exit(1);
    }

    const openai = new OpenAI({
      apiKey,
      baseURL: config.base_url || undefined,
      timeout: 30000,
    });

    let embeddingModel: string;
    if (config.provider === 'qwen') {
      embeddingModel = 'text-embedding-v2';
    } else if (config.provider === 'siliconflow') {
      embeddingModel = 'BAAI/bge-large-zh-v1.5';
    } else if (config.provider === 'zhipu') {
      embeddingModel = 'embedding-2';
    } else {
      embeddingModel = 'text-embedding-ada-002';
    }
    
    console.log(`嵌入模型: ${embeddingModel}\n`);

    console.log('测试 1: 生成单个嵌入...');
    try {
      const response = await openai.embeddings.create({
        model: embeddingModel,
        input: '测试文本',
      });
      console.log(`✅ 成功! 嵌入维度: ${response.data[0].embedding.length}\n`);
    } catch (error: any) {
      console.log(`❌ 失败: ${error.message}`);
      
      if (error.message.includes('403') || error.message.includes('401')) {
        console.log(`\n💡 403/401 错误通常表示：`);
        console.log(`   1. API Key 无效或已过期`);
        console.log(`   2. API Key 没有使用嵌入模型的权限`);
        console.log(`   3. 账户余额不足`);
        
        if (config.provider === 'qwen') {
          console.log(`\n   通义千问嵌入模型说明：`);
          console.log(`   - 需要 DashScope API Key`);
          console.log(`   - 确保账户有足够的余额`);
          console.log(`   - 访问: https://dashscope.console.aliyun.com/apiKey`);
        } else if (config.provider === 'siliconflow') {
          console.log(`\n   SiliconFlow 嵌入模型说明：`);
          console.log(`   - SiliconFlow 可能不支持所有嵌入模型`);
          console.log(`   - 建议使用通义千问的嵌入服务`);
        }
      }
      process.exit(1);
    }

    console.log('测试 2: 批量生成嵌入...');
    try {
      const response = await openai.embeddings.create({
        model: embeddingModel,
        input: ['文本1', '文本2', '文本3'],
      });
      console.log(`✅ 成功! 生成了 ${response.data.length} 个嵌入\n`);
    } catch (error: any) {
      console.log(`❌ 失败: ${error.message}\n`);
    }

    console.log('✅ 嵌入生成测试完成！\n');

  } catch (error: any) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testEmbedding();
