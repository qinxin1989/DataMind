import { pool } from '../src/admin/core/database';
import { decrypt } from '../src/admin/utils/crypto';

async function checkAIConfigs() {
  console.log('=== 检查 AI 配置 ===\n');

  try {
    const [rows] = await pool.execute(
      'SELECT * FROM sys_ai_configs ORDER BY priority ASC'
    );

    const configs = rows as any[];
    
    if (configs.length === 0) {
      console.log('❌ 数据库中没有找到 AI 配置！');
      console.log('\n请按照以下步骤配置：');
      console.log('1. 访问 http://localhost:3000');
      console.log('2. 登录后进入"AI配置"页面');
      console.log('3. 添加AI提供商配置（通义千问、OpenAI等）');
      console.log('4. 确保配置状态为"启用"');
      process.exit(1);
    }

    console.log(`找到 ${configs.length} 个配置:\n`);

    for (const config of configs) {
      console.log(`--- ${config.name} (${config.provider}) ---`);
      console.log(`  模型: ${config.model}`);
      console.log(`  状态: ${config.status === 'active' ? '✅ 启用' : '❌ 禁用'}`);
      console.log(`  默认: ${config.is_default ? '✅ 是' : '否'}`);
      console.log(`  优先级: ${config.priority}`);
      console.log(`  Base URL: ${config.base_url || '未设置'}`);
      
      if (config.status !== 'active') {
        console.log(`  ⚠️  此配置未启用，跳过测试\n`);
        continue;
      }
      
      let apiKey: string;
      try {
        apiKey = decrypt(config.api_key);
        console.log(`  API Key: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`);
      } catch (e) {
        console.log(`  ❌ API Key 解密失败！\n`);
        continue;
      }

      if (!apiKey || apiKey.length < 10) {
        console.log(`  ❌ API Key 无效！\n`);
        continue;
      }

      console.log(`  ✅ 配置有效\n`);
    }

    const activeConfigs = configs.filter(c => c.status === 'active');
    if (activeConfigs.length === 0) {
      console.log('❌ 没有启用的 AI 配置！');
      console.log('请在管理后台启用至少一个 AI 配置。\n');
      process.exit(1);
    }

    console.log('✅ AI 配置检查完成！\n');

  } catch (error: any) {
    console.error('❌ 数据库连接失败:', error.message);
    console.error('\n请确保：');
    console.error('1. MySQL 服务已启动');
    console.error('2. 数据库配置正确（.env 文件）');
    console.error('3. 数据库已初始化（运行 init.sql）\n');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkAIConfigs();
