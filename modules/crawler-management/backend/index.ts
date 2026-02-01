/**
 * 爬虫管理模块入口
 */

import { ModuleContext, ModuleHooks } from '../../../src/module-system/types';
import routes from './routes';
import { pool } from '../../../src/admin/core/database';

const hooks: ModuleHooks = {
  /**
   * 安装前钩子
   */
  async beforeInstall(context: ModuleContext): Promise<void> {
    console.log('[crawler-management] 检查安装前提条件...');
    
    // 检查数据库表是否存在
    const connection = await pool.getConnection();
    try {
      const tables = [
        'crawler_templates',
        'crawler_template_fields',
        'crawler_tasks',
        'crawler_results',
        'crawler_result_rows',
        'crawler_result_items'
      ];
      
      for (const table of tables) {
        const [rows] = await connection.execute(
          `SELECT COUNT(*) as count FROM information_schema.tables 
           WHERE table_schema = DATABASE() AND table_name = ?`,
          [table]
        );
        
        if ((rows as any[])[0].count === 0) {
          throw new Error(`数据库表 ${table} 不存在，请先运行数据库迁移脚本`);
        }
      }
      
      console.log('[crawler-management] 数据库表检查通过');
    } finally {
      connection.release();
    }
  },

  /**
   * 安装后钩子
   */
  async afterInstall(context: ModuleContext): Promise<void> {
    console.log('[crawler-management] 模块安装完成');
    console.log('[crawler-management] 爬虫管理功能已就绪');
  },

  /**
   * 卸载前钩子
   */
  async beforeUninstall(context: ModuleContext): Promise<void> {
    console.log('[crawler-management] 检查模块依赖...');
    
    // 检查是否有其他模块依赖此模块
    // 目前没有其他模块依赖爬虫管理模块
    
    console.log('[crawler-management] 准备卸载模块');
  },

  /**
   * 卸载后钩子
   */
  async afterUninstall(context: ModuleContext): Promise<void> {
    console.log('[crawler-management] 模块已卸载');
    console.log('[crawler-management] 注意：用户数据（模板、任务、结果）已保留');
  },

  /**
   * 启用前钩子
   */
  async beforeEnable(context: ModuleContext): Promise<void> {
    console.log('[crawler-management] 检查启用条件...');
    
    // 检查Python环境（爬虫引擎需要）
    const pythonPath = process.env.PYTHON_PATH;
    if (!pythonPath) {
      console.warn('[crawler-management] 警告：未配置PYTHON_PATH环境变量，爬虫功能可能无法正常工作');
    }
    
    console.log('[crawler-management] 准备启用模块');
  },

  /**
   * 启用后钩子
   */
  async afterEnable(context: ModuleContext): Promise<void> {
    console.log('[crawler-management] 注册路由...');
    
    // 注册路由
    if (context.app) {
      context.app.use('/api', routes);
      console.log('[crawler-management] 路由已注册:');
      console.log('  - GET    /api/skills/crawler/templates');
      console.log('  - POST   /api/skills/crawler/templates');
      console.log('  - DELETE /api/skills/crawler/templates/:id');
      console.log('  - GET    /api/skills/crawler/tasks');
      console.log('  - POST   /api/skills/crawler/tasks/:id/toggle');
      console.log('  - GET    /api/skills/crawler/results');
      console.log('  - GET    /api/skills/crawler/results/:id');
      console.log('  - DELETE /api/skills/crawler/results/:id');
      console.log('  - POST   /api/skills/execute');
    }
    
    console.log('[crawler-management] 模块已启用');
  },

  /**
   * 禁用前钩子
   */
  async beforeDisable(context: ModuleContext): Promise<void> {
    console.log('[crawler-management] 准备禁用模块...');
    
    // 检查是否有正在运行的任务
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        "SELECT COUNT(*) as count FROM crawler_tasks WHERE status = 'active'"
      );
      
      const activeCount = (rows as any[])[0].count;
      if (activeCount > 0) {
        console.warn(`[crawler-management] 警告：有 ${activeCount} 个活动任务，禁用模块后这些任务将停止执行`);
      }
    } finally {
      connection.release();
    }
  },

  /**
   * 禁用后钩子
   */
  async afterDisable(context: ModuleContext): Promise<void> {
    console.log('[crawler-management] 模块已禁用');
    console.log('[crawler-management] 路由已自动移除');
  }
};

export default hooks;
