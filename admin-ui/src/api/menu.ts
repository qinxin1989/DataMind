import { get, post, put, del } from './request'
import type { MenuItem } from '@/types'

export const menuApi = {
  // 获取用户菜单树
  getUserMenuTree: () =>
    get<MenuItem[]>('/admin/menus/user'),

  // 获取完整菜单树
  getFullMenuTree: () =>
    get<MenuItem[]>('/admin/menus?tree=true'),

  // 创建菜单
  create: (data: Partial<MenuItem>) =>
    post<MenuItem>('/admin/menus', data),

  // 更新菜单
  update: (id: string, data: Partial<MenuItem>) =>
    put<MenuItem>(`/admin/menus/${id}`, data),

  // 删除菜单
  delete: (id: string) =>
    del(`/admin/menus/${id}`),

  // 批量更新排序
  updateOrder: (items: { id: string; order: number; parentId?: string }[]) =>
    post('/admin/menus/order', { items }),
}
