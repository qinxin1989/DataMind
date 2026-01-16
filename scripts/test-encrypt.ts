/**
 * 测试加密功能（非交互式）
 */

import * as fs from 'fs';
import * as path from 'path';
import { encryptEnvFile, loadEncryptedEnv, verifyPassword } from '../src/utils/envCrypto';

const testPassword = 'test123456';

async function main() {
  console.log('=== 测试加密功能 ===\n');

  try {
    // 1. 加密 .env 文件
    console.log('1. 加密 .env 文件...');
    await encryptEnvFile(testPassword);
    
    // 2. 验证密码
    console.log('\n2. 验证密码...');
    const isValid = verifyPassword(testPassword);
    console.log(`密码验证: ${isValid ? '成功' : '失败'}`);
    
    const isInvalid = verifyPassword('wrongpassword');
    console.log(`错误密码验证: ${isInvalid ? '失败（应该返回false）' : '成功（正确返回false）'}`);
    
    // 3. 加载加密配置
    console.log('\n3. 加载加密配置...');
    loadEncryptedEnv(testPassword);
    
    // 4. 验证解密后的值
    console.log('\n4. 验证解密后的值:');
    console.log(`CONFIG_DB_PASSWORD: ${process.env.CONFIG_DB_PASSWORD}`);
    console.log(`FILE_ENCRYPTION_KEY: ${process.env.FILE_ENCRYPTION_KEY}`);
    console.log(`JWT_SECRET: ${process.env.JWT_SECRET}`);
    
    // 5. 显示加密文件内容
    console.log('\n5. 加密文件内容:');
    const encryptedContent = fs.readFileSync('.env.encrypted', 'utf-8');
    console.log(encryptedContent);
    
    console.log('\n=== 测试完成 ===');
  } catch (error: any) {
    console.error('测试失败:', error.message);
    process.exit(1);
  }
}

main();
