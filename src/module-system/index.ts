/**
 * 模块系统主入口
 * 导出所有核心功能
 */

// 核心类
export { ModuleRegistry, moduleRegistry } from './core/ModuleRegistry';
export { ManifestParser } from './core/ManifestParser';
export { BackendRouteManager, getBackendRouteManager, resetBackendRouteManager } from './core/BackendRouteManager';
export { FrontendRouteManager, frontendRouteManager } from './core/FrontendRouteManager';
export { BackendModuleLoader, backendModuleLoader } from './core/BackendModuleLoader';
export { FrontendModuleLoader, frontendModuleLoader } from './core/FrontendModuleLoader';
export { ModuleScanner, moduleScanner } from './core/ModuleScanner';
export { MenuManager, menuManager } from './core/MenuManager';
export { MigrationManager, migrationManager } from './core/MigrationManager';
export { LifecycleManager, createLifecycleManager } from './core/LifecycleManager';
export { PermissionManager, permissionManager } from './core/PermissionManager';
export { ConfigManager, configManager } from './core/ConfigManager';

// 类型定义
export type {
  ModuleManifest,
  ModuleInfo,
  ModuleStatus,
  DependencyCheckResult,
  DependencyTree,
  DependencyTreeNode,
  MenuConfig,
  PermissionConfig,
  ApiEndpoint,
  ModuleRecord,
  ModuleDependencyRecord
} from './types';

export type {
  RouteInfo,
  RouteConflict
} from './core/BackendRouteManager';

export type {
  FrontendRouteConfig,
  ModuleRouteInfo
} from './core/FrontendRouteManager';

export type {
  LoadedBackendModule,
  ModuleHooks
} from './core/BackendModuleLoader';

export type {
  LoadedFrontendModule,
  ComponentLoadOptions
} from './core/FrontendModuleLoader';

export type {
  ScanResult,
  ScanOptions
} from './core/ModuleScanner';

export type {
  MenuItem
} from './core/MenuManager';

export type {
  Migration,
  MigrationRecord
} from './core/MigrationManager';

export type {
  Permission
} from './core/PermissionManager';

export type {
  ValidationResult
} from './core/ConfigManager';
