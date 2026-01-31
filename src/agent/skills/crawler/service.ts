import { pool } from '../../../admin/core/database';
import { v4 as uuidv4 } from 'uuid';

export interface CrawlerTemplate {
    id: string;
    userId: string;
    name: string;
    url: string;
    department?: string;
    data_type?: string;
    containerSelector?: string;
    fields: { name: string; selector: string }[];
    // 分页配置
    paginationEnabled?: boolean;
    paginationNextSelector?: string;
    paginationMaxPages?: number;
}

export class CrawlerService {
    /**
     * 保存抓取模板
     */
    async saveTemplate(template: Omit<CrawlerTemplate, 'id'>): Promise<string> {
        const id = uuidv4();
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            await connection.execute(
                'INSERT INTO crawler_templates (id, user_id, name, url, department, data_type, container_selector) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [id, template.userId, template.name, template.url, template.department || null, template.data_type || null, template.containerSelector]
            );

            for (const field of template.fields) {
                await connection.execute(
                    'INSERT INTO crawler_template_fields (id, template_id, field_name, field_selector) VALUES (?, ?, ?, ?)',
                    [uuidv4(), id, field.name, field.selector]
                );
            }

            await connection.commit();
            return id;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * 获取单个模板详情
     */
    async getTemplate(id: string): Promise<CrawlerTemplate | null> {
        const [rows] = await pool.execute(
            'SELECT * FROM crawler_templates WHERE id = ?',
            [id]
        );

        const row = (rows as any[])[0];
        if (!row) return null;

        const [fields] = await pool.execute(
            'SELECT field_name as name, field_selector as selector FROM crawler_template_fields WHERE template_id = ?',
            [id]
        );

        return {
            id: row.id,
            userId: row.user_id,
            name: row.name,
            url: row.url,
            department: row.department,
            data_type: row.data_type,
            containerSelector: row.container_selector || '',
            fields: fields as any[],
            paginationEnabled: Boolean(row.pagination_enabled),
            paginationNextSelector: row.pagination_next_selector || undefined,
            paginationMaxPages: row.pagination_max_pages || 1
        };
    }

    /**
     * 获取用户的所有抓取模板
     */
    async getTemplates(userId: string): Promise<CrawlerTemplate[]> {
        const [rows] = await pool.execute(
            'SELECT * FROM crawler_templates WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );

        const templates: CrawlerTemplate[] = [];
        for (const row of rows as any[]) {
            const [fields] = await pool.execute(
                'SELECT field_name as name, field_selector as selector FROM crawler_template_fields WHERE template_id = ?',
                [row.id]
            );
            templates.push({
                id: row.id,
                userId: row.user_id,
                name: row.name,
                url: row.url,
                department: row.department,
                data_type: row.data_type,
                containerSelector: row.container_selector,
                fields: fields as any[],
                paginationEnabled: Boolean(row.pagination_enabled),
                paginationNextSelector: row.pagination_next_selector || undefined,
                paginationMaxPages: row.pagination_max_pages || 1
            });
        }
        return templates;
    }

    /**
     * 获取用户的所有模板
     */
    async getAllTemplates(userId: string): Promise<any[]> {
        const [rows]: any = await pool.query(
            'SELECT * FROM crawler_templates WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );
        return rows;
    }

    /**
     * 获取用户的所有定时任务
     */
    async getAllTasks(userId: string): Promise<any[]> {
        const [rows]: any = await pool.query(
            `SELECT t.*, COALESCE(tmp.name, '未知模板') as template_name
       FROM crawler_tasks t
       LEFT JOIN crawler_templates tmp ON t.template_id = tmp.id
       WHERE t.user_id = ? ORDER BY t.created_at DESC`,
            [userId]
        );
        return rows;
    }

    /**
     * 获取最近的采集结果批次
     */
    async getRecentResults(userId: string, limit: number = 20): Promise<any[]> {
        const [rows]: any = await pool.query(
            `SELECT r.*, 
                    COALESCE(t.name, '未知模板') as template_name,
                    t.department,
                    t.data_type
       FROM crawler_results r
       LEFT JOIN crawler_templates t ON r.template_id = t.id
       WHERE r.user_id = ?
       ORDER BY r.created_at DESC LIMIT ?`,
            [userId, limit]
        );
        return rows;
    }

    /**
     * 获取批次下的具体行数据
     */
    async getResultRows(resultId: string): Promise<any[]> {
        const [rows]: any = await pool.query(
            'SELECT * FROM crawler_result_rows WHERE result_id = ? ORDER BY created_at ASC',
            [resultId]
        );

        const fullRows = [];
        for (const row of rows) {
            const [items]: any = await pool.query(
                'SELECT field_name, field_value FROM crawler_result_items WHERE row_id = ?',
                [row.id]
            );
            const rowData: any = { id: row.id, created_at: row.created_at };
            items.forEach((item: any) => {
                rowData[item.field_name] = item.field_value;
            });
            fullRows.push(rowData);
        }
        return fullRows;
    }

    /**
     * 切换任务状态
     */
    async toggleTaskStatus(taskId: string, status: 'active' | 'paused'): Promise<void> {
        await pool.execute('UPDATE crawler_tasks SET status = ?, updated_at = NOW() WHERE id = ?', [status, taskId]);
    }

    /**
     * 删除单次采集结果（及其关联的行和明细）
     */
    async deleteResult(id: string): Promise<void> {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // 1. 删除明细数据 (EAV Items)
            await connection.execute(
                'DELETE FROM crawler_result_items WHERE row_id IN (SELECT id FROM crawler_result_rows WHERE result_id = ?)',
                [id]
            );

            // 2. 删除行数据
            await connection.execute(
                'DELETE FROM crawler_result_rows WHERE result_id = ?',
                [id]
            );

            // 3. 删除批次记录
            await connection.execute(
                'DELETE FROM crawler_results WHERE id = ?',
                [id]
            );

            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * 删除模板（包括关联的字段、任务和结果）
     */
    async deleteTemplate(id: string): Promise<void> {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // 删除模板关联的结果数据（级联删除）
            await connection.execute('DELETE FROM crawler_result_items WHERE row_id IN (SELECT id FROM crawler_result_rows WHERE result_id IN (SELECT id FROM crawler_results WHERE template_id = ?))', [id]);
            await connection.execute('DELETE FROM crawler_result_rows WHERE result_id IN (SELECT id FROM crawler_results WHERE template_id = ?)', [id]);
            await connection.execute('DELETE FROM crawler_results WHERE template_id = ?', [id]);

            // 删除模板关联的任务
            await connection.execute('DELETE FROM crawler_tasks WHERE template_id = ?', [id]);

            // 删除模板字段
            await connection.execute('DELETE FROM crawler_template_fields WHERE template_id = ?', [id]);

            // 删除模板本身
            await connection.execute('DELETE FROM crawler_templates WHERE id = ?', [id]);

            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * 持久化抓取结果 (EAV 模式)
     */
    async saveResults(userId: string, templateId: string, data: any[], taskId?: string): Promise<string> {
        const resultId = uuidv4();
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // 1. 创建批次记录
            await connection.execute(
                'INSERT INTO crawler_results (id, task_id, template_id, user_id) VALUES (?, ?, ?, ?)',
                [resultId, taskId || null, templateId, userId]
            );

            // 2. 批量插入行和明细
            for (const rowData of data) {
                const rowId = uuidv4();
                await connection.execute(
                    'INSERT INTO crawler_result_rows (id, result_id) VALUES (?, ?)',
                    [rowId, resultId]
                );

                for (const [fieldName, fieldValue] of Object.entries(rowData)) {
                    await connection.execute(
                        'INSERT INTO crawler_result_items (id, row_id, field_name, field_value) VALUES (?, ?, ?, ?)',
                        [uuidv4(), rowId, fieldName, String(fieldValue)]
                    );
                }
            }

            await connection.commit();
            return resultId;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * 生成渲染后的 HTML (带 CSS 样式和标题)
     */
    renderHtml(fields: string[], data: any[], title?: string, subtitle?: string): string {
        const style = `
      <style>
        .crawler-container { font-family: 'Inter', system-ui, sans-serif; padding: 20px; color: #1f2937; line-height: 1.5; }
        .crawler-header { margin-bottom: 20px; }
        .crawler-title { font-size: 24px; font-weight: 700; color: #111827; margin: 0 0 8px 0; }
        .crawler-subtitle { font-size: 14px; color: #6b7280; margin: 0; }
        .crawler-table { width: 100%; border-collapse: collapse; margin-top: 15px; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .crawler-table th { background: #f9fafb; padding: 12px 16px; text-align: left; font-size: 13px; font-weight: 600; color: #4b5563; border-bottom: 1px solid #e5e7eb; }
        .crawler-table td { padding: 12px 16px; font-size: 14px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
        .crawler-table tr:last-child td { border-bottom: none; }
        .crawler-link { color: #2563eb; text-decoration: none; word-break: break-all; }
        .crawler-link:hover { text-decoration: underline; }
        .crawler-text { white-space: pre-wrap; margin: 0; }
        .tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; background: #e0f2fe; color: #0369a1; margin-right: 4px; }
      </style>
    `;

        const headerHtml = `
      <div class="crawler-header">
        ${title ? `<h1 class="crawler-title">${this.escapeHtml(title)}</h1>` : ''}
        ${subtitle ? `<p class="crawler-subtitle">${this.escapeHtml(subtitle)}</p>` : ''}
      </div>
    `;

        const tableHeaders = fields.map(f => `<th>${this.escapeHtml(f)}</th>`).join('');
        const tableRows = data.map(row => {
            const cells = fields.map(f => {
                const val = row[f] || '';
                // 简单的 HTML 安全转换和链接提取 (由于 Python 已经清理好，这里直接嵌入或稍微处理)
                return `<td><div class="crawler-text">${val}</div></td>`;
            }).join('');
            return `<tr>${cells}</tr>`;
        }).join('');

        return `
      <div class="crawler-container">
        ${style}
        ${headerHtml}
        <table class="crawler-table">
          <thead><tr>${tableHeaders}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    `;
    }

    /**
     * HTML 转义工具
     */
    private escapeHtml(text: string): string {
        const map: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
}

export const crawlerService = new CrawlerService();
