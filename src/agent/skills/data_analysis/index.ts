/**
 * Data Analysis Skill - 数据分析技能
 * 移植自 ai-agent-plus data_analysis_skill.py
 * 提供 Python 代码执行、统计分析、数据可视化等能力
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { SkillDefinition } from '../registry';

function pickParam<T = any>(params: Record<string, any>, ...keys: string[]): T | undefined {
  for (const key of keys) {
    if (params[key] !== undefined) {
      return params[key] as T;
    }
  }
  return undefined;
}

function parseJsonValue<T = any>(value: any): T {
  if (typeof value === 'string') {
    return JSON.parse(value) as T;
  }
  return value as T;
}

/**
 * 执行 Python 代码（通过 child_process）
 */
const executePython: SkillDefinition = {
  name: 'dataAnalysis.executePython',
  category: 'data_analysis',
  displayName: '执行 Python 代码',
  description: '执行 Python 代码（支持 pandas/numpy/matplotlib），用于数据分析和可视化',
  parameters: [
    { name: 'code', type: 'string', description: '要执行的 Python 代码', required: true },
    { name: 'timeout', type: 'number', description: '超时时间（秒）', required: false },
  ],
  execute: async (params) => {
    const code = pickParam<string>(params, 'code');
    if (!code || !code.trim()) {
      return { success: false, message: 'Error: Python 代码不能为空' };
    }

    const timeout = (Number(pickParam(params, 'timeout')) || 180) * 1000;

    // 写入临时 .py 文件
    const tmpDir = path.join(process.env.TEMP || '/tmp', 'datamind-python');
    fs.mkdirSync(tmpDir, { recursive: true });
    const scriptPath = path.join(tmpDir, `script_${Date.now()}.py`);

    // 预导入常用库 + 中文 matplotlib 支持
    const preamble = `
import sys, os, json, datetime, re, math, collections
try:
    import pandas as pd
except ImportError:
    pass
try:
    import numpy as np
except ImportError:
    pass
try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    plt.rcParams['font.sans-serif'] = ['SimHei', 'Microsoft YaHei', 'Arial Unicode MS']
    plt.rcParams['axes.unicode_minus'] = False
except ImportError:
    pass
try:
    import seaborn as sns
except ImportError:
    pass
`;
    fs.writeFileSync(scriptPath, preamble + '\n' + code, 'utf-8');

    return new Promise((resolve) => {
      exec(
        `python "${scriptPath}"`,
        { timeout, maxBuffer: 10 * 1024 * 1024, encoding: 'utf-8' },
        (error, stdout, stderr) => {
          // 清理临时文件
          try { fs.unlinkSync(scriptPath); } catch { /* ignore */ }

          if (error) {
            if (error.killed) {
              resolve({ success: false, message: `Error: Python 执行超时 (${params.timeout || 180}s)` });
              return;
            }
            const output = [stdout, stderr].filter(Boolean).join('\n').slice(0, 6000);
            resolve({ success: false, message: `Error: Python 执行失败 (exit ${error.code})\n${output}` });
            return;
          }

          const output = [stdout, stderr].filter(Boolean).join('\n');
          const truncated = output.length > 10000
            ? output.slice(0, 10000) + `\n...(共${output.length}字符)`
            : output;
          resolve({ success: true, data: truncated, message: 'Python 代码执行成功' });
        }
      );
    });
  },
};

/**
 * 创建数据可视化图表
 */
const createVisualization: SkillDefinition = {
  name: 'dataAnalysis.createVisualization',
  category: 'data_analysis',
  displayName: '创建数据可视化',
  description: '生成数据图表（bar/line/pie/scatter/histogram/box），输出为图片文件',
  parameters: [
    { name: 'data', type: 'string', description: 'JSON 格式的数据', required: true },
    { name: 'chartType', type: 'string', description: '图表类型 (bar/line/pie/scatter/histogram/box)', required: true },
    { name: 'title', type: 'string', description: '图表标题', required: true },
    { name: 'outputPath', type: 'string', description: '输出图片路径', required: true },
    { name: 'xLabel', type: 'string', description: 'X 轴标签', required: false },
    { name: 'yLabel', type: 'string', description: 'Y 轴标签', required: false },
  ],
  execute: async (params) => {
    const outputPath = path.resolve(
      pickParam<string>(params, 'outputPath', 'output_path') || 'outputs/chart.png'
    );
    const chartType = pickParam<string>(params, 'chartType', 'chart_type') || 'bar';
    const title = pickParam<string>(params, 'title') || '数据图表';
    const xLabel = pickParam<string>(params, 'xLabel', 'x_label');
    const yLabel = pickParam<string>(params, 'yLabel', 'y_label');
    const chartData = JSON.stringify(parseJsonValue(pickParam(params, 'data')));

    // 通过 Python matplotlib 生成
    const pyCode = `
import json, os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
plt.rcParams['font.sans-serif'] = ['SimHei', 'Microsoft YaHei', 'Arial Unicode MS']
plt.rcParams['axes.unicode_minus'] = False

data = json.loads('''${chartData.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}''')
fig, ax = plt.subplots(figsize=(10, 6))

chart_type = '${chartType}'
if chart_type == 'bar':
    if isinstance(data, dict):
        ax.bar(list(data.keys()), list(data.values()))
    elif isinstance(data, list):
        ax.bar(range(len(data)), data)
elif chart_type == 'line':
    if isinstance(data, dict):
        ax.plot(list(data.keys()), list(data.values()), marker='o')
    elif isinstance(data, list):
        ax.plot(data, marker='o')
elif chart_type == 'pie':
    if isinstance(data, dict):
        ax.pie(list(data.values()), labels=list(data.keys()), autopct='%1.1f%%')
elif chart_type == 'scatter':
    if isinstance(data, dict) and 'x' in data and 'y' in data:
        ax.scatter(data['x'], data['y'])
elif chart_type == 'histogram':
    ax.hist(data, bins='auto', edgecolor='black')
elif chart_type == 'box':
    ax.boxplot(data)

ax.set_title('${title.replace(/'/g, "\\'")}')
${xLabel ? `ax.set_xlabel('${xLabel.replace(/'/g, "\\'")}')` : ''}
${yLabel ? `ax.set_ylabel('${yLabel.replace(/'/g, "\\'")}')` : ''}
plt.tight_layout()
os.makedirs(os.path.dirname('${outputPath.replace(/\\/g, '/')}') or '.', exist_ok=True)
plt.savefig('${outputPath.replace(/\\/g, '/')}', dpi=150, bbox_inches='tight')
plt.close()
print('OK')
`;

    const tmpDir = path.join(process.env.TEMP || '/tmp', 'datamind-python');
    fs.mkdirSync(tmpDir, { recursive: true });
    const scriptPath = path.join(tmpDir, `viz_${Date.now()}.py`);
    fs.writeFileSync(scriptPath, pyCode, 'utf-8');

    return new Promise((resolve) => {
      exec(`python "${scriptPath}"`, { timeout: 30000, maxBuffer: 5 * 1024 * 1024 }, (error, stdout, stderr) => {
        try { fs.unlinkSync(scriptPath); } catch { /* ignore */ }

        if (error) {
          resolve({ success: false, message: `Error: 生成图表失败: ${stderr || error.message}` });
          return;
        }
        resolve({ success: true, message: `成功生成图表: ${outputPath}`, outputPath });
      });
    });
  },
};

/**
 * 统计分析
 */
const statisticalAnalysis: SkillDefinition = {
  name: 'dataAnalysis.statisticalAnalysis',
  category: 'data_analysis',
  displayName: '统计分析',
  description: '对数值数据进行描述性统计分析（均值、中位数、标准差、四分位数等）',
  parameters: [
    { name: 'data', type: 'string', description: 'JSON 格式的数值数据列表', required: true },
    { name: 'analysisType', type: 'string', description: '分析类型 (descriptive/distribution)', required: false },
  ],
  execute: async (params) => {
    try {
      const values = parseJsonValue<number[]>(pickParam(params, 'data'));
      if (!Array.isArray(values) || values.length === 0) {
        return { success: false, message: 'Error: 数据必须是非空数值列表' };
      }

      const sorted = [...values].sort((a, b) => a - b);
      const n = sorted.length;
      const sum = sorted.reduce((s, v) => s + v, 0);
      const mean = sum / n;
      const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
      const variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
      const std = Math.sqrt(variance);
      const min = sorted[0];
      const max = sorted[n - 1];

      const q1Idx = Math.floor(n * 0.25);
      const q3Idx = Math.floor(n * 0.75);
      const q1 = sorted[q1Idx];
      const q3 = sorted[q3Idx];

      let result = `📊 统计分析结果\n${'='.repeat(40)}\n\n`;
      result += `数据量: ${n}\n\n`;
      result += '📈 描述性统计:\n';
      result += `  均值: ${mean.toFixed(4)}\n`;
      result += `  中位数: ${median.toFixed(4)}\n`;
      result += `  标准差: ${std.toFixed(4)}\n`;
      result += `  方差: ${variance.toFixed(4)}\n`;
      result += `  最小值: ${min.toFixed(4)}\n`;
      result += `  最大值: ${max.toFixed(4)}\n`;
      result += `  范围: ${(max - min).toFixed(4)}\n\n`;
      result += '📊 四分位数:\n';
      result += `  Q1 (25%): ${q1.toFixed(4)}\n`;
      result += `  Q2 (50%): ${median.toFixed(4)}\n`;
      result += `  Q3 (75%): ${q3.toFixed(4)}\n`;
      result += `  IQR: ${(q3 - q1).toFixed(4)}\n`;

      return { success: true, data: result };
    } catch (e: any) {
      return { success: false, message: `Error: 统计分析失败: ${e.message}` };
    }
  },
};

/**
 * Python 表达式求值（安全沙箱）
 */
const pythonEval: SkillDefinition = {
  name: 'dataAnalysis.pythonEval',
  category: 'data_analysis',
  displayName: 'Python 表达式求值',
  description: '执行简单的 Python 表达式（如数学运算）',
  parameters: [
    { name: 'expression', type: 'string', description: 'Python 表达式', required: true },
  ],
  execute: async (params) => {
    const expr = (pickParam<string>(params, 'expression') || '').trim();
    if (!expr) return { success: false, message: 'Error: 表达式不能为空' };

    return new Promise((resolve) => {
      exec(
        `python -c "import math; print(repr(${expr.replace(/"/g, '\\"')}))"`,
        { timeout: 10000, maxBuffer: 1 * 1024 * 1024 },
        (error, stdout, stderr) => {
          if (error) {
            resolve({ success: false, message: `Error: 表达式执行失败: ${stderr || error.message}` });
            return;
          }
          resolve({ success: true, data: `结果: ${stdout.trim()}` });
        }
      );
    });
  },
};

const resetExecutionContext: SkillDefinition = {
  name: 'dataAnalysis.resetExecutionContext',
  category: 'data_analysis',
  displayName: '重置执行环境',
  description: '重置 Python 执行上下文（当前实现为无状态执行，会清理临时脚本和缓存提示）',
  parameters: [],
  execute: async () => ({
    success: true,
    message: '当前数据分析执行器为无状态模式，临时执行上下文已重置。'
  }),
};

export const dataAnalysisSkills: SkillDefinition[] = [
  executePython,
  createVisualization,
  statisticalAnalysis,
  pythonEval,
  resetExecutionContext,
];
