/**
 * 系统备份模块类型定义
 */

/**
 * 备份状态
 */
export type BackupStatus = 'pending' | 'completed' | 'failed';

/**
 * 备份信息
 */
export interface SystemBackup {
  id: string;
  name: string;
  description?: string;
  backupSize: number;
  fileCount: number;
  backupPath: string;
  status: BackupStatus;
  createdBy: string;
  createdAt: number;
  completedAt?: number;
  errorMessage?: string;
}

/**
 * 创建备份请求
 */
export interface CreateBackupRequest {
  name: string;
  description?: string;
  createdBy: string;
}

/**
 * 备份查询参数
 */
export interface BackupQueryParams {
  status?: BackupStatus;
  createdBy?: string;
  startDate?: number;
  endDate?: number;
  page?: number;
  pageSize?: number;
}

/**
 * 备份查询结果
 */
export interface BackupQueryResult {
  total: number;
  page: number;
  pageSize: number;
  items: SystemBackup[];
}

/**
 * 恢复结果
 */
export interface RestoreResult {
  success: boolean;
  restored: string[];
  skipped: string[];
  message: string;
}

/**
 * 验证结果
 */
export interface VerifyResult {
  valid: boolean;
  errors: string[];
  message: string;
}

/**
 * 模块配置
 */
export interface SystemBackupModuleConfig {
  backupDir: string;
  maxBackups: number;
  autoCleanup: boolean;
  retentionDays: number;
}
