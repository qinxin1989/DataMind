/**
 * 加密 .env 文件
 * 用法: npx tsx scripts/encrypt-env.ts
 */

import { encryptEnvFile, promptPassword } from '../src/utils/envCrypto';

async function main() {
  console.log('=== 加密环境配置文件 ===\n');
  console.log('此工具将加密 .env 文件中的敏感配置，生成 .env.encrypted 文件');
  console.log('敏感配置项: CONFIG_DB_PASSWORD, FILE_ENCRYPTION_KEY, JWT_SECRET\n');

  const password = await promptPassword('请输入主密码: ');
  
  if (!password || password.length < 6) {
    console.error('错误: 主密码至少需要 6 个字符');
    process.exit(1);
  }

  const confirmPassword = await promptPassword('请再次输入主密码: ');
  
  if (password !== confirmPassword) {
    console.error('错误: 两次输入的密码不一致');
    process.exit(1);
  }

  try {
    await encryptEnvFile(password);
    console.log('\n加密完成！');
    console.log('提示:');
    console.log('1. 可以删除 .env 文件，只保留 .env.encrypted');
    console.log('2. 启动服务时需要输入主密码');
    console.log('3. 请牢记主密码，丢失后无法恢复配置');
  } catch (error: any) {
    console.error('加密失败:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

main();
