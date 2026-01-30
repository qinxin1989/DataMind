/**
 * 模块化后台管理框架 - 核心类型定义
 */

// ==================== 模块系统类型 ====================

/** 模块元数据 */
export interface ModuleMetadata {
  name: string;           // 模块唯一标识
  displayName: string;    // 显示名称
  version: string;        // 版本号
  description: string;    // 模块描述
  icon: string;           // 模块图标
  order: number;          // 排序权重
  dependencies?: string[]; // 依赖的其他模块
}

/** 模块路由配置 */
export interface ModuleRoute {
  path: string;
  name: string;
  component: string;      // 组件路径
  meta: {
    title: string;
    icon?: string;
    permission?: string;
    hidden?: boolean;
  };
  children?: ModuleRoute[];
}

/** 模块菜单配置 */
export interface ModuleMenu {
  key: string;
  title: string;
  icon?: string;
  path?: string;
  permission?: string;
  order: number;
  children?: ModuleMenu[];
  external?: boolean;
  target?: '_blank' | '_self';
}

/** 模块权限配置 */
export interface ModulePermission {
  code: string;
  name: string;
  description: string;
  type: 'menu' | 'button' | 'api';
  moduleSource?: string;
}

/** 完整模块定义 */
export interface ModuleDefinition {
  metadata: ModuleMetadata;
  routes: ModuleRoute[];
  menus: ModuleMenu[];
  permissions: ModulePermission[];
  apiRoutes?: any;        // Express Router
}

/** 模块加载状态 */
export type ModuleLoadStatus = 'loading' | 'loaded' | 'error' | 'unloaded';

// ==================== 用户与权限类型 ====================

/** 用户角色 */
export type UserRole = 'super_admin' | 'admin' | 'user' | 'viewer';

/** 用户状态 */
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending';

/** 权限类型 */
export type PermissionType = 'menu' | 'button' | 'api';

/** 角色数据 */
export interface Role {
  id: string;
  name: string;
  code: string;
  description: string;
  permissionCodes: string[];
  menuIds?: string[];
  parentId?: string;
  status: 'active' | 'inactive';
  isSystem: boolean;
  createdAt: number;
  updatedAt: number;
}

/** 创建角色请求 */
export interface CreateRoleRequest {
  name: string;
  code: string;
  description?: string;
  permissionCodes?: string[];
  menuIds?: string[];
  parentId?: string;
  status?: 'active' | 'inactive';
}

/** 更新角色请求 */
export interface UpdateRoleRequest {
  name?: string;
  description?: string;
  permissionCodes?: string[];
  menuIds?: string[];
  parentId?: string;
  status?: 'active' | 'inactive';
}

/** 权限数据 */
export interface Permission {
  code: string;
  name: string;
  description: string;
  type: PermissionType;
  moduleSource?: string;
}


/** 用户基础信息 */
export interface UserBase {
  id: string;
  username: string;
  email?: string;
  fullName?: string;
  role: UserRole;
  status: UserStatus;
  createdAt: number;
  updatedAt: number;
}

/** 用户详细信息 */
export interface UserDetail extends UserBase {
  avatar?: string;
  phone?: string;
  department?: string;
  lastLoginAt?: number;
  lastLoginIp?: string;
  roleIds: string[];
  roles?: Role[];
}

/** 用户数据（含密码哈希） */
export interface UserData extends UserDetail {
  passwordHash: string;
}

/** 创建用户请求 */
export interface CreateUserRequest {
  username: string;
  password: string;
  email?: string;
  fullName?: string;
  role?: UserRole;
  status?: UserStatus;
  roleIds?: string[];
  phone?: string;
  department?: string;
}

/** 更新用户请求 */
export interface UpdateUserRequest {
  email?: string;
  fullName?: string;
  role?: UserRole;
  status?: UserStatus;
  roleIds?: string[];
  phone?: string;
  department?: string;
  avatar?: string;
}

/** 用户查询参数 */
export interface UserQueryParams {
  keyword?: string;
  status?: UserStatus;
  role?: UserRole;
  department?: string;
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ==================== 菜单类型 ====================

/** 菜单项 */
export interface MenuItem {
  id: string;
  parentId?: string;
  title: string;
  icon?: string;
  path?: string;
  component?: string;
  permission?: string;
  order: number;
  visible: boolean;
  external: boolean;
  target: '_blank' | '_self';
  moduleSource?: string;
  isSystem: boolean;
  createdAt: number;
  updatedAt: number;
}

/** 菜单树节点 */
export interface MenuTreeNode extends MenuItem {
  children?: MenuTreeNode[];
}

/** 创建菜单请求 */
export interface CreateMenuRequest {
  parentId?: string;
  title: string;
  icon?: string;
  path?: string;
  component?: string;
  permission?: string;
  order?: number;
  visible?: boolean;
  external?: boolean;
  target?: '_blank' | '_self';
  // 外部平台对接字段
  menuType?: 'internal' | 'external' | 'iframe';
  externalUrl?: string;
  openMode?: 'current' | 'blank' | 'iframe';
  moduleCode?: string;
}

/** 更新菜单请求 */
export interface UpdateMenuRequest {
  parentId?: string;
  title?: string;
  icon?: string;
  path?: string;
  component?: string;
  permission?: string;
  order?: number;
  visible?: boolean;
  external?: boolean;
  target?: '_blank' | '_self';
  // 外部平台对接字段
  menuType?: 'internal' | 'external' | 'iframe';
  externalUrl?: string;
  openMode?: 'current' | 'blank' | 'iframe';
  moduleCode?: string;
}

// ==================== AI管理类型 ====================

/** AI提供商类型 */
export type AIProviderType = 'openai' | 'qwen' | 'azure' | 'siliconflow' | 'zhipu' | 'deepseek' | 'custom';

/** AI配置 */
export interface AIConfig {
  id: string;
  name: string;
  provider: AIProviderType;
  model: string;
  embeddingModel?: string;
  apiKey?: string;
  baseUrl?: string;
  isDefault: boolean;
  status: 'active' | 'inactive';
  priority?: number;
  createdAt: number;
  updatedAt: number;
}

/** 创建AI配置请求 */
export interface CreateAIConfigRequest {
  name: string;
  provider: AIProviderType;
  model: string;
  embeddingModel?: string;
  apiKey?: string;
  baseUrl?: string;
  isDefault?: boolean;
  status?: 'active' | 'inactive';
}

/** 更新AI配置请求 */
export interface UpdateAIConfigRequest {
  name?: string;
  provider?: AIProviderType;
  model?: string;
  embeddingModel?: string;
  apiKey?: string;
  baseUrl?: string;
  apiEndpoint?: string;
  isDefault?: boolean;
  status?: 'active' | 'inactive';
}

/** AI提供商配置（兼容旧接口） */
export interface AIProviderConfig {
  id: string;
  name: string;
  provider: AIProviderType;
  apiKey: string;
  apiEndpoint?: string;
  model: string;
  maxTokens: number;
  temperature: number;
  isDefault: boolean;
  status: 'active' | 'inactive';
  createdAt: number;
  updatedAt: number;
}

/** AI使用统计 */
export interface AIUsageStats {
  totalRequests: number;
  totalTokens: number;
  estimatedCost: number;
  requestsByDay: { date: string; count: number }[];
  tokensByDay: { date: string; tokens: number }[];
  topUsers: { userId: string; username: string; requests: number; tokens?: number }[];
  byModel?: { modelName: string; requests: number; tokens: number }[];
  byUserModel?: { userId: string; username: string; modelName: string; requests: number; tokens: number }[];
  byDayModel?: { date: string; modelName: string; requests: number; tokens: number }[];
}

/** 对话历史 */
export interface ConversationHistory {
  id: string;
  userId: string;
  username?: string;
  datasourceId: string;
  datasourceName?: string;
  question: string;
  answer: string;
  sqlQuery?: string;
  tokensUsed: number;
  responseTime: number;
  status?: string;
  createdAt: number;
}

/** 对话查询参数 */
export interface ConversationQueryParams {
  userId?: string;
  datasourceId?: string;
  keyword?: string;
  startTime?: number;
  endTime?: number;
  page: number;
  pageSize: number;
}


// ==================== 系统管理类型 ====================

/** 系统配置项 */
export interface SystemConfig {
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'json';
  description: string;
  group: string;
  editable: boolean;
}

/** 系统状态 */
export interface SystemStatus {
  cpu: { usage: number; cores: number };
  memory: { total: number; used: number; free: number };
  disk: { total: number; used: number; free: number };
  uptime: number;
  nodeVersion: string;
  platform: string;
}

/** 操作日志 */
export interface OperationLog {
  id: string;
  userId: string;
  username: string;
  action: string;
  module: string;
  target: string;
  targetId?: string;
  detail: string;
  ip: string;
  userAgent: string;
  result: 'success' | 'failure';
  errorMessage?: string;
  createdAt: number;
}

/** 日志查询参数 */
export interface LogQueryParams {
  userId?: string;
  action?: string;
  module?: string;
  result?: 'success' | 'failure';
  startTime?: number;
  endTime?: number;
  page: number;
  pageSize: number;
}

// ==================== 审计日志类型 ====================

/** 审计操作类型 */
export type AuditAction =
  | 'login' | 'logout'
  | 'create' | 'read' | 'update' | 'delete'
  | 'export' | 'import'
  | 'grant_permission' | 'revoke_permission'
  | 'config_change';

/** 审计日志 */
export interface AuditLog {
  id: string;
  userId: string;
  username: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  oldValue?: string;
  newValue?: string;
  ip: string;
  userAgent: string;
  timestamp: number;
  sessionId?: string;
}

/** 审计查询参数 */
export interface AuditQueryParams {
  userId?: string;
  action?: AuditAction;
  resourceType?: string;
  startTime?: number;
  endTime?: number;
  page: number;
  pageSize: number;
}

// ==================== 通知类型 ====================

/** 通知类型 */
export type NotificationType = 'system' | 'warning' | 'info' | 'success';

/** 通知数据 */
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
  link?: string;
  read: boolean;
  createdAt: number;
}

/** 通知查询参数 */
export interface NotificationQueryParams {
  userId: string;
  type?: NotificationType;
  read?: boolean;
  page: number;
  pageSize: number;
}

// ==================== 数据源增强类型 ====================

/** 数据源分组 */
export interface DatasourceGroup {
  id: string;
  name: string;
  description?: string;
  order: number;
  createdAt: number;
}

/** 数据源标签 */
export interface DatasourceTag {
  id: string;
  name: string;
  color: string;
}

/** 数据源使用统计 */
export interface DatasourceUsageStats {
  datasourceId: string;
  totalQueries: number;
  successQueries: number;
  failedQueries: number;
  avgResponseTime: number;
  lastUsedAt?: number;
  queriesByDay: { date: string; count: number }[];
}

/** 连接测试结果 */
export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latency?: number;
  details?: Record<string, any>;
}

// ==================== 通用类型 ====================

/** 分页结果 */
export interface PaginatedResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** API响应 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: number;
  requestId?: string;
}

/** 错误码 */
export const ErrorCodes = {
  // 认证错误
  AUTH_TOKEN_MISSING: 'AUTH_TOKEN_MISSING',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',

  // 授权错误
  PERM_ACCESS_DENIED: 'PERM_ACCESS_DENIED',

  // 验证错误
  VALID_PARAM_MISSING: 'VALID_PARAM_MISSING',
  VALID_PARAM_INVALID: 'VALID_PARAM_INVALID',
  VALID_PASSWORD_WEAK: 'VALID_PASSWORD_WEAK',

  // 资源错误
  RES_NOT_FOUND: 'RES_NOT_FOUND',
  RES_ALREADY_EXISTS: 'RES_ALREADY_EXISTS',

  // 业务错误
  BIZ_USERNAME_EXISTS: 'BIZ_USERNAME_EXISTS',
  BIZ_MODULE_DEPENDENCY_MISSING: 'BIZ_MODULE_DEPENDENCY_MISSING',
  BIZ_AI_KEY_INVALID: 'BIZ_AI_KEY_INVALID',
  BIZ_OPERATION_FAILED: 'BIZ_OPERATION_FAILED',

  // 系统错误
  SYS_INTERNAL_ERROR: 'SYS_INTERNAL_ERROR',
  SYS_DATABASE_ERROR: 'SYS_DATABASE_ERROR',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
