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
import { APIDataSource } from './api';
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
    async getList(query: DataSourceListQuery): Promise<DataSourceListResponse> {
        const page = query.page || 1;
        const pageSize = query.pageSize || 10;
        const offset = (page - 1) * pageSize;

        let sql = `SELECT * FROM datasources WHERE (user_id = ? OR (visibility = 'public' AND approval_status = 'approved'))`;
        const params: any[] = [this.userId];

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
                connection = new APIDataSource(ds);
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
     * 审核数据源
     */
    async approve(id: string, approved: boolean, reason?: string): Promise<void> {
        await this.db.query<ResultSetHeader>(
            `UPDATE datasources SET approval_status = ?, approval_reason = ?, updated_at = ? WHERE id = ?`,
            [approved ? 'approved' : 'rejected', reason || null, new Date(), id]
        );
    }
}
