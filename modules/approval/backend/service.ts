/**
 * 审批申请服务
 * 管理数据源可见性变更等申请记录
 */

import { v4 as uuidv4 } from 'uuid';
import { pool } from '../../../src/admin/core/database';
import type {
  ApprovalRecord,
  ApprovalType,
  ApprovalQueryParams,
  CreateApprovalRequest,
} from './types';

class ApprovalService {
  /** 初始化表 */
  async init(): Promise<void> {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS approval_records (
        id VARCHAR(36) PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        applicant_id VARCHAR(36) NOT NULL,
        applicant_name VARCHAR(100) NOT NULL,
        resource_id VARCHAR(36) NOT NULL,
        resource_name VARCHAR(200) NOT NULL,
        old_value VARCHAR(100),
        new_value VARCHAR(100),
        reason TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        reviewer_id VARCHAR(36),
        reviewer_name VARCHAR(100),
        review_comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMP NULL,
        INDEX idx_type (type),
        INDEX idx_status (status),
        INDEX idx_applicant (applicant_id),
        INDEX idx_resource (resource_id)
      )
    `);
  }

  /** 创建申请 */
  async create(data: CreateApprovalRequest): Promise<ApprovalRecord> {
    const id = uuidv4();
    const now = Date.now();

    await pool.execute(
      `INSERT INTO approval_records 
       (id, type, applicant_id, applicant_name, resource_id, resource_name, old_value, new_value, reason, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', FROM_UNIXTIME(?/1000))`,
      [id, data.type, data.applicantId, data.applicantName, data.resourceId, data.resourceName,
       data.oldValue || null, data.newValue || null, data.reason || null, now]
    );

    return {
      id,
      ...data,
      status: 'pending',
      createdAt: now,
    };
  }

  /** 审批通过 */
  async approve(id: string, reviewerId: string, reviewerName: string, comment?: string): Promise<boolean> {
    const [result] = await pool.execute(
      `UPDATE approval_records SET status='approved', reviewer_id=?, reviewer_name=?, review_comment=?, reviewed_at=NOW()
       WHERE id=? AND status='pending'`,
      [reviewerId, reviewerName, comment || null, id]
    );
    return (result as any).affectedRows > 0;
  }

  /** 审批拒绝 */
  async reject(id: string, reviewerId: string, reviewerName: string, comment?: string): Promise<boolean> {
    const [result] = await pool.execute(
      `UPDATE approval_records SET status='rejected', reviewer_id=?, reviewer_name=?, review_comment=?, reviewed_at=NOW()
       WHERE id=? AND status='pending'`,
      [reviewerId, reviewerName, comment || null, id]
    );
    return (result as any).affectedRows > 0;
  }

  /** 取消申请 */
  async cancel(id: string, applicantId: string): Promise<boolean> {
    const [result] = await pool.execute(
      `UPDATE approval_records SET status='cancelled' WHERE id=? AND applicant_id=? AND status='pending'`,
      [id, applicantId]
    );
    return (result as any).affectedRows > 0;
  }

  /** 查询申请列表 */
  async query(params: ApprovalQueryParams): Promise<{ list: ApprovalRecord[]; total: number }> {
    let where = '1=1';
    const queryParams: any[] = [];

    if (params.type) {
      where += ' AND type=?';
      queryParams.push(params.type);
    }
    if (params.status) {
      where += ' AND status=?';
      queryParams.push(params.status);
    }
    if (params.applicantId) {
      where += ' AND applicant_id=?';
      queryParams.push(params.applicantId);
    }

    const [countRows] = await pool.execute(`SELECT COUNT(*) as total FROM approval_records WHERE ${where}`, queryParams);
    const total = (countRows as any)[0].total;

    const offset = (params.page - 1) * params.pageSize;
    const [rows] = await pool.execute(
      `SELECT * FROM approval_records WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...queryParams, params.pageSize, offset]
    );

    const list = (rows as any[]).map(this.mapRow);
    return { list, total };
  }

  /** 获取单条记录 */
  async getById(id: string): Promise<ApprovalRecord | null> {
    const [rows] = await pool.execute('SELECT * FROM approval_records WHERE id=?', [id]);
    const row = (rows as any[])[0];
    return row ? this.mapRow(row) : null;
  }

  /** 获取待审批数量 */
  async getPendingCount(): Promise<number> {
    const [rows] = await pool.execute(`SELECT COUNT(*) as count FROM approval_records WHERE status='pending'`);
    return (rows as any)[0].count;
  }

  private mapRow(row: any): ApprovalRecord {
    return {
      id: row.id,
      type: row.type,
      applicantId: row.applicant_id,
      applicantName: row.applicant_name,
      resourceId: row.resource_id,
      resourceName: row.resource_name,
      oldValue: row.old_value,
      newValue: row.new_value,
      reason: row.reason,
      status: row.status,
      reviewerId: row.reviewer_id,
      reviewerName: row.reviewer_name,
      reviewComment: row.review_comment,
      createdAt: new Date(row.created_at).getTime(),
      reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).getTime() : undefined,
    };
  }
}

export const approvalService = new ApprovalService();
