/**
 * Architecture Diagram Skill - 架构图生成
 * 移植自 ai-agent-plus architecture_diagram_skill.py
 * 基于 Mermaid 语法生成架构图
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { SkillDefinition } from '../registry';

const generateArchitectureDiagram: SkillDefinition = {
  name: 'diagram.generateArchitectureDiagram',
  category: 'media',
  displayName: '生成架构图',
  description: '基于 Mermaid 语法生成架构图（输出 SVG/PNG）',
  parameters: [
    { name: 'mermaidCode', type: 'string', description: 'Mermaid 图表代码', required: true },
    { name: 'outputPath', type: 'string', description: '输出文件路径（.svg 或 .png）', required: true },
    { name: 'theme', type: 'string', description: '主题（default/dark/forest/neutral）', required: false },
  ],
  execute: async (params) => {
    const outputPath = path.resolve(params.outputPath);
    const theme = params.theme || 'default';

    // 写入临时 .mmd 文件
    const tmpDir = path.join(process.env.TEMP || '/tmp', 'datamind-diagrams');
    fs.mkdirSync(tmpDir, { recursive: true });
    const mmdPath = path.join(tmpDir, `diagram_${Date.now()}.mmd`);
    fs.writeFileSync(mmdPath, params.mermaidCode, 'utf-8');

    // 尝试使用 @mermaid-js/mermaid-cli (mmdc)
    return new Promise((resolve) => {
      const ext = path.extname(outputPath).slice(1) || 'svg';
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });

      exec(
        `npx -y @mermaid-js/mermaid-cli mmdc -i "${mmdPath}" -o "${outputPath}" -t ${theme} -e ${ext}`,
        { timeout: 30000, maxBuffer: 5 * 1024 * 1024 },
        (error) => {
          // 清理临时文件
          try { fs.unlinkSync(mmdPath); } catch { /* ignore */ }

          if (error) {
            // 后备：直接保存 .mmd 文件
            const mmdOutput = outputPath.replace(/\.[^.]+$/, '.mmd');
            fs.writeFileSync(mmdOutput, params.mermaidCode, 'utf-8');
            resolve({
              success: true,
              message: `mmdc 不可用，已保存 Mermaid 源文件: ${mmdOutput}。可在 https://mermaid.live 在线渲染。`,
              outputPath: mmdOutput,
            });
            return;
          }

          resolve({ success: true, message: `成功生成架构图: ${outputPath}`, outputPath });
        }
      );
    });
  },
};

export const architectureDiagramSkills: SkillDefinition[] = [generateArchitectureDiagram];
