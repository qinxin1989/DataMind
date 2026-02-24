/**
 * Shell Skill - 执行系统命令
 * 移植自 ai-agent-plus code_tools.py run_command
 */

import { exec } from 'child_process';
import { SkillDefinition } from '../registry';

const runCommand: SkillDefinition = {
  name: 'shell.runCommand',
  category: 'shell',
  displayName: '执行命令',
  description: '在系统中执行 Shell 命令并返回结果',
  parameters: [
    { name: 'command', type: 'string', description: '要执行的命令', required: true },
    { name: 'timeout', type: 'number', description: '超时时间（秒）', required: false },
    { name: 'cwd', type: 'string', description: '工作目录', required: false },
  ],
  execute: async (params, ctx) => {
    const command = params.command;
    if (!command) return { success: false, message: 'Error: 命令不能为空' };

    // 安全检查：禁止高危命令
    const dangerous = ['rm -rf /', 'format ', 'del /f /s /q C:', 'mkfs'];
    for (const d of dangerous) {
      if (command.toLowerCase().includes(d)) {
        return { success: false, message: `Error: 禁止执行危险命令: ${d}` };
      }
    }

    const timeout = ((params.timeout || 30) * 1000);
    const cwd = params.cwd || ctx?.workDir || process.cwd();

    return new Promise((resolve) => {
      exec(command, { timeout, cwd, maxBuffer: 5 * 1024 * 1024, encoding: 'utf-8' }, (error, stdout, stderr) => {
        if (error) {
          if (error.killed) {
            resolve({ success: false, message: `Error: 命令执行超时 (${params.timeout || 30}s)` });
            return;
          }
          const output = [stdout, stderr].filter(Boolean).join('\n').slice(0, 4000);
          resolve({ success: false, message: `Error: 命令返回非零状态码 ${error.code}\n${output}` });
          return;
        }
        const output = [stdout, stderr].filter(Boolean).join('\n');
        const truncated = output.length > 8000 ? output.slice(0, 8000) + `\n...(共${output.length}字符)` : output;
        resolve({ success: true, data: truncated, message: '命令执行成功' });
      });
    });
  },
};

export const shellSkills: SkillDefinition[] = [runCommand];
