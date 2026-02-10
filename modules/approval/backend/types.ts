/**
 * 审批模块类型定义
 */

export type ApprovalType = 'datasource_visibility' | 'datasource_delete' | 'user_permission';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface ApprovalRecord {
  id: string;
  type: ApprovalType;
  applicantId: string;
  applicantName: string;
  resourceId: string;
  resourceName: string;
  oldValue?: string;
  newValue?: string;
  reason?: string;
  status: ApprovalStatus;
  reviewerId?: string;
  reviewerName?: string;
  reviewComment?: string;
  createdAt: number;
  reviewedAt?: number;
}

export interface ApprovalQueryParams {
  type?: ApprovalType;
  status?: ApprovalStatus;
  applicantId?: string;
  page: number;
  pageSize: number;
}

export interface CreateApprovalRequest {
  type: ApprovalType;
  applicantId: string;
  applicantName: string;
  resourceId: string;
  resourceName: string;
  oldValue?: string;
  newValue?: string;
  reason?: string;
}
