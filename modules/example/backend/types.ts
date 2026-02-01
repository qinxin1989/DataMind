/**
 * 示例模块类型定义
 */

export interface ExampleItem {
  id: string;
  title: string;
  description?: string;
  status: 'active' | 'inactive';
  created_by?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateExampleDto {
  title: string;
  description?: string;
  status?: 'active' | 'inactive';
}

export interface UpdateExampleDto {
  title?: string;
  description?: string;
  status?: 'active' | 'inactive';
}

export interface ExampleListQuery {
  page?: number;
  pageSize?: number;
  status?: 'active' | 'inactive';
  keyword?: string;
}

export interface ExampleListResponse {
  items: ExampleItem[];
  total: number;
  page: number;
  pageSize: number;
}
