/**
 * 前端路由管理器
 * 负责管理模块的前端路由注册和注销
 */

import type { RouteRecordRaw, Router } from 'vue-router';

/**
 * 前端路由配置
 */
export interface FrontendRouteConfig extends RouteRecordRaw {
  meta?: {
    title?: string;
    permission?: string;
    icon?: string;
    hidden?: boolean;
    [key: string]: any;
  };
}

/**
 * 模块路由信息
 */
export interface ModuleRouteInfo {
  moduleName: string;
  routes: FrontendRouteConfig[];
  registeredAt: Date;
}

/**
 * 前端路由管理器
 */
export class FrontendRouteManager {
  private router: Router | null = null;
  private moduleRoutes: Map<string, ModuleRouteInfo> = new Map();
  private routeNames: Map<string, string> = new Map(); // routeName -> moduleName

  /**
   * 设置 Vue Router 实例
   */
  setRouter(router: Router): void {
    this.router = router;
  }

  /**
   * 注册模块路由
   */
  registerRoutes(moduleName: string, routes: FrontendRouteConfig[]): void {
    // 检查模块是否已注册
    if (this.moduleRoutes.has(moduleName)) {
      throw new Error(`Routes for module ${moduleName} are already registered`);
    }

    // 验证路由配置
    this.validateRoutes(routes);

    // 检查路由名称冲突
    const conflicts = this.checkNameConflicts(moduleName, routes);
    if (conflicts.length > 0) {
      throw new Error(
        `Route name conflicts detected for module ${moduleName}:\n` +
        conflicts.map(c => `  - ${c.name} (conflicts with module ${c.existingModule})`).join('\n')
      );
    }

    // 添加模块前缀到路由名称（避免冲突）
    const prefixedRoutes = this.addModulePrefix(moduleName, routes);

    // 保存路由信息
    this.moduleRoutes.set(moduleName, {
      moduleName,
      routes: prefixedRoutes,
      registeredAt: new Date()
    });

    // 记录路由名称映射
    this.recordRouteNames(moduleName, prefixedRoutes);

    // 如果 router 已设置，立即添加路由
    if (this.router) {
      this.addRoutesToRouter(prefixedRoutes);
    }

    console.log(`Frontend routes registered for module ${moduleName}`);
  }

  /**
   * 注销模块路由
   */
  unregisterRoutes(moduleName: string): void {
    const moduleInfo = this.moduleRoutes.get(moduleName);
    if (!moduleInfo) {
      throw new Error(`Routes for module ${moduleName} are not registered`);
    }

    // 从 router 中移除路由
    if (this.router) {
      this.removeRoutesFromRouter(moduleInfo.routes);
    }

    // 删除路由名称映射
    for (const route of moduleInfo.routes) {
      if (route.name) {
        this.routeNames.delete(route.name as string);
      }
    }

    // 删除模块路由信息
    this.moduleRoutes.delete(moduleName);

    console.log(`Frontend routes unregistered for module ${moduleName}`);
  }

  /**
   * 获取所有路由
   */
  getAllRoutes(): FrontendRouteConfig[] {
    const allRoutes: FrontendRouteConfig[] = [];
    
    for (const moduleInfo of this.moduleRoutes.values()) {
      allRoutes.push(...moduleInfo.routes);
    }
    
    return allRoutes;
  }

  /**
   * 获取模块路由
   */
  getModuleRoutes(moduleName: string): FrontendRouteConfig[] | null {
    const moduleInfo = this.moduleRoutes.get(moduleName);
    return moduleInfo ? moduleInfo.routes : null;
  }

  /**
   * 检查模块是否已注册路由
   */
  hasRoutes(moduleName: string): boolean {
    return this.moduleRoutes.has(moduleName);
  }

  /**
   * 添加路由到 Vue Router
   */
  addToRouter(router: Router): void {
    this.router = router;
    
    // 添加所有已注册的路由
    for (const moduleInfo of this.moduleRoutes.values()) {
      this.addRoutesToRouter(moduleInfo.routes);
    }
  }

  /**
   * 验证路由配置
   */
  private validateRoutes(routes: FrontendRouteConfig[]): void {
    for (const route of routes) {
      // 检查必需字段
      if (!route.path) {
        throw new Error('Route path is required');
      }

      // 检查路由名称（推荐但不强制）
      if (!route.name) {
        console.warn(`Route ${route.path} does not have a name. This may cause issues.`);
      }

      // 递归验证子路由
      if (route.children) {
        this.validateRoutes(route.children);
      }
    }
  }

  /**
   * 检查路由名称冲突
   */
  private checkNameConflicts(
    moduleName: string,
    routes: FrontendRouteConfig[]
  ): Array<{ name: string; existingModule: string }> {
    const conflicts: Array<{ name: string; existingModule: string }> = [];

    const checkRoute = (route: FrontendRouteConfig) => {
      if (route.name) {
        const prefixedName = this.getPrefixedName(moduleName, route.name as string);
        const existingModule = this.routeNames.get(prefixedName);
        
        if (existingModule && existingModule !== moduleName) {
          conflicts.push({
            name: route.name as string,
            existingModule
          });
        }
      }

      // 递归检查子路由
      if (route.children) {
        route.children.forEach(checkRoute);
      }
    };

    routes.forEach(checkRoute);
    return conflicts;
  }

  /**
   * 为路由名称添加模块前缀
   */
  private addModulePrefix(moduleName: string, routes: FrontendRouteConfig[]): FrontendRouteConfig[] {
    return routes.map(route => {
      const prefixedRoute = { ...route };

      // 添加模块前缀到路由名称
      if (prefixedRoute.name) {
        prefixedRoute.name = this.getPrefixedName(moduleName, prefixedRoute.name as string);
      }

      // 递归处理子路由
      if (prefixedRoute.children) {
        prefixedRoute.children = this.addModulePrefix(moduleName, prefixedRoute.children);
      }

      return prefixedRoute;
    });
  }

  /**
   * 获取带前缀的路由名称
   */
  private getPrefixedName(moduleName: string, routeName: string): string {
    return `${moduleName}:${routeName}`;
  }

  /**
   * 记录路由名称映射
   */
  private recordRouteNames(moduleName: string, routes: FrontendRouteConfig[]): void {
    const recordRoute = (route: FrontendRouteConfig) => {
      if (route.name) {
        this.routeNames.set(route.name as string, moduleName);
      }

      if (route.children) {
        route.children.forEach(recordRoute);
      }
    };

    routes.forEach(recordRoute);
  }

  /**
   * 添加路由到 Router
   */
  private addRoutesToRouter(routes: FrontendRouteConfig[]): void {
    if (!this.router) {
      throw new Error('Router not set. Call setRouter() first.');
    }

    for (const route of routes) {
      this.router.addRoute(route);
    }
  }

  /**
   * 从 Router 中移除路由
   */
  private removeRoutesFromRouter(routes: FrontendRouteConfig[]): void {
    if (!this.router) return;

    const removeRoute = (route: FrontendRouteConfig) => {
      if (route.name) {
        this.router!.removeRoute(route.name as string);
      }

      // 递归移除子路由
      if (route.children) {
        route.children.forEach(removeRoute);
      }
    };

    routes.forEach(removeRoute);
  }

  /**
   * 清除所有路由
   */
  clear(): void {
    for (const moduleName of Array.from(this.moduleRoutes.keys())) {
      try {
        this.unregisterRoutes(moduleName);
      } catch (error) {
        console.error(`Failed to unregister routes for ${moduleName}:`, error);
      }
    }
  }

  /**
   * 获取路由统计信息
   */
  getStats(): {
    totalModules: number;
    totalRoutes: number;
    moduleStats: Array<{ module: string; routeCount: number }>;
  } {
    const moduleStats = Array.from(this.moduleRoutes.entries()).map(([module, info]) => ({
      module,
      routeCount: this.countRoutes(info.routes)
    }));

    return {
      totalModules: this.moduleRoutes.size,
      totalRoutes: moduleStats.reduce((sum, stat) => sum + stat.routeCount, 0),
      moduleStats
    };
  }

  /**
   * 计算路由数量（包括子路由）
   */
  private countRoutes(routes: FrontendRouteConfig[]): number {
    let count = routes.length;
    
    for (const route of routes) {
      if (route.children) {
        count += this.countRoutes(route.children);
      }
    }
    
    return count;
  }
}

// 导出单例
export const frontendRouteManager = new FrontendRouteManager();
