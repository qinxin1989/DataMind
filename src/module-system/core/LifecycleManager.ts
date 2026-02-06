/**
 * 模块生命周期管理器
 * 负责管理模块的安装、启用、禁用、卸载流程
 */

import { ModuleRegistry } from './ModuleRegistry';
import { BackendModuleLoader } from './BackendModuleLoader';
import { FrontendModuleLoader } from './FrontendModuleLoader';
import { BackendRouteManager } from './BackendRouteManager';
import { FrontendRouteManager } from './FrontendRouteManager';
import { MenuManager } from './MenuManager';
import { PermissionManager } from './PermissionManager';
import { MigrationManager } from './MigrationManager';
import type { ModuleManifest, ModuleHooks } from '../types';

/**
 * 生命周期管理器类
 */
export class LifecycleManager {
  private registry: ModuleRegistry;
  private backendLoader: BackendModuleLoader;
  private frontendLoader: FrontendModuleLoader;
  private menuManager: MenuManager;
  private permissionManager: PermissionManager;
  private migrationManager: MigrationManager;

  constructor(
    registry: ModuleRegistry,
    backendLoader: BackendModuleLoader,
    frontendLoader: FrontendModuleLoader,
    menuManager: MenuManager,
    permissionManager: PermissionManager,
    migrationManager: MigrationManager
  ) {
    this.registry = registry;
    this.backendLoader = backendLoader;
    this.frontendLoader = frontendLoader;
    this.menuManager = menuManager;
    this.permissionManager = permissionManager;
    this.migrationManager = migrationManager;
  }

  /**
   * 安装模块
   */
  async install(manifest: ModuleManifest): Promise<void> {
    const moduleName = manifest.name;

    try {
      // 检查依赖
      const depCheck = await this.registry.checkDependencies(moduleName);
      if (!depCheck.satisfied) {
        throw new Error(`Dependencies not satisfied: ${depCheck.missing.join(', ')}`);
      }

      // 执行 beforeInstall 钩子
      await this.executeHook(moduleName, manifest, 'beforeInstall');

      // 注册模块
      await this.registry.register(manifest);

      // 执行数据库迁移
      if (manifest.backend?.migrations) {
        await this.migrationManager.migrate(moduleName);
      }

      // 注册权限
      if (manifest.permissions) {
        await this.permissionManager.registerPermissions(moduleName, manifest.permissions);
      }

      // 执行 afterInstall 钩子
      await this.executeHook(moduleName, manifest, 'afterInstall');

      console.log(`Module ${moduleName} installed successfully`);
    } catch (error) {
      throw new Error(`Failed to install module ${moduleName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 启用模块
   */
  async enable(moduleName: string): Promise<void> {
    try {
      const moduleInfo = await this.registry.getModule(moduleName);
      if (!moduleInfo) {
        throw new Error(`Module ${moduleName} not found`);
      }

      const manifest = moduleInfo.manifest;
      if (!manifest) {
        throw new Error(`Module ${moduleName} manifest is undefined`);
      }

      // 检查依赖模块是否已启用
      if (manifest.dependencies && typeof manifest.dependencies === 'object') {
        for (const depName of Object.keys(manifest.dependencies)) {
          const depInfo = await this.registry.getModule(depName);
          if (!depInfo || depInfo.status !== 'enabled') {
            throw new Error(`Dependency ${depName} is not enabled`);
          }
        }
      }

      // 执行 beforeEnable 钩子
      await this.executeHook(moduleName, manifest, 'beforeEnable');

      // 加载模块代码
      if (manifest.backend) {
        const loadedModule = await this.backendLoader.load(moduleName, manifest);

        // 注册后端路由
        if (loadedModule.router && manifest.backend.routes) {
          const routeManager = BackendRouteManager.getInstance();
          routeManager.registerRoutes(moduleName, loadedModule.router, manifest.backend.routes.prefix);
        }
      }

      /* 
      // 后端暂不需要加载前端模块，跳过以避免路径和 .vue 文件导入错误
      if (manifest.frontend) {
        await this.frontendLoader.load(moduleName, manifest);
      }
      */

      // 显示菜单
      if (manifest.menus) {
        await this.menuManager.registerMenus(moduleName, manifest.menus);
        await this.menuManager.showModuleMenus(moduleName);
      }

      // 更新模块状态
      await this.registry.updateModuleStatus(moduleName, 'enabled');

      // 执行 afterEnable 钩子
      await this.executeHook(moduleName, manifest, 'afterEnable');

      console.log(`Module ${moduleName} enabled successfully`);
    } catch (error) {
      throw new Error(`Failed to enable module ${moduleName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 禁用模块
   */
  async disable(moduleName: string): Promise<void> {
    try {
      const moduleInfo = await this.registry.getModule(moduleName);
      if (!moduleInfo) {
        throw new Error(`Module ${moduleName} not found`);
      }

      const manifest = moduleInfo.manifest;

      // 检查是否有其他模块依赖
      const allModules = await this.registry.getAllModules();
      for (const mod of allModules) {
        if (mod.manifest.dependencies && typeof mod.manifest.dependencies === 'object' && mod.manifest.dependencies[moduleName]) {
          if (mod.status === 'enabled') {
            throw new Error(`Module ${mod.manifest.name} depends on ${moduleName}`);
          }
        }
      }

      // 执行 beforeDisable 钩子
      await this.executeHook(moduleName, manifest, 'beforeDisable');

      // 注销后端路由
      if (manifest.backend?.routes) {
        const routeManager = BackendRouteManager.getInstance();
        routeManager.unregisterRoutes(moduleName);
      }

      // 卸载模块代码
      await this.backendLoader.unload(moduleName);
      await this.frontendLoader.unload(moduleName);

      // 隐藏菜单
      if (manifest.menus) {
        await this.menuManager.hideModuleMenus(moduleName);
      }

      // 更新模块状态
      await this.registry.updateModuleStatus(moduleName, 'disabled');

      // 执行 afterDisable 钩子
      await this.executeHook(moduleName, manifest, 'afterDisable');

      console.log(`Module ${moduleName} disabled successfully`);
    } catch (error) {
      throw new Error(`Failed to disable module ${moduleName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 卸载模块
   */
  async uninstall(moduleName: string): Promise<void> {
    try {
      const moduleInfo = await this.registry.getModule(moduleName);
      if (!moduleInfo) {
        throw new Error(`Module ${moduleName} not found`);
      }

      const manifest = moduleInfo.manifest;

      // 确保模块已禁用
      if (moduleInfo.status === 'enabled') {
        await this.disable(moduleName);
      }

      // 检查是否有其他模块依赖
      const allModules = await this.registry.getAllModules();
      for (const mod of allModules) {
        if (mod.manifest.dependencies && typeof mod.manifest.dependencies === 'object' && mod.manifest.dependencies[moduleName]) {
          throw new Error(`Module ${mod.manifest.name} depends on ${moduleName}`);
        }
      }

      // 执行 beforeUninstall 钩子
      await this.executeHook(moduleName, manifest, 'beforeUninstall');

      // 删除权限
      if (manifest.permissions) {
        await this.permissionManager.unregisterPermissions(moduleName);
      }

      // 删除菜单
      if (manifest.menus) {
        await this.menuManager.unregisterMenus(moduleName);
      }

      // 从注册表注销
      await this.registry.unregister(moduleName);

      // 执行 afterUninstall 钩子
      await this.executeHook(moduleName, manifest, 'afterUninstall');

      console.log(`Module ${moduleName} uninstalled successfully`);
    } catch (error) {
      throw new Error(`Failed to uninstall module ${moduleName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 执行钩子
   */
  private async executeHook(
    moduleName: string,
    manifest: ModuleManifest,
    hookName: keyof ModuleHooks
  ): Promise<void> {
    try {
      if (!manifest.hooks || !manifest.hooks[hookName]) {
        return;
      }

      const loadedModule = this.backendLoader.getLoadedModule(moduleName);
      if (loadedModule && loadedModule.hooks && loadedModule.hooks[hookName]) {
        await loadedModule.hooks[hookName]!();
        console.log(`Hook ${hookName} executed for module ${moduleName}`);
      }
    } catch (error) {
      console.error(`Hook ${hookName} failed for module ${moduleName}:`, error);
      throw error;
    }
  }
}

// 导出工厂函数
export function createLifecycleManager(
  registry: ModuleRegistry,
  backendLoader: BackendModuleLoader,
  frontendLoader: FrontendModuleLoader,
  menuManager: MenuManager,
  permissionManager: PermissionManager,
  migrationManager: MigrationManager
): LifecycleManager {
  return new LifecycleManager(
    registry,
    backendLoader,
    frontendLoader,
    menuManager,
    permissionManager,
    migrationManager
  );
}
