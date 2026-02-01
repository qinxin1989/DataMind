/**
 * 示例模块服务层
 */

import { v4 as uuidv4 } from 'uuid';
import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type {
  ExampleItem,
  CreateExampleDto,
  UpdateExampleDto,
  ExampleListQuery,
  ExampleListResponse
} from './types';

export class ExampleService {
  constructor(private db: Pool) {}

  /**
   * 获取示例列表
   */
  async getList(query: ExampleListQuery, userId?: string): Promise<ExampleListResponse> {
    const page = query.page || 1;
    const pageSize = query.pageSize || 10;
    const offset = (page - 1) * pageSize;

    let sql = 'SELECT * FROM example_items WHERE 1=1';
    const params: any[] = [];

    if (query.status) {
      sql += ' AND status = ?';
      params.push(query.status);
    }

    if (query.keyword) {
      sql += ' AND (title LIKE ? OR description LIKE ?)';
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
      items: rows as ExampleItem[],
      total,
      page,
      pageSize
    };
  }

  /**
   * 根据ID获取示例
   */
  async getById(id: string): Promise<ExampleItem | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      'SELECT * FROM example_items WHERE id = ?',
      [id]
    );

    return rows.length > 0 ? (rows[0] as ExampleItem) : null;
  }

  /**
   * 创建示例
   */
  async create(data: CreateExampleDto, userId?: string): Promise<ExampleItem> {
    const id = uuidv4();
    const now = new Date();

    await this.db.query<ResultSetHeader>(
      `INSERT INTO example_items (id, title, description, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.title,
        data.description || null,
        data.status || 'active',
        userId || null,
        now,
        now
      ]
    );

    const item = await this.getById(id);
    if (!item) {
      throw new Error('Failed to create example item');
    }

    return item;
  }

  /**
   * 更新示例
   */
  async update(id: string, data: UpdateExampleDto): Promise<ExampleItem> {
    const updates: string[] = [];
    const params: any[] = [];

    if (data.title !== undefined) {
      updates.push('title = ?');
      params.push(data.title);
    }

    if (data.description !== undefined) {
      updates.push('description = ?');
      params.push(data.description);
    }

    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
    }

    if (updates.length === 0) {
      const item = await this.getById(id);
      if (!item) {
        throw new Error('Example item not found');
      }
      return item;
    }

    updates.push('updated_at = ?');
    params.push(new Date());
    params.push(id);

    const [result] = await this.db.query<ResultSetHeader>(
      `UPDATE example_items SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    if (result.affectedRows === 0) {
      throw new Error('Example item not found');
    }

    const item = await this.getById(id);
    if (!item) {
      throw new Error('Failed to update example item');
    }

    return item;
  }

  /**
   * 删除示例
   */
  async delete(id: string): Promise<void> {
    const [result] = await this.db.query<ResultSetHeader>(
      'DELETE FROM example_items WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      throw new Error('Example item not found');
    }
  }

  /**
   * 批量删除示例
   */
  async batchDelete(ids: string[]): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    const placeholders = ids.map(() => '?').join(',');
    const [result] = await this.db.query<ResultSetHeader>(
      `DELETE FROM example_items WHERE id IN (${placeholders})`,
      ids
    );

    return result.affectedRows;
  }
}
