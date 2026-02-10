/**
 * 数据源管理服务层
 */

import { v4 as uuidv4 } from 'uuid';
import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type {
    DataSourceConfig,
    CreateDataSourceDto,
    UpdateDataSourceDto,
    DataSourceListQuery,
    DataSourceListResponse,
    ConnectionTestResult,
    TableSchema,
    QueryResult
} from './types';

// 导入数据源适配器
import { MySQLDataSource } from './mysql';
import { PostgresDataSource } from './postgres';
import { FileDataSource } from './file';
import { ApiDataSource } from './api';
import { BaseDataSource } from './base';

export class DataSourceService {
    private db: Pool;
    private userId: string;
    private connections = new Map<string, BaseDataSource>();

    constructor(db: Pool, userId: string = 'system') {
        this.db = db;
        this.userId = userId;
    }

    /**
     * 获取数据源列表
     */
    async getList(query: DataSourceListQuery & { isAdmin?: boolean }): Promise<DataSourceListResponse> {
        const page = query.page || 1;
        const pageSize = query.pageSize || 10;
        const offset = (page - 1) * pageSize;

        let sql: string;
        const params: any[] = [];

        if (query.isAdmin) {
            sql = `SELECT * FROM datasources WHERE 1=1`;
        } else {
            sql = `SELECT * FROM datasources WHERE (user_id = ? OR (visibility = 'public' AND approval_status = 'approved'))`;
            params.push(this.userId);
        }

        if (query.type) {
            sql += ' AND type = ?';
            params.push(query.type);
        }

        if (query.keyword) {
            sql += ' AND (name LIKE ? OR description LIKE ?)';
            const keyword = `%${query.keyword}%`;
            params.push(keyword, keyword);
        }

        // 获取总数
        const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
        const [countRows] = await this.db.query<RowDataPacket[]>(countSql, params);
        const total = countRows[0].total;

        // 获取列表
        sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(pageSize, offset);
        const [rows] = await this.db.query<RowDataPacket[]>(sql, params);

        return {
            items: rows as DataSourceConfig[],
            total,
            page,
            pageSize
        };
    }

    /**
     * 根据 ID 获取数据源
     */
    async getById(id: string): Promise<DataSourceConfig | null> {
        const [rows] = await this.db.query<RowDataPacket[]>(
            'SELECT * FROM datasources WHERE id = ?',
            [id]
        );
        return rows.length > 0 ? (rows[0] as DataSourceConfig) : null;
    }

    /**
     * 创建数据源
     */
    async create(data: CreateDataSourceDto): Promise<DataSourceConfig> {
        const id = uuidv4();
        const now = new Date();

        await this.db.query<ResultSetHeader>(
            `INSERT INTO datasources 
       (id, name, type, host, port, database_name, username, password, api_url, api_key, file_path, description, user_id, visibility, approval_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                data.name,
                data.type,
                data.host || null,
                data.port || null,
                data.database || null,
                data.username || null,
                data.password || null,
                data.apiUrl || null,
                data.apiKey || null,
                data.filePath || null,
                data.description || null,
                this.userId,
                data.visibility || 'private',
                'pending',
                now,
                now
            ]
        );

        const ds = await this.getById(id);
        if (!ds) {
            throw new Error('创建数据源失败');
        }

        return ds;
    }

    /**
     * 更新数据源
     */
    async update(id: string, data: UpdateDataSourceDto): Promise<DataSourceConfig> {
        const updates: string[] = [];
        const params: any[] = [];

        if (data.name !== undefined) {
            updates.push('name = ?');
            params.push(data.name);
        }
        if (data.host !== undefined) {
            updates.push('host = ?');
            params.push(data.host);
        }
        if (data.port !== undefined) {
            updates.push('port = ?');
            params.push(data.port);
        }
        if (data.username !== undefined) {
            updates.push('username = ?');
            params.push(data.username);
        }
        if (data.password !== undefined) {
            updates.push('password = ?');
            params.push(data.password);
        }
        if (data.description !== undefined) {
            updates.push('description = ?');
            params.push(data.description);
        }
        if (data.visibility !== undefined) {
            updates.push('visibility = ?');
            params.push(data.visibility);
        }

        if (updates.length === 0) {
            const ds = await this.getById(id);
            if (!ds) throw new Error('数据源不存在');
            return ds;
        }

        updates.push('updated_at = ?');
        params.push(new Date());
        params.push(id);
        params.push(this.userId);

        const [result] = await this.db.query<ResultSetHeader>(
            `UPDATE datasources SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
            params
        );

        if (result.affectedRows === 0) {
            throw new Error('数据源不存在或无权限');
        }

        const ds = await this.getById(id);
        if (!ds) throw new Error('更新失败');
        return ds;
    }

    /**
     * 删除数据源
     */
    async delete(id: string): Promise<void> {
        const [result] = await this.db.query<ResultSetHeader>(
            'DELETE FROM datasources WHERE id = ? AND user_id = ?',
            [id, this.userId]
        );

        if (result.affectedRows === 0) {
            throw new Error('数据源不存在或无权限');
        }

        // 清理连接缓存
        this.connections.delete(id);
    }

    /**
     * 测试连接
     */
    async testConnection(id: string): Promise<ConnectionTestResult> {
        const ds = await this.getById(id);
        if (!ds) {
            return { success: false, message: '数据源不存在' };
        }

        try {
            const startTime = Date.now();
            const connection = await this.getConnection(ds);
            await connection.testConnection();
            const latency = Date.now() - startTime;

            return {
                success: true,
                message: '连接成功',
                latency
            };
        } catch (error: any) {
            return {
                success: false,
                message: `连接失败: ${error.message}`
            };
        }
    }

    /**
     * 获取数据源连接
     */
    async getConnection(ds: DataSourceConfig): Promise<BaseDataSource> {
        // 检查缓存
        let connection = this.connections.get(ds.id);
        if (connection) {
            return connection;
        }

        // 创建新连接
        switch (ds.type) {
            case 'mysql':
                connection = new MySQLDataSource(ds);
                break;
            case 'postgres':
                connection = new PostgresDataSource(ds);
                break;
            case 'file':
            case 'excel':
            case 'csv':
                connection = new FileDataSource(ds);
                break;
            case 'api':
                connection = new ApiDataSource(ds);
                break;
            default:
                throw new Error(`不支持的数据源类型: ${ds.type}`);
        }

        await connection.connect();
        this.connections.set(ds.id, connection);
        return connection;
    }

    /**
     * 获取表结构
     */
    async getSchemas(id: string): Promise<TableSchema[]> {
        const ds = await this.getById(id);
        if (!ds) throw new Error('数据源不存在');

        const connection = await this.getConnection(ds);
        return connection.getSchemas();
    }

    /**
     * 执行查询
     */
    async executeQuery(id: string, sql: string): Promise<QueryResult> {
        const ds = await this.getById(id);
        if (!ds) throw new Error('数据源不存在');

        const connection = await this.getConnection(ds);
        const startTime = Date.now();
        const result = await connection.query(sql);
        const executionTime = Date.now() - startTime;

        return {
            columns: result.columns || [],
            rows: result.rows || [],
            rowCount: result.rows?.length || 0,
            executionTime
        };
    }

    /**
     * 审核数据源（简单版，向后兼容）
     */
    async approve(id: string, approved: boolean, reason?: string): Promise<void> {
        await this.db.query<ResultSetHeader>(
            `UPDATE datasources SET approval_status = ?, approval_reason = ?, updated_at = ? WHERE id = ?`,
            [approved ? 'approved' : 'rejected', reason || null, new Date(), id]
        );
    }

    /**
     * 审核数据源（完整版，记录审核人）
     */
    async approveDatasource(id: string, approved: boolean, adminId: string, comment?: string): Promise<DataSourceConfig> {
        const ds = await this.getById(id);
        if (!ds) throw new Error('数据源不存在');
        if ((ds as any).visibility !== 'public') throw new Error('只有公共数据源需要审核');
        if ((ds as any).approval_status !== 'pending' && (ds as any).approvalStatus !== 'pending') {
            throw new Error('该数据源不在待审核状态');
        }

        await this.db.query<ResultSetHeader>(
            `UPDATE datasources SET approval_status = ?, approval_reason = ?, updated_at = ? WHERE id = ?`,
            [approved ? 'approved' : 'rejected', comment || null, new Date(), id]
        );

        const updated = await this.getById(id);
        if (!updated) throw new Error('审核失败');
        return updated;
    }

    /**
     * 获取待审核的数据源列表
     */
    async getPendingApprovals(page: number = 1, pageSize: number = 20): Promise<DataSourceListResponse> {
        const offset = (page - 1) * pageSize;

        const countSql = `SELECT COUNT(*) as total FROM datasources WHERE visibility = 'public' AND approval_status = 'pending'`;
        const [countRows] = await this.db.query<RowDataPacket[]>(countSql);
        const total = countRows[0].total;

        const [rows] = await this.db.query<RowDataPacket[]>(
            `SELECT * FROM datasources WHERE visibility = 'public' AND approval_status = 'pending' ORDER BY created_at ASC LIMIT ? OFFSET ?`,
            [pageSize, offset]
        );

        return { items: rows as DataSourceConfig[], total, page, pageSize };
    }

    /**
     * 更新数据源可见性
     */
    async updateVisibility(id: string, visibility: string, currentUserId: string): Promise<DataSourceConfig> {
        const ds = await this.getById(id);
        if (!ds) throw new Error('数据源不存在');

        // 只有所有者可以修改可见性
        if ((ds as any).user_id !== currentUserId && (ds as any).userId !== currentUserId) {
            throw new Error('只有数据源所有者可以修改可见性');
        }

        const approvalStatus = visibility === 'public' ? 'pending' : null;
        await this.db.query<ResultSetHeader>(
            `UPDATE datasources SET visibility = ?, approval_status = ?, approval_reason = NULL, updated_at = ? WHERE id = ?`,
            [visibility, approvalStatus, new Date(), id]
        );

        const updated = await this.getById(id);
        if (!updated) throw new Error('更新失败');
        return updated;
    }

    /**
     * 测试配置（不保存）
     */
    async testConnectionConfig(config: Partial<CreateDataSourceDto>): Promise<{ success: boolean; message: string }> {
        if (!config.host && !config.apiUrl && !config.filePath) {
            return { success: false, message: '缺少连接配置' };
        }
        if (config.host && (!config.port || config.port <= 0)) {
            return { success: false, message: '端口号无效' };
        }

        try {
            const tempDs = {
                id: 'temp-test',
                type: config.type || 'mysql',
                host: config.host,
                port: config.port,
                database: config.database,
                username: config.username,
                password: config.password,
                apiUrl: config.apiUrl,
                apiKey: config.apiKey,
                filePath: config.filePath,
            } as DataSourceConfig;

            const connection = await this.getConnection(tempDs);
            await connection.testConnection();
            this.connections.delete('temp-test');
            return { success: true, message: '配置验证通过' };
        } catch (error: any) {
            return { success: false, message: `连接失败: ${error.message}` };
        }
    }

    /**
     * 获取单个数据源统计
     */
    async getStats(id: string): Promise<Record<string, any> | null> {
        const ds = await this.getById(id);
        if (!ds) return null;

        try {
            const [rows] = await this.db.query<RowDataPacket[]>(
                `SELECT * FROM datasource_stats WHERE datasource_id = ?`,
                [id]
            );
            return rows.length > 0 ? rows[0] : { datasourceId: id, totalQueries: 0, successQueries: 0, failedQueries: 0, avgResponseTime: 0 };
        } catch {
            // stats 表可能不存在，返回默认值
            return { datasourceId: id, totalQueries: 0, successQueries: 0, failedQueries: 0, avgResponseTime: 0 };
        }
    }

    /**
     * 获取所有数据源统计
     */
    async getAllStats(): Promise<Record<string, any>[]> {
        try {
            const [rows] = await this.db.query<RowDataPacket[]>(
                `SELECT * FROM datasource_stats`
            );
            return rows;
        } catch {
            // stats 表可能不存在
            return [];
        }
    }

    /**
     * 获取分组列表
     */
    async getGroups(): Promise<string[]> {
        try {
            const [rows] = await this.db.query<RowDataPacket[]>(
                `SELECT DISTINCT group_name FROM datasources WHERE group_name IS NOT NULL AND group_name != ''`
            );
            return rows.map(r => r.group_name);
        } catch {
            // group_name 列可能不存在
            return [];
        }
    }

    /**
     * 获取标签列表
     */
    async getTags(): Promise<string[]> {
        try {
            const [rows] = await this.db.query<RowDataPacket[]>(
                `SELECT DISTINCT tags FROM datasources WHERE tags IS NOT NULL AND tags != '[]'`
            );
            const tagSet = new Set<string>();
            for (const row of rows) {
                try {
                    const parsed = typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags;
                    if (Array.isArray(parsed)) parsed.forEach((t: string) => tagSet.add(t));
                } catch { /* skip invalid */ }
            }
            return Array.from(tagSet);
        } catch {
            // tags 列可能不存在
            return [];
        }
    }

    /**
     * 设置分组
     */
    async setGroup(id: string, group: string | undefined): Promise<DataSourceConfig> {
        const ds = await this.getById(id);
        if (!ds) throw new Error('数据源不存在');

        await this.db.query<ResultSetHeader>(
            `UPDATE datasources SET group_name = ?, updated_at = ? WHERE id = ?`,
            [group || null, new Date(), id]
        );

        const updated = await this.getById(id);
        if (!updated) throw new Error('更新失败');
        return updated;
    }

    /**
     * 添加标签
     */
    async addTag(id: string, tag: string): Promise<DataSourceConfig> {
        const ds = await this.getById(id);
        if (!ds) throw new Error('数据源不存在');

        let currentTags: string[] = [];
        try {
            const raw = (ds as any).tags;
            currentTags = typeof raw === 'string' ? JSON.parse(raw) : (raw || []);
        } catch { /* empty */ }

        if (!currentTags.includes(tag)) {
            currentTags.push(tag);
            await this.db.query<ResultSetHeader>(
                `UPDATE datasources SET tags = ?, updated_at = ? WHERE id = ?`,
                [JSON.stringify(currentTags), new Date(), id]
            );
        }

        const updated = await this.getById(id);
        if (!updated) throw new Error('更新失败');
        return updated;
    }

    /**
     * 删除标签
     */
    async removeTag(id: string, tag: string): Promise<DataSourceConfig> {
        const ds = await this.getById(id);
        if (!ds) throw new Error('数据源不存在');

        let currentTags: string[] = [];
        try {
            const raw = (ds as any).tags;
            currentTags = typeof raw === 'string' ? JSON.parse(raw) : (raw || []);
        } catch { /* empty */ }

        const idx = currentTags.indexOf(tag);
        if (idx !== -1) {
            currentTags.splice(idx, 1);
            await this.db.query<ResultSetHeader>(
                `UPDATE datasources SET tags = ?, updated_at = ? WHERE id = ?`,
                [JSON.stringify(currentTags), new Date(), id]
            );
        }

        const updated = await this.getById(id);
        if (!updated) throw new Error('更新失败');
        return updated;
    }
}
