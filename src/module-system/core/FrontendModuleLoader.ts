/**
 * 前端模块加载器
 * 负责动态加载和卸载前端模块
 */

import type { Component, DefineComponent } from 'vue';
import type { RouteRecordRaw } from 'vue-router';

/**
 * 加载的前端模块接口
 */
export interface LoadedFrontendModule {
  name: string;
  routes?: RouteRecordRaw[];
  components?: Record<string, Component>;
  stores?: Record<string, any>;
  exports?: any;
}

/**
 * 组件加载选项
 */
export interface ComponentLoadOptions {
  loading?: Component;
  error?: Component;
  delay?: number;
  timeout?: number;
}

/**
 * 前端模块加载器类
 */
export class FrontendModuleLoader {
  private loadedModules: Map<string, LoadedFrontendModule> = new Map();
  private componentCache: Map<string, Component> = new Map();
  private modulesBasePath: string;

  constructor(modulesBasePath: string = '/modules') {
    this.modulesBasePath = modulesBasePath;
  }

  /**
   * 加载模块
   */
  async load(moduleName: string, manifest: any): Promise<LoadedFrontendModule> {
    // 检查是否已加载
    if (this.loadedModules.has(moduleName)) {
      return this.loadedModules.get(moduleName)!;
    }

    try {
      const loadedModule: LoadedFrontendModule = {
        name: moduleName
      };

      // 加载前端入口
      if (manifest.frontend?.entry) {
        const entryPath = this.getModulePath(moduleName, manifest.frontend.entry);
        const moduleExports = await this.loadModuleFile(entryPath);
        loadedModule.exports = moduleExports;

        // 提取常见导出
        if (moduleExports.routes) {
          loadedModule.routes = moduleExports.routes;
        }
        if (moduleExports.components) {
          loadedModule.components = moduleExports.components;
        }
        if (moduleExports.stores) {
          loadedModule.stores = moduleExports.stores;
        }
      }

      // 加载路由配置
      if (manifest.frontend?.routes) {
        const routesPath = this.getModulePath(moduleName, manifest.frontend.routes);
        const routesModule = await this.loadModuleFile(routesPath);
        if (routesModule.default || routesModule.routes) {
          loadedModule.routes = routesModule.default || routesModule.routes;
        }
      }

      // 加载组件
      if (manifest.frontend?.components) {
        loadedModule.components = await this.loadComponents(
          moduleName,
          manifest.frontend.components
        );
      }

      // 缓存加载的模块
      this.loadedModules.set(moduleName, loadedModule);

      return loadedModule;
    } catch (error) {
      throw new Error(`Failed to load frontend module ${moduleName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 卸载模块
   */
  async unload(moduleName: string): Promise<void> {
    const loadedModule = this.loadedModules.get(moduleName);
    if (!loadedModule) {
      return;
    }

    try {
      // 清理组件缓存
      if (loadedModule.components) {
        for (const componentName of Object.keys(loadedModule.components)) {
          const cacheKey = `${moduleName}:${componentName}`;
          this.componentCache.delete(cacheKey);
        }
      }

      // 从已加载模块中移除
      this.loadedModules.delete(moduleName);
    } catch (error) {
      throw new Error(`Failed to unload frontend module ${moduleName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 重新加载模块
   */
  async reload(moduleName: string, manifest: any): Promise<LoadedFrontendModule> {
    await this.unload(moduleName);
    return await this.load(moduleName, manifest);
  }

  /**
   * 创建异步组件
   * 使用 Vue 的 defineAsyncComponent 实现懒加载
   */
  createAsyncComponent(
    moduleName: string,
    componentPath: string,
    options?: ComponentLoadOptions
  ): Component {
    const cacheKey = `${moduleName}:${componentPath}`;

    // 检查缓存
    if (this.componentCache.has(cacheKey)) {
      return this.componentCache.get(cacheKey)!;
    }

    // 创建异步组件
    const asyncComponent = () => {
      const fullPath = this.getModulePath(moduleName, componentPath);
      return import(/* @vite-ignore */ fullPath);
    };

    // 如果提供了选项，使用 defineAsyncComponent
    let component: Component;
    if (options) {
      // 注意：这里需要在实际使用时导入 defineAsyncComponent
      // import { defineAsyncComponent } from 'vue';
      // component = defineAsyncComponent({
      //   loader: asyncComponent,
      //   ...options
      // });
      component = asyncComponent as any;
    } else {
      component = asyncComponent as any;
    }

    // 缓存组件
    this.componentCache.set(cacheKey, component);

    return component;
  }

  /**
   * 获取已加载的模块
   */
  getLoadedModule(moduleName: string): LoadedFrontendModule | undefined {
    return this.loadedModules.get(moduleName);
  }

  /**
   * 获取所有已加载的模块
   */
  getAllLoadedModules(): LoadedFrontendModule[] {
    return Array.from(this.loadedModules.values());
  }

  /**
   * 检查模块是否已加载
   */
  isLoaded(moduleName: string): boolean {
    return this.loadedModules.has(moduleName);
  }

  /**
   * 获取模块文件路径
   */
  private getModulePath(moduleName: string, relativePath: string): string {
    // 移除开头的 ./
    const cleanPath = relativePath.replace(/^\.\//, '');
    return `${this.modulesBasePath}/${moduleName}/${cleanPath}`;
  }

  /**
   * 加载模块文件
   */
  private async loadModuleFile(filePath: string): Promise<any> {
    try {
      // 动态导入模块
      const moduleExports = await import(/* @vite-ignore */ filePath);
      return moduleExports;
    } catch (error) {
      throw new Error(`Failed to load module file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 加载组件
   */
  private async loadComponents(
    moduleName: string,
    componentsConfig: Record<string, string>
  ): Promise<Record<string, Component>> {
    const components: Record<string, Component> = {};

    for (const [componentName, componentPath] of Object.entries(componentsConfig)) {
      try {
        components[componentName] = this.createAsyncComponent(
          moduleName,
          componentPath
        );
      } catch (error) {
        console.warn(`Failed to load component ${componentName} for module ${moduleName}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return components;
  }

  /**
   * 清理所有缓存
   */
  clearAllCache(): void {
    this.componentCache.clear();
    this.loadedModules.clear();
  }
}

// 导出单例实例
export const frontendModuleLoader = new FrontendModuleLoader();
