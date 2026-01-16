/**
 * 模块注册中心
 * 负责管理所有功能模块的注册、加载和卸载
 */

import { Router } from 'express';
import type { 
  ModuleDefinition, 
  ModuleLoadStatus, 
  ModuleMenu, 
  ModulePermission,
  ModuleRoute 
} from '../types';

/** 依赖检查结果 */
export interface DependencyCheckResult {
  valid: boolean;
  missing: string[];
}

/** 模块注册中心 */
export class ModuleRegistry {
  private modules: Map<string, ModuleDefinition> = new Map();
  private loadStatus: Map<string, ModuleLoadStatus> = new Map();
  private router: Router;
  private menus: ModuleMenu[] = [];
  private permissions: ModulePermission[] = [];
  private routes: ModuleRoute[] = [];

  constructor() {
    this.router = Router();
  }

  /**
   * 检查模块依赖
   */
  checkDependencies(module: ModuleDefinition): DependencyCheckResult {
    const dependencies = module.metadata.dependencies || [];
    const missing: string[] = [];

    for (const dep of dependencies) {
      if (!this.modules.has(dep)) {
        missing.push(dep);
      }
    }

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  /**
   * 注册模块
   */
  async register(module: ModuleDefinition): Promise<void> {
    const { name } = module.metadata;

    // 检查是否已注册
    if (this.modules.has(name)) {
      throw new Error(`Module "${name}" is already registered`);
    }

    // 设置加载状态
    this.loadStatus.set(name, 'loading');

    try {
      // 检查依赖
      const depCheck = this.checkDependencies(module);
      if (!depCheck.valid) {
        throw new Error(
          `Module "${name}" has missing dependencies: ${depCheck.missing.join(', ')}`
        );
      }

      // 注册模块
      this.modules.set(name, module);

      // 注册路由
      if (module.apiRoutes) {
        this.router.use(`/${name}`, module.apiRoutes);
      }

      // 注册菜单（添加模块来源标记）
      const menusWithSource = module.menus.map(menu => ({
        ...menu,
        moduleSource: name,
      }));
      this.menus.push(...menusWithSource);

      // 注册权限（添加模块来源标记）
      const permsWithSource = module.permissions.map(perm => ({
        ...perm,
        moduleSource: name,
      }));
      this.permissions.push(...permsWithSource);

      // 注册前端路由配置
      const routesWithSource = module.routes.map(route => ({
        ...route,
        moduleSource: name,
      }));
      this.routes.push(...(routesWithSource as any));

      // 更新状态
      this.loadStatus.set(name, 'loaded');

    } catch (error) {
      this.loadStatus.set(name, 'error');
      throw error;
    }
  }

  /**
   * 卸载模块
   */
  async unregister(moduleName: string): Promise<void> {
    const module = this.modules.get(moduleName);
    if (!module) {
      throw new Error(`Module "${moduleName}" is not registered`);
    }

    // 检查是否有其他模块依赖此模块
    for (const [name, mod] of this.modules) {
      if (name !== moduleName) {
        const deps = mod.metadata.dependencies || [];
        if (deps.includes(moduleName)) {
          throw new Error(
            `Cannot unregister module "${moduleName}": module "${name}" depends on it`
          );
        }
      }
    }

    // 移除菜单
    this.menus = this.menus.filter(m => (m as any).moduleSource !== moduleName);

    // 移除权限
    this.permissions = this.permissions.filter(p => p.moduleSource !== moduleName);

    // 移除路由配置
    this.routes = this.routes.filter(r => (r as any).moduleSource !== moduleName);

    // 移除模块
    this.modules.delete(moduleName);
    this.loadStatus.set(moduleName, 'unloaded');

    // 注意：Express Router 不支持动态移除路由
    // 在生产环境中，需要重建 router 或使用其他方案
  }

  /**
   * 获取模块
   */
  getModule(name: string): ModuleDefinition | undefined {
    return this.modules.get(name);
  }

  /**
   * 获取所有模块
   */
  getAllModules(): ModuleDefinition[] {
    return Array.from(this.modules.values());
  }

  /**
   * 获取模块加载状态
   */
  getLoadStatus(): Map<string, ModuleLoadStatus> {
    return new Map(this.loadStatus);
  }

  /**
   * 获取指定模块的加载状态
   */
  getModuleStatus(name: string): ModuleLoadStatus | undefined {
    return this.loadStatus.get(name);
  }

  /**
   * 获取所有已注册的菜单
   */
  getMenus(): ModuleMenu[] {
    return [...this.menus].sort((a, b) => a.order - b.order);
  }

  /**
   * 获取所有已注册的权限
   */
  getPermissions(): ModulePermission[] {
    return [...this.permissions];
  }

  /**
   * 获取所有已注册的前端路由
   */
  getRoutes(): ModuleRoute[] {
    return [...this.routes];
  }

  /**
   * 获取 Express Router
   */
  getRouter(): Router {
    return this.router;
  }

  /**
   * 检查模块是否已注册
   */
  isRegistered(name: string): boolean {
    return this.modules.has(name);
  }

  /**
   * 获取已注册模块数量
   */
  getModuleCount(): number {
    return this.modules.size;
  }

  /**
   * 清空所有模块（用于测试）
   */
  clear(): void {
    this.modules.clear();
    this.loadStatus.clear();
    this.menus = [];
    this.permissions = [];
    this.routes = [];
    this.router = Router();
  }
}

// 单例实例
export const moduleRegistry = new ModuleRegistry();
