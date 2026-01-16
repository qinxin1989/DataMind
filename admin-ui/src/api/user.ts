import { get, post, put, del } from './request'
import type { User, PaginatedResponse } from '@/types'

export interface UserQueryParams {
  keyword?: string
  status?: string
  role?: string
  page?: number
  pageSize?: number
}

export const userApi = {
  // 获取用户列表
  getList: (params: UserQueryParams) =>
    get<PaginatedResponse<User>>('/admin/users', { params }),

  // 获取用户详情
  getById: (id: string) =>
    get<User>(`/admin/users/${id}`),

  // 创建用户
  create: (data: Partial<User> & { password: string }) =>
    post<User>('/admin/users', data),

  // 更新用户
  update: (id: string, data: Partial<User>) =>
    put<User>(`/admin/users/${id}`, data),

  // 删除用户
  delete: (id: string) =>
    del(`/admin/users/${id}`),

  // 批量更新状态
  batchUpdateStatus: (ids: string[], status: string) =>
    post('/admin/users/batch/status', { ids, status }),

  // 重置密码
  resetPassword: (id: string) =>
    post<{ password: string }>(`/admin/users/${id}/reset-password`),

  // 分配角色
  assignRoles: (userId: string, roleIds: string[]) =>
    post(`/admin/users/${userId}/roles`, { roleIds }),
}
