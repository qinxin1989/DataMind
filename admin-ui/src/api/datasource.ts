import { get, post, put, del } from './request'
import type { Datasource, DatasourceVisibility } from '@/types'

export interface DatasourceStats {
  totalQueries: number
  avgResponseTime: number
  errorRate: number
  queriesByDay: { date: string; count: number }[]
}

export const datasourceApi = {
  // 获取数据源列表 - 使用原有 API
  getList: async (params?: { group?: string; status?: string; visibility?: DatasourceVisibility; approvalStatus?: string }) => {
    const res = await get<any>('/datasource', { params })
    // 原 API 直接返回数组
    if (Array.isArray(res)) {
      return { success: true, data: res }
    }
    return res
  },

  // 获取数据源详情
  getById: (id: string) =>
    get<Datasource>(`/datasource/${id}/detail`),

  // 创建数据源
  create: (data: Partial<Datasource> & { password?: string; visibility?: DatasourceVisibility }) => {
    // 转换类型名称：前端使用 postgresql，后端使用 postgres
    let dbType = data.type
    if (dbType === 'postgresql') {
      dbType = 'postgres'
    }
    
    // 转换为原 API 格式
    const config = {
      name: data.name,
      type: dbType,
      visibility: data.visibility || 'private',
      config: {
        host: data.host,
        port: data.port,
        database: data.database,
        user: data.username,
        password: data.password,
      }
    }
    return post<any>('/datasource', config)
  },

  // 创建文件类型数据源（带文件上传）
  createWithFile: (formData: FormData) => {
    return post<any>('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },

  // 更新数据源
  update: (id: string, data: Partial<Datasource> & { password?: string }) => {
    // 转换类型名称：前端使用 postgresql，后端使用 postgres
    let dbType = data.type
    if (dbType === 'postgresql') {
      dbType = 'postgres'
    }
    
    const config = {
      name: data.name,
      type: dbType,
      config: {
        host: data.host,
        port: data.port,
        database: data.database,
        user: data.username,
        password: data.password,
      }
    }
    return put<any>(`/datasource/${id}`, config)
  },

  // 删除数据源
  delete: (id: string) =>
    del(`/datasource/${id}`),

  // 测试连接
  testConnection: async (id: string) => {
    const res = await get<any>(`/datasource/${id}/test`)
    return { success: true, data: res }
  },

  // 获取使用统计 - 模拟数据
  getStats: async (_id: string) => {
    return {
      success: true,
      data: {
        totalQueries: Math.floor(Math.random() * 1000),
        avgResponseTime: Math.floor(Math.random() * 200),
        errorRate: Math.random() * 0.05,
        queriesByDay: []
      }
    }
  },

  // 获取分组列表 - 模拟数据
  getGroups: async () => {
    return { success: true, data: ['默认分组'] }
  },

  // ==================== 可见性和审核相关 API ====================

  // 更新数据源可见性
  updateVisibility: (id: string, visibility: DatasourceVisibility) =>
    put<Datasource>(`/datasource/${id}/visibility`, { visibility }),

  // 获取待审核列表（管理员）
  getPendingApprovals: (params?: { page?: number; pageSize?: number }) =>
    get<{ list: Datasource[]; total: number; page: number; pageSize: number }>('/datasource/pending-approvals', { params }),

  // 审核通过（管理员）
  approve: (id: string, comment?: string) =>
    post<Datasource>(`/datasource/${id}/approve`, { comment }),

  // 审核拒绝（管理员）
  reject: (id: string, comment: string) =>
    post<Datasource>(`/datasource/${id}/reject`, { comment }),
}
