// 用户相关类型
export interface User {
  id: string
  username: string
  email?: string
  fullName?: string
  avatar?: string
  phone?: string
  department?: string
  role: UserRole
  status: UserStatus
  roleIds: string[]
  lastLoginAt?: number
  lastLoginIp?: string
  createdAt: number
  updatedAt: number
}

export type UserRole = 'admin' | 'user' | 'viewer'
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending'

// 角色相关类型
export interface Role {
  id: string
  name: string
  code: string
  description: string
  permissionCodes: string[]
  menuIds?: string[]
  parentId?: string
  status: 'active' | 'inactive'
  isSystem: boolean
  createdAt: number
  updatedAt: number
}

// 菜单相关类型
export interface MenuItem {
  id: string
  parentId?: string
  title: string
  icon?: string
  path?: string
  component?: string
  permission?: string
  order: number
  visible: boolean
  // 外部平台对接字段
  menuType: 'internal' | 'external' | 'iframe'  // internal=内部路由, external=外部链接, iframe=iframe嵌入
  externalUrl?: string  // 外部链接地址
  openMode: 'current' | 'blank' | 'iframe'  // current=当前窗口, blank=新窗口, iframe=iframe
  moduleCode?: string  // 模块代码，用于区分不同平台
  // 兼容字段
  external: boolean
  target: '_blank' | '_self'
  moduleSource?: string
  isSystem: boolean
  children?: MenuItem[]
  createdAt: number
  updatedAt: number
}

// AI配置类型
export interface AIConfig {
  id: string
  name: string
  provider: 'openai' | 'qwen' | 'azure' | 'siliconflow' | 'zhipu' | 'deepseek' | 'local-qwen' | 'ollama' | 'text-generation-webui' | 'lm-studio' | 'vllm' | 'xinference' | 'fastchat' | 'custom'
  apiKey: string
  apiEndpoint?: string
  baseUrl?: string // 增加与后端兼容的字段
  model: string
  embeddingModel?: string
  maxTokens: number
  temperature: number
  isDefault: boolean
  status: 'active' | 'inactive'
  createdAt: number
  updatedAt: number
}

// 通知类型
export interface Notification {
  id: string
  userId: string
  type: 'system' | 'warning' | 'info' | 'success'
  title: string
  content: string
  link?: string
  read: boolean
  createdAt: number
}

// 审计日志类型
export interface AuditLog {
  id: string
  userId: string
  username: string
  action: string
  resourceType: string
  resourceId: string
  oldValue?: string
  newValue?: string
  ip: string
  userAgent: string
  timestamp: number
  sessionId: string
}

// 数据源可见性类型
export type DatasourceVisibility = 'private' | 'public'

// 数据源审核状态
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

// 数据源类型
export interface Datasource {
  id: string
  name: string
  type: string
  host: string
  port: number
  database: string
  username: string
  status: 'active' | 'inactive'
  group?: string
  tags?: string[]
  createdAt: number
  updatedAt: number
  // 可见性和审核相关
  ownerId: string
  visibility: DatasourceVisibility
  approvalStatus?: ApprovalStatus
  approvalComment?: string
  approvedBy?: string
  approvedAt?: number
}

// 系统配置类型
export interface SystemConfig {
  key: string
  value: string
  type: 'string' | 'number' | 'boolean' | 'json'
  description: string
  group: string
  editable: boolean
}

// 分页参数
export interface PaginationParams {
  page: number
  pageSize: number
}

// 分页响应
export interface PaginatedResponse<T> {
  list: T[]
  items?: T[]
  total: number
  page: number
  pageSize: number
}

// API响应
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
}
