import { get, post, put, del } from './request'
import type { Role } from '@/types'

export const roleApi = {
  // 获取角色列表
  getList: () =>
    get<Role[]>('/admin/roles'),

  // 获取角色详情
  getById: (id: string) =>
    get<Role>(`/admin/roles/${id}`),

  // 创建角色
  create: (data: Partial<Role>) =>
    post<Role>('/admin/roles', data),

  // 更新角色
  update: (id: string, data: Partial<Role>) =>
    put<Role>(`/admin/roles/${id}`, data),

  // 删除角色
  delete: (id: string) =>
    del(`/admin/roles/${id}`),

  // 获取所有权限
  getAllPermissions: () =>
    get<string[]>('/admin/permissions'),
}
