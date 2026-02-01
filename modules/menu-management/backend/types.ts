/**
 * 菜单管理模块类型定义
 */

export interface Menu {
  id: string;
  title: string;
  path?: string;
  icon?: string;
  parentId?: string;
  sortOrder: number;
  order: number;  // 前端使用
  visible: boolean;
  permissionCode?: string;
  permission?: string;  // 前端使用
  isSystem: boolean;
  // 外部平台对接字段
  menuType: 'internal' | 'external' | 'iframe';
  externalUrl?: string;
  openMode: 'current' | 'blank' | 'iframe';
  moduleCode?: string;
  // 兼容字段
  external: boolean;
  target: string;
  createdAt: number;
  updatedAt: number;
  children?: Menu[];
}

export interface CreateMenuRequest {
  title: string;
  path?: string;
  icon?: string;
  parentId?: string;
  order?: number;
  visible?: boolean;
  permission?: string;
  menuType?: 'internal' | 'external' | 'iframe';
  externalUrl?: string;
  openMode?: 'current' | 'blank' | 'iframe';
  moduleCode?: string;
}

export interface UpdateMenuRequest {
  title?: string;
  path?: string;
  icon?: string;
  parentId?: string;
  order?: number;
  visible?: boolean;
  permission?: string;
  menuType?: 'internal' | 'external' | 'iframe';
  externalUrl?: string;
  openMode?: 'current' | 'blank' | 'iframe';
  moduleCode?: string;
}

export interface MenuQueryParams {
  keyword?: string;
  visible?: boolean;
  parentId?: string;
}
