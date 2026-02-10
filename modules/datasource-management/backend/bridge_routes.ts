
import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { DataSourceConfig } from '../../../src/types';
import { dataSourceManager } from './manager';

/**
 * 数据源桥接路由处理器
 */
export function createDataSourceBridgeRoutes(
    configStore: any,
    authMiddleware: any,
    requireAdmin: any,
    log: any,
    aiAgent: any,
    approvalService: any
) {
    const router = Router();

    // 检查权限辅助函数
    function canAccessDataSource(config: DataSourceConfig, userId: string): boolean {
        if (config.userId === userId) return true;
        if (config.visibility === 'public' && config.approvalStatus === 'approved') return true;
        return false;
    }

    // 格式化数据库连接错误信息
    function formatDatabaseError(error: any): string {
        const message = error.message || '未知错误';
        const code = error.code || '';
        if (code === '28P01' || message.includes('password authentication failed')) return '数据库连接失败：用户名或密码错误';
        if (code === '28000' || message.includes('authentication failed')) return '数据库连接失败：认证失败';
        if (code === '3D000' || message.includes('does not exist')) return '数据库连接失败：数据库不存在';
        if (message.includes('ECONNREFUSED')) return '数据库连接失败：无法连接到服务器，请检查主机和端口';
        return `数据库连接失败：${message}`;
    }

    // 基于分析数据生成推荐问题
    function generateQuestionsFromAnalysis(tables: any[]): string[] {
        const questions: string[] = [];
        for (const table of tables) {
            const tableCn = table.tableNameCn || table.tableName;
            questions.push(`${tableCn}共有多少条记录？`);
            const categoryFields = table.columns?.filter((c: any) =>
                c.name.includes('代码') || c.name.includes('类型') || c.nameCn?.includes('类型')
            ) || [];
            for (const field of categoryFields.slice(0, 2)) {
                questions.push(`按${field.nameCn || field.name}统计${tableCn}的分布情况`);
            }
        }
        return questions.sort(() => Math.random() - 0.5).slice(0, 15);
    }

    // 获取数据源列表
    router.get('/', authMiddleware, (req: Request, res: Response) => {
        if (!req.user) return res.status(401).json({ error: '未认证' });

        const list = Array.from(dataSourceManager.entries())
            .filter(([, { config }]) => canAccessDataSource(config, req.user!.id));

        const result = list.map(([id, { config }]) => ({
            id,
            name: config.name,
            type: config.type,
            host: (config.config as any).host || (config.config as any).path,
            port: (config.config as any).port,
            database: (config.config as any).database,
            ownerId: config.userId,
            visibility: config.visibility,
            approvalStatus: config.approvalStatus,
            createdAt: config.createdAt || Date.now(),
        }));

        res.json(result);
    });

    // 获取待审核的数据源列表（管理员）
    router.get('/pending-approvals', authMiddleware, requireAdmin, async (req, res) => {
        try {
            const pendingList = Array.from(dataSourceManager.getAll())
                .filter(({ config }) => config.visibility === 'public' && config.approvalStatus === 'pending')
                .map(({ config }) => ({
                    id: config.id,
                    name: config.name,
                    type: config.type,
                    host: (config.config as any).host || (config.config as any).path,
                    port: (config.config as any).port,
                    database: (config.config as any).database,
                    ownerId: config.userId,
                    visibility: config.visibility,
                    approvalStatus: config.approvalStatus,
                    createdAt: config.createdAt || Date.now(),
                }));

            res.json({ success: true, data: { list: pendingList, total: pendingList.length } });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // 获取数据源详情
    router.get('/:id/detail', authMiddleware, async (req, res) => {
        const ds = dataSourceManager.get(req.params.id);
        if (!ds) return res.status(404).json({ error: '数据源不存在' });
        if (!canAccessDataSource(ds.config, req.user!.id)) return res.status(403).json({ error: '无权访问' });
        res.json({
            id: ds.config.id,
            name: ds.config.name,
            type: ds.config.type,
            config: ds.config.config,
            visibility: ds.config.visibility,
            approvalStatus: ds.config.approvalStatus
        });
    });

    // 添加数据源
    router.post('/', authMiddleware, async (req, res) => {
        try {
            const config: DataSourceConfig = { ...req.body, id: uuidv4(), userId: req.user!.id };
            await dataSourceManager.register(config);
            await configStore.save(config);
            res.json({ id: config.id, message: '数据源添加成功' });
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    });

    // 更新可见性
    router.put('/:id/visibility', authMiddleware, async (req, res) => {
        const ds = dataSourceManager.get(req.params.id);
        if (!ds) return res.status(404).json({ error: '数据源不存在' });
        if (ds.config.userId !== req.user!.id) return res.status(403).json({ error: '无权修改' });

        const { visibility, reason } = req.body;
        try {
            if (visibility === 'public' && ds.config.visibility !== 'public') {
                if (req.user!.role === 'admin') {
                    ds.config.visibility = 'public';
                    ds.config.approvalStatus = 'approved';
                } else {
                    await approvalService.create({
                        type: 'datasource_visibility',
                        applicantId: req.user!.id,
                        applicantName: req.user!.username,
                        resourceId: ds.config.id,
                        resourceName: ds.config.name,
                        newValue: visibility,
                        reason: reason || '申请将数据源设为公共可见',
                    });
                    ds.config.visibility = 'public';
                    ds.config.approvalStatus = 'pending';
                }
            } else {
                ds.config.visibility = visibility;
                ds.config.approvalStatus = undefined;
            }
            await configStore.save(ds.config);
            res.json({ success: true, data: ds.config });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // Schema 分析与 CRUD
    router.get('/:id/schema', authMiddleware, async (req, res) => {
        const ds = dataSourceManager.get(req.params.id);
        if (!ds) return res.status(404).json({ error: '数据源不存在' });
        try {
            const schema = await ds.instance.getSchema();
            res.json(schema);
        } catch (error: any) {
            res.status(500).json({ error: formatDatabaseError(error) });
        }
    });

    router.get('/:id/schema/analyze', authMiddleware, async (req, res) => {
        const ds = dataSourceManager.get(req.params.id);
        if (!ds) return res.status(404).json({ error: '数据源不存在' });
        const forceRefresh = req.query.refresh === 'true';
        try {
            if (!forceRefresh) {
                const cached = await configStore.getSchemaAnalysis(req.params.id, req.user!.id);
                if (cached) return res.json({ ...cached, cached: true });
            }
            const schema = await ds.instance.getSchema();
            const analysis = await aiAgent.analyzeSchema(schema);
            await configStore.saveSchemaAnalysis({
                datasourceId: req.params.id,
                tables: analysis.tables,
                suggestedQuestions: analysis.suggestedQuestions,
                analyzedAt: Date.now(),
                isUserEdited: false
            }, req.user!.id);
            res.json({ ...analysis, cached: false });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/:id/schema/table/:tableName', authMiddleware, async (req, res) => {
        try {
            const success = await configStore.updateTableAnalysis(req.params.id, req.params.tableName, req.body, req.user!.id);
            res.json({ success });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/:id/schema/table/:tableName/column/:columnName', authMiddleware, async (req, res) => {
        try {
            const success = await configStore.updateColumnAnalysis(req.params.id, req.params.tableName, req.params.columnName, req.body, req.user!.id);
            res.json({ success });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/:id/schema/questions/refresh', authMiddleware, async (req, res) => {
        try {
            const cached = await configStore.getSchemaAnalysis(req.params.id, req.user!.id);
            if (!cached) return res.status(404).json({ error: '请先分析' });
            const questions = generateQuestionsFromAnalysis(cached.tables);
            await configStore.updateSuggestedQuestions(req.params.id, questions, req.user!.id);
            res.json({ suggestedQuestions: questions });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // 审核与修复
    router.post('/:id/approve', authMiddleware, requireAdmin, async (req, res) => {
        const ds = dataSourceManager.get(req.params.id);
        if (ds) {
            ds.config.approvalStatus = 'approved';
            await configStore.save(ds.config);
            res.json({ success: true, approvalStatus: 'approved' });
        } else res.status(404).json({ error: '不存在' });
    });

    router.post('/:id/reject', authMiddleware, requireAdmin, async (req, res) => {
        const ds = dataSourceManager.get(req.params.id);
        if (ds) {
            ds.config.approvalStatus = 'rejected';
            await configStore.save(ds.config);
            res.json({ success: true, approvalStatus: 'rejected' });
        } else res.status(404).json({ error: '不存在' });
    });

    // 删除
    router.delete('/:id', authMiddleware, async (req, res) => {
        const ds = dataSourceManager.get(req.params.id);
        if (ds && ds.config.userId === req.user!.id) {
            await dataSourceManager.remove(req.params.id);
            await configStore.delete(req.params.id);
            res.json({ message: '已删除' });
        } else res.status(403).json({ error: '无权' });
    });

    // 测试连接
    router.post('/test', authMiddleware, async (req, res) => {
        try {
            const config: DataSourceConfig = { ...req.body, id: 'test', userId: req.user!.id };
            const instance = await dataSourceManager.register(config);
            await instance.testConnection();
            await dataSourceManager.remove('test'); // 临时测试连接后移除
            res.json({ success: true });
        } catch (error: any) {
            res.json({ success: false, error: error.message });
        }
    });

    router.get('/:id/test', authMiddleware, async (req, res) => {
        const ds = dataSourceManager.get(req.params.id);
        if (!ds) return res.status(404).json({ error: '数据源不存在' });
        try {
            await ds.instance.testConnection();
            res.json({ success: true });
        } catch (error: any) {
            res.json({ success: false, error: error.message });
        }
    });

    // 更新数据源
    router.put('/:id', authMiddleware, async (req, res) => {
        const ds = dataSourceManager.get(req.params.id);
        if (!ds) return res.status(404).json({ error: '数据源不存在' });
        if (ds.config.userId !== req.user!.id) return res.status(403).json({ error: '无权修改' });

        try {
            const newConfig = { ...req.body, id: req.params.id, userId: req.user!.id };
            await dataSourceManager.register(newConfig);
            await configStore.save(newConfig);
            res.json({ message: '更新成功' });
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    });

    return router;
}
