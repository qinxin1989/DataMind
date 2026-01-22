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
    console.log('\n✅ 加密完成！(.env.encrypted 已生成)');

    console.log('\n⚠️  重要提示：');
    console.log('1. 启动服务时必须输入此主密码，请务必牢记！');
    console.log('2. 如果丢失主密码，将无法解密配置，且无法恢复！');

    // 询问是否删除 .env
    console.log('\n为了生产环境安全，建议删除原始 .env 文件。');
    const deleteEnv = await promptPassword('是否现在删除 .env 文件? (y/N): ');

    if (deleteEnv.toLowerCase() === 'y') {
      const fs = require('fs');
      const path = require('path');
      const envPath = path.join(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        fs.unlinkSync(envPath);
        console.log('🗑️  已删除 .env 文件');
      }
    } else {
      console.log('已保留 .env 文件。请手动删除以确保安全。');
    }
  } catch (error: any) {
    console.error('加密失败:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

main();
