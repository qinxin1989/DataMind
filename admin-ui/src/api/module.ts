import { get, put } from './request'

/** 模块摘要信息（列表用） */
export interface ModuleSummary {
  name: string
  displayName: string
  version: string
  description: string
  author: string
  type: 'system' | 'business' | 'tool'
  category: string
  tags: string[]
  status: 'installed' | 'enabled' | 'disabled' | 'error'
  error: string | null
  hasBackend: boolean
  hasFrontend: boolean
  menuCount: number
  permissionCount: number
  apiCount: number
  dependencies: Record<string, string>
}

/** 模块详情 */
export interface ModuleDetail extends Omit<ModuleSummary, 'hasBackend' | 'hasFrontend' | 'menuCount' | 'permissionCount' | 'apiCount'> {
  menus: any[]
  permissions: any[]
  api: { endpoints?: any[] } | null
  backend: { entry: string; routesPrefix?: string } | null
  frontend: { entry: string } | null
}

export const moduleApi = {
  /** 获取所有模块列表 */
  getModules: () =>
    get<ModuleSummary[]>('/admin/modules'),

  /** 获取单个模块详情 */
  getModule: (name: string) =>
    get<ModuleDetail>(`/admin/modules/${name}`),

  /** 启用模块 */
  enableModule: (name: string) =>
    put<{ message: string }>(`/admin/modules/${name}/enable`),

  /** 禁用模块 */
  disableModule: (name: string) =>
    put<{ message: string }>(`/admin/modules/${name}/disable`),
}
