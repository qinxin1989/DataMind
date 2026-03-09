/**
 * 模板优化器后端路由
 * 提供前端可调用的API，用于运行模板测试和优化任务
 */

import { Router } from 'express';
import { AuthService } from '../../../src/services/authService';
import { createAuthMiddleware } from '../../../src/middleware/auth';
import { pool } from '../../../src/admin/core/database';
import { TemplateOptimizerService } from './service';

const router = Router();
const service = new TemplateOptimizerService();

// 创建认证服务实例
const authService = new AuthService({
  pool,
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d'
});

// 认证中间件
const authMiddleware = createAuthMiddleware(authService);

/**
 * GET /api/template-optimizer/datasources
 * 获取数据源列表（直接查询 datasource_config 表）
 */
router.get('/datasources', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, type FROM datasource_config ORDER BY created_at DESC');
    res.json({
      success: true,
      data: rows
    });
  } catch (error: any) {
    console.error('[TemplateOptimizer] 获取数据源列表失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '获取数据源列表失败'
    });
  }
});

/**
 * POST /api/template-optimizer/test
 * 运行模板测试
 * Body: { datasourceId: string, options?: TestOptions }
 */
router.post('/test', authMiddleware, async (req, res) => {
  try {
    const { datasourceId, options = {} } = req.body;

    if (!datasourceId) {
      return res.status(400).json({
        success: false,
        error: '缺少数据源ID'
      });
    }

    console.log(`[TemplateOptimizer] 开始测试数据源: ${datasourceId}`);
    const result = await service.runTest(datasourceId, options);

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('[TemplateOptimizer] 测试失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '测试运行失败'
    });
  }
});

/**
 * POST /api/template-optimizer/optimize
 * 运行AI自动优化
 * Body: { datasourceId: string, targetAccuracy?: number, maxIterations?: number }
 */
router.post('/optimize', authMiddleware, async (req, res) => {
  try {
    const {
      datasourceId,
      targetAccuracy = 0.85,
      maxIterations = 3
    } = req.body;

    if (!datasourceId) {
      return res.status(400).json({
        success: false,
        error: '缺少数据源ID'
      });
    }

    console.log(`[TemplateOptimizer] 开始优化数据源: ${datasourceId}, 目标: ${targetAccuracy}`);
    const result = await service.runOptimization(datasourceId, {
      targetAccuracy,
      maxIterations
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('[TemplateOptimizer] 优化失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '优化运行失败'
    });
  }
});

/**
 * GET /api/template-optimizer/reports
 * 获取所有测试报告列表
 */
router.get('/reports', authMiddleware, async (req, res) => {
  try {
    const reports = await service.getReports();
    res.json({
      success: true,
      data: reports
    });
  } catch (error: any) {
    console.error('[TemplateOptimizer] 获取报告失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/template-optimizer/reports/:reportId
 * 获取单个报告详情
 */
router.get('/reports/:reportId', authMiddleware, async (req, res) => {
  try {
    const { reportId } = req.params;
    const report = await service.getReport(reportId);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: '报告不存在'
      });
    }

    res.json({
      success: true,
      data: report
    });
  } catch (error: any) {
    console.error('[TemplateOptimizer] 获取报告详情失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/template-optimizer/status
 * 获取优化任务状态
 */
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const status = await service.getStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error: any) {
    console.error('[TemplateOptimizer] 获取状态失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/template-optimizer/quick-test
 * 快速测试单个问题
 * Body: { datasourceId: string, question: string }
 */
router.post('/quick-test', authMiddleware, async (req, res) => {
  try {
    const { datasourceId, question } = req.body;

    if (!datasourceId || !question) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
    }

    const result = await service.quickTest(datasourceId, question);
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('[TemplateOptimizer] 快速测试失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
