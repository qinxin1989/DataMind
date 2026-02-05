/**
 * 数据源管理类型定义
 */

// 数据源类型
export type DataSourceType = 'mysql' | 'postgres' | 'api' | 'file' | 'excel' | 'csv';

// 数据源可见性
export type DataSourceVisibility = 'private' | 'public';

// 数据源审核状态
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

// 数据源配置
export interface DataSourceConfig {
    id: string;
    name: string;
    type: DataSourceType;
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
    apiUrl?: string;
    apiKey?: string;
    filePath?: string;
    userId: string;
    visibility: DataSourceVisibility;
    approvalStatus?: ApprovalStatus;
    description?: string;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

// 表结构信息
export interface TableSchema {
    name: string;
    columns: ColumnInfo[];
    primaryKey?: string[];
    foreignKeys?: ForeignKeyInfo[];
    indexes?: IndexInfo[];
    rowCount?: number;
    comment?: string;
}

// 列信息
export interface ColumnInfo {
    name: string;
    type: string;
    nullable: boolean;
    defaultValue?: any;
    comment?: string;
    isPrimaryKey?: boolean;
    isForeignKey?: boolean;
}

// 外键信息
export interface ForeignKeyInfo {
    columnName: string;
    referencedTable: string;
    referencedColumn: string;
}

// 索引信息
export interface IndexInfo {
    name: string;
    columns: string[];
    unique: boolean;
}

// 创建数据源 DTO
export interface CreateDataSourceDto {
    name: string;
    type: DataSourceType;
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
    apiUrl?: string;
    apiKey?: string;
    filePath?: string;
    description?: string;
    visibility?: DataSourceVisibility;
}

// 更新数据源 DTO
export interface UpdateDataSourceDto {
    name?: string;
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
    apiUrl?: string;
    apiKey?: string;
    description?: string;
    visibility?: DataSourceVisibility;
}

// 数据源列表查询
export interface DataSourceListQuery {
    page?: number;
    pageSize?: number;
    keyword?: string;
    type?: DataSourceType;
    visibility?: DataSourceVisibility;
}

// 数据源列表响应
export interface DataSourceListResponse {
    items: DataSourceConfig[];
    total: number;
    page: number;
    pageSize: number;
}

// 连接测试结果
export interface ConnectionTestResult {
    success: boolean;
    message: string;
    latency?: number;
    version?: string;
}

// 查询结果
export interface QueryResult {
    columns: string[];
    rows: any[];
    rowCount: number;
    executionTime: number;
}
