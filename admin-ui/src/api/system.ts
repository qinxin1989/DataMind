import { get, post, put, del } from './request'
import type { SystemConfig, AuditLog, PaginatedResponse } from '@/types'

export interface SystemStatus {
  cpu: { usage: number; cores: number }
  memory: { total: number; used: number; free: number }
  disk: { total: number; used: number; free: number }
  uptime: number
  nodeVersion: string
  platform: string
}

export interface DbConfig {
  host: string
  port: number
  user: string
  password: string
  database: string
}

export const systemApi = {
  // 获取系统配置
  getConfigs: (group?: string) =>
    get<SystemConfig[]>('/admin/system/configs', { params: { group } }),

  // 更新系统配置
  updateConfig: (key: string, value: string) =>
    put<SystemConfig>(`/admin/system/configs/${key}`, { value }),

  // 获取系统状态
  getStatus: () =>
    get<SystemStatus>('/admin/system/status'),

  // 获取数据库配置
  getDbConfig: () =>
    get<DbConfig>('/admin/system/db-config'),

  // 更新数据库配置
  updateDbConfig: (config: Partial<DbConfig>) =>
    put<DbConfig & { message?: string }>('/admin/system/db-config', config),

  // 测试数据库连接
  testDbConnection: (config: Partial<DbConfig>) =>
    post<{ success: boolean; message: string }>('/admin/system/db-config/test', config),

  // 查询审计日志
  getAuditLogs: (params: {
    page?: number
    pageSize?: number
    userId?: string
    action?: string
    startTime?: number
    endTime?: number
  }) =>
    get<PaginatedResponse<AuditLog>>('/admin/audit/logs', { params }),

  // 导出审计日志
  exportAuditLogs: (params: { format: 'csv' | 'json'; startTime?: number; endTime?: number }) =>
    get<string>('/admin/audit/export', { params }),

  // 创建备份
  createBackup: (data?: { name: string; description?: string }) =>
    post<{ id: string; name: string }>('/admin/system/backups', data || { name: `Backup-${new Date().toISOString()}` }),

  // 获取备份列表
  getBackups: () =>
    get<{ items: any[]; total: number }>('/admin/system/backups'),

  // 恢复备份
  restoreBackup: (id: string) =>
    post<{ success: boolean }>(`/admin/system/backups/${id}/restore`),

  // 下载备份
  downloadBackup: (id: string) =>
    get<Blob>(`/admin/system/backups/${id}/download`, { responseType: 'blob' }),

  // 删除备份
  deleteBackup: (id: string) =>
    del<void>(`/admin/system/backups/${id}`),
}
