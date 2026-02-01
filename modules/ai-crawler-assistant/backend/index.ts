/**
 * AI爬虫助手模块入口
 * 实现8个生命周期钩子
 */

import type { ModuleContext } from '../../../src/module-system/types';
import { crawlerAssistantService } from './service';
import routes from './routes';

export default {
  /**
   * 模块安装前钩子
   */
  async beforeInstall(context: ModuleContext): Promise<void> {
    console.log('[ai-crawler-assistant] beforeInstall: 准备安装AI爬虫助手模块...');
    
    // 检查依赖模块
    const aiConfigModule = context.registry.getModule('ai-config');
    if (!aiConfigModule || !aiConfigModule.enabled) {
      throw new Error('AI爬虫助手模块依赖ai-config模块，请先安装并启用ai-config模块');
    }
  },

  /**
   * 模块安装后钩子
   */
  async afterInstall(context: ModuleContext): Promise<void> {
    console.log('[ai-crawler-assistant] afterInstall: AI爬虫助手模块安装完成');
    
    // 验证数据库表是否存在
    const { pool } = require('../../../src/admin/core/database');
    const tables = ['crawler_templates', 'crawler_template_fields', 'crawler_assistant_conversations', 'crawler_assistant_messages'];
    
    for (const table of tables) {
      const [rows] = await pool.query(`SHOW TABLES LIKE '${table}'`);
      if ((rows as any[]).length === 0) {
        console.warn(`[ai-crawler-assistant] 警告: 数据库表 ${table} 不存在，请运行数据库迁移脚本`);
      }
    }
  },

  /**
   * 模块卸载前钩子
   */
  async beforeUninstall(context: ModuleContext): Promise<void> {
    console.log('[ai-crawler-assistant] beforeUninstall: 准备卸载AI爬虫助手模块...');
    
    // 检查是否有依赖此模块的其他模块
    const modules = context.registry.getAllModules();
    const dependentModules = modules.filter(m => 
      m.manifest.dependencies && 
      'ai-crawler-assistant' in m.manifest.dependencies
    );
    
    if (dependentModules.length > 0) {
      const names = dependentModules.map(m => m.manifest.displayName).join(', ');
      throw new Error(`无法卸载AI爬虫助手模块，以下模块依赖它: ${names}`);
    }
  },

  /**
   * 模块卸载后钩子
   */
  async afterUninstall(context: ModuleContext): Promise<void> {
    console.log('[ai-crawler-assistant] afterUninstall: AI爬虫助手模块已卸载');
    
    // 注意：不删除数据库表和数据，保留用户的模板和对话历史
    console.log('[ai-crawler-assistant] 提示: 模板和对话历史数据已保留，如需清理请手动删除');
  },

  /**
   * 模块启用前钩子
   */
  async beforeEnable(context: ModuleContext): Promise<void> {
    console.log('[ai-crawler-assistant] beforeEnable: 准备启用AI爬虫助手模块...');
    
    // 检查AI配置模块是否启用
    const aiConfigModule = context.registry.getModule('ai-config');
    if (!aiConfigModule || !aiConfigModule.enabled) {
      throw new Error('AI爬虫助手模块依赖ai-config模块，请先启用ai-config模块');
    }
    
    // 检查Python环境
    const path = require('path');
    const fs = require('fs');
    const pythonPath = process.env.PYTHON_PATH || path.join(process.cwd(), '.venv', 'Scripts', 'python');
    const pythonExe = process.platform === 'win32' && !pythonPath.endsWith('.exe') ? pythonPath + '.exe' : pythonPath;
    
    if (!fs.existsSync(pythonExe)) {
      console.warn('[ai-crawler-assistant] 警告: 未找到Python环境，预览功能可能无法使用');
      console.warn(`[ai-crawler-assistant] 请设置环境变量 PYTHON_PATH 或在项目根目录创建 .venv 虚拟环境`);
    }
  },

  /**
   * 模块启用后钩子
   */
  async afterEnable(context: ModuleContext): Promise<void> {
    console.log('[ai-crawler-assistant] afterEnable: AI爬虫助手模块已启用');
    
    // 注册路由
    if (context.app) {
      context.app.use('/api/admin/ai', routes);
      console.log('[ai-crawler-assistant] 路由已注册: /api/admin/ai/crawler/*');
    }
  },

  /**
   * 模块禁用前钩子
   */
  async beforeDisable(context: ModuleContext): Promise<void> {
    console.log('[ai-crawler-assistant] beforeDisable: 准备禁用AI爬虫助手模块...');
    
    // 可以在这里添加清理逻辑，比如关闭正在进行的爬虫任务
  },

  /**
   * 模块禁用后钩子
   */
  async afterDisable(context: ModuleContext): Promise<void> {
    console.log('[ai-crawler-assistant] afterDisable: AI爬虫助手模块已禁用');
    
    // 注意：路由会在模块系统层面自动移除，这里不需要手动处理
  },

  /**
   * 导出服务和路由
   */
  service: crawlerAssistantService,
  routes
};
