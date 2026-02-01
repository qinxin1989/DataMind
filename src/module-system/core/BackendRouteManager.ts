/**
 * 后端路由管理器
 * 负责管理模块的后端路由注册和注销
 */

import { Router, Express, RequestHandler } from 'express';

/**
 * 路由信息
 */
export interface RouteInfo {
  moduleName: string;
  prefix: string;
  methods: string[];
  paths: string[];
  registeredAt: Date;
}

/**
 * 路由冲突信息
 */
export interface RouteConflict {
  path: string;
  method: string;
  existingModule: string;
  newModule: string;
}

/**
 * 后端路由管理器
 */
export class BackendRouteManager {
  private app: Express;
  private routes: Map<string, RouteInfo> = new Map();
  private routerMap: Map<string, Router> = new Map();

  constructor(app: Express) {
    this.app = app;
  }

  /**
   * 注册模块路由
   */
  registerRoutes(moduleName: string, router: Router, prefix: string = ''): void {
    // 检查模块是否已注册
    if (this.routes.has(moduleName)) {
      throw new Error(`Routes for module ${moduleName} are already registered`);
    }

    // 检查路由冲突
    const conflicts = this.checkConflicts(prefix, router);
    if (conflicts.length > 0) {
      throw new Error(
        `Route conflicts detected for module ${moduleName}:\n` +
        conflicts.map(c => `  - ${c.method} ${c.path} (conflicts with ${c.existingModule})`).join('\n')
      );
    }

    // 注册路由到 Express
    const fullPrefix = this.normalizePrefix(prefix);
    this.app.use(fullPrefix, router);

    // 提取路由信息
    const routeInfo = this.extractRouteInfo(moduleName, router, fullPrefix);

    // 保存路由信息
    this.routes.set(moduleName, routeInfo);
    this.routerMap.set(moduleName, router);

    console.log(`Routes registered for module ${moduleName} at ${fullPrefix}`);
  }

  /**
   * 注销模块路由
   */
  unregisterRoutes(moduleName: string): void {
    if (!this.routes.has(moduleName)) {
      throw new Error(`Routes for module ${moduleName} are not registered`);
    }

    const routeInfo = this.routes.get(moduleName)!;
    const router = this.routerMap.get(moduleName)!;

    // 从 Express 中移除路由
    // 注意：Express 不直接支持移除中间件，需要通过修改 stack
    this.removeRouterFromApp(routeInfo.prefix, router);

    // 删除路由信息
    this.routes.delete(moduleName);
    this.routerMap.delete(moduleName);

    console.log(`Routes unregistered for module ${moduleName}`);
  }

  /**
   * 获取所有路由信息
   */
  getAllRoutes(): RouteInfo[] {
    return Array.from(this.routes.values());
  }

  /**
   * 获取模块路由信息
   */
  getModuleRoutes(moduleName: string): RouteInfo | null {
    return this.routes.get(moduleName) || null;
  }

  /**
   * 检查路由是否存在
   */
  hasRoutes(moduleName: string): boolean {
    return this.routes.has(moduleName);
  }

  /**
   * 检查路由冲突
   */
  checkConflict(path: string, method: string = '*'): boolean {
    const normalizedPath = this.normalizePath(path);

    for (const routeInfo of this.routes.values()) {
      for (const existingPath of routeInfo.paths) {
        if (this.pathsMatch(normalizedPath, existingPath)) {
          // 如果方法相同或任一为通配符，则冲突
          if (method === '*' || routeInfo.methods.includes(method) || routeInfo.methods.includes('*')) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * 检查多个路由冲突
   */
  private checkConflicts(prefix: string, router: Router): RouteConflict[] {
    const conflicts: RouteConflict[] = [];
    const fullPrefix = this.normalizePrefix(prefix);

    // 提取新路由的所有路径和方法
    const newRoutes = this.extractRoutesFromRouter(router, fullPrefix);

    // 检查每个新路由是否与现有路由冲突
    for (const newRoute of newRoutes) {
      for (const [existingModule, routeInfo] of this.routes.entries()) {
        for (let i = 0; i < routeInfo.paths.length; i++) {
          const existingPath = routeInfo.paths[i];
          const existingMethod = routeInfo.methods[i];

          if (this.pathsMatch(newRoute.path, existingPath)) {
            if (newRoute.method === existingMethod || 
                newRoute.method === '*' || 
                existingMethod === '*') {
              conflicts.push({
                path: newRoute.path,
                method: newRoute.method,
                existingModule,
                newModule: 'new'
              });
            }
          }
        }
      }
    }

    return conflicts;
  }

  /**
   * 从 Express 应用中移除路由
   */
  private removeRouterFromApp(prefix: string, router: Router): void {
    // Express 的 stack 包含所有中间件和路由
    const stack = (this.app as any)._router?.stack;
    if (!stack) return;

    // 找到并移除匹配的路由
    for (let i = stack.length - 1; i >= 0; i--) {
      const layer = stack[i];
      
      // 检查是否是我们要移除的路由
      if (layer.handle === router) {
        stack.splice(i, 1);
      }
    }
  }

  /**
   * 提取路由信息
   */
  private extractRouteInfo(moduleName: string, router: Router, prefix: string): RouteInfo {
    const routes = this.extractRoutesFromRouter(router, prefix);

    return {
      moduleName,
      prefix,
      methods: routes.map(r => r.method),
      paths: routes.map(r => r.path),
      registeredAt: new Date()
    };
  }

  /**
   * 从 Router 中提取所有路由
   */
  private extractRoutesFromRouter(router: Router, prefix: string): Array<{ path: string; method: string }> {
    const routes: Array<{ path: string; method: string }> = [];
    const stack = (router as any).stack;

    if (!stack) return routes;

    for (const layer of stack) {
      if (layer.route) {
        // 这是一个路由
        const path = this.joinPaths(prefix, layer.route.path);
        const methods = Object.keys(layer.route.methods);
        
        for (const method of methods) {
          routes.push({
            path,
            method: method.toUpperCase()
          });
        }
      } else if (layer.name === 'router') {
        // 这是一个嵌套的 Router
        const nestedPrefix = this.joinPaths(prefix, layer.regexp.source);
        const nestedRoutes = this.extractRoutesFromRouter(layer.handle, nestedPrefix);
        routes.push(...nestedRoutes);
      }
    }

    return routes;
  }

  /**
   * 规范化路径前缀
   */
  private normalizePrefix(prefix: string): string {
    if (!prefix) return '';
    
    // 确保以 / 开头
    if (!prefix.startsWith('/')) {
      prefix = '/' + prefix;
    }
    
    // 移除末尾的 /
    if (prefix.endsWith('/') && prefix.length > 1) {
      prefix = prefix.slice(0, -1);
    }
    
    return prefix;
  }

  /**
   * 规范化路径
   */
  private normalizePath(path: string): string {
    if (!path) return '/';
    
    // 确保以 / 开头
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    
    return path;
  }

  /**
   * 连接路径
   */
  private joinPaths(...paths: string[]): string {
    return paths
      .filter(p => p && p !== '/')
      .map(p => p.replace(/^\/+|\/+$/g, ''))
      .filter(p => p)
      .join('/')
      .replace(/^/, '/');
  }

  /**
   * 检查两个路径是否匹配
   */
  private pathsMatch(path1: string, path2: string): boolean {
    // 简单的字符串匹配
    // TODO: 支持路径参数匹配（如 /users/:id）
    return path1 === path2;
  }

  /**
   * 清除所有路由
   */
  clear(): void {
    for (const moduleName of Array.from(this.routes.keys())) {
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
    const moduleStats = Array.from(this.routes.entries()).map(([module, info]) => ({
      module,
      routeCount: info.paths.length
    }));

    return {
      totalModules: this.routes.size,
      totalRoutes: moduleStats.reduce((sum, stat) => sum + stat.routeCount, 0),
      moduleStats
    };
  }
}

// 导出单例（可选）
let instance: BackendRouteManager | null = null;

export function getBackendRouteManager(app?: Express): BackendRouteManager {
  if (!instance && !app) {
    throw new Error('BackendRouteManager not initialized. Provide Express app instance.');
  }
  
  if (app && !instance) {
    instance = new BackendRouteManager(app);
  }
  
  return instance!;
}

export function resetBackendRouteManager(): void {
  instance = null;
}
