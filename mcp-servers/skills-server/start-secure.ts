/**
 * Skills Server 安全启动脚本
 * 启动时输入主密码解密配置
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { loadEncryptedEnv, promptPassword, verifyPassword } from '../../../src/utils/envCrypto.js';

const rootDir = path.resolve(process.cwd(), '../../');
const ENV_ENCRYPTED_FILE = path.join(rootDir, '.env.encrypted');
const ENV_FILE = path.join(rootDir, '.env');

async function main() {
    console.log('=== Skills MCP Server - 安全启动 ===\n');

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
        // 注意：这里不需要 dotenv.config()，因为 index.ts 会自己加载
        // 但为了确保 index.ts 能读到正确的环境变量（如果它依赖 process.env），还是加载一下比较安全
        // 不过 skills-server 现在的 index.ts 已经有了完善的加载逻辑
    } else {
        console.error('错误: 找不到配置文件');
        process.exit(1);
    }

    // 启动 MCP Server
    console.log('正在启动服务...\n');

    // 使用 inherit stdio 会导致 MCP 协议混乱（因为 MCP 使用 stdin/stdout 通信）
    // 但是，如果这是为了交互式启动，那么在启动真正的 MCP Server 之前，我们可以占用 stdio。
    // 一旦启动 Server，我们应该让它接管 stdio。

    // 注意：MCP Server 必须独占 stdout。
    // 刚才的 console.log 已经输出了很多内容，如果是被 MCP Client 调用，这些 log 会破坏协议握手。
    // 但是，这个脚本是为了"手动启动"设计的。
    // 如果是被 Claude Desktop 调用，它不会支持交互式输入密码。
    // 所以这个脚本仅用于手动调试或作为独立服务运行。

    const child = spawn('node', ['dist/index.js'], {
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
