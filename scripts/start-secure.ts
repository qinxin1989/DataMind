/**
 * 安全启动脚本
 * 启动时输入主密码解密配置
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { loadEncryptedEnv, promptPassword, verifyPassword } from '../src/utils/envCrypto';

const ENV_ENCRYPTED_FILE = path.join(process.cwd(), '.env.encrypted');
const ENV_FILE = path.join(process.cwd(), '.env');

async function main() {
  console.log('=== AI 数据平台 - 安全启动 ===\n');

  // 检查是否有加密配置文件
  if (fs.existsSync(ENV_ENCRYPTED_FILE)) {
    console.log('检测到加密配置文件，需要输入主密码\n');
    
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      const password = await promptPassword('请输入主密码: ');
      
      if (verifyPassword(password)) {
        try {
          loadEncryptedEnv(password);
          console.log('配置加载成功\n');
          break;
        } catch (error: any) {
          console.error('加载配置失败:', error.message);
          attempts++;
        }
      } else {
        console.error('密码错误，请重试');
        attempts++;
      }
      
      if (attempts >= maxAttempts) {
        console.error(`\n错误: 密码错误次数过多 (${maxAttempts}次)，退出`);
        process.exit(1);
      }
    }
  } else if (fs.existsSync(ENV_FILE)) {
    // 使用普通 .env 文件
    console.log('使用 .env 配置文件（未加密）\n');
    require('dotenv').config();
  } else {
    console.error('错误: 找不到配置文件');
    process.exit(1);
  }

  // 启动主应用
  console.log('正在启动服务...\n');
  
  const child = spawn('npx', ['tsx', 'src/index.ts'], {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });

  child.on('error', (error) => {
    console.error('启动失败:', error);
    process.exit(1);
  });

  child.on('exit', (code) => {
    process.exit(code || 0);
  });
}

main();
