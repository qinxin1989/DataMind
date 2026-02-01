/**
 * 后端模块加载器
 * 负责动态加载和卸载后端模块
 */

import { Router } from 'express';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ModuleManifest } from '../types';
import { ModuleSigner } from '../security/ModuleSigner';
import { permissionManager, PermissionLevel, ModulePermissions } from '../security/PermissionManager';
import { resourceMonitor } from '../security/ResourceMonitor';

/**
 * 加载的模块接口
 */
export interface LoadedBackendModule {
  name: string;
  router?: Router;
  service?: any;
  hooks?: ModuleHooks;
  exports?: any;
}

/**
 * 模块钩子接口
 */
export interface ModuleHooks {
  beforeInstall?: () => Promise<void>;
  afterInstall?: () => Promise<void>;
  beforeUninstall?: () => Promise<void>;
  afterUninstall?: () => Promise<void>;
  beforeEnable?: () => Promise<void>;
  afterEnable?: () => Promise<void>;
  beforeDisable?: () => Promise<void>;
  afterDisable?: () => Promise<void>;
}

/**
 * 后端模块加载器类
 */
export class BackendModuleLoader {
  private loadedModules: Map<string, LoadedBackendModule> = new Map();
  private moduleCache: Map<string, any> = new Map();
  private modulesDirectory: string;
  private signer: ModuleSigner;
  private signatureVerificationEnabled: boolean = true;
  private sandboxEnabled: boolean = true;

  constructor(
    modulesDirectory: string = 'modules', 
    enableSignatureVerification: boolean = true,
    enableSandbox: boolean = true
  ) {
    this.modulesDirectory = path.resolve(process.cwd(), modulesDirectory);
    this.signer = new ModuleSigner();
    this.signatureVerificationEnabled = enableSignatureVerification;
    this.sandboxEnabled = enableSandbox;
  }

  /**
   * 加载模块
   */
  async load(moduleName: string, manifest: ModuleManifest): Promise<LoadedBackendModule> {
    // 检查是否已加载
    if (this.loadedModules.has(moduleName)) {
      return this.loadedModules.get(moduleName)!;
    }

    try {
      const modulePath = path.join(this.modulesDirectory, moduleName);
      
      // 验证模块目录存在
      await this.validateModuleDirectory(modulePath);

      // 验证模块签名
      if (this.signatureVerificationEnabled) {
        const isValid = await this.verifyModuleSignature(modulePath, moduleName);
        if (!isValid) {
          throw new Error(`Module signature verification failed: ${moduleName}`);
        }
      }

      // 初始化沙箱
      if (this.sandboxEnabled) {
        this.initializeSandbox(moduleName, manifest);
      }

      const loadedModule: LoadedBackendModule = {
        name: moduleName
      };

      // 加载后端入口
      if (manifest.backend?.entry) {
        const entryPath = path.join(modulePath, manifest.backend.entry);
        const moduleExports = await this.loadModuleFile(entryPath);
        loadedModule.exports = moduleExports;

        // 提取常见导出
        if (moduleExports.router) {
          loadedModule.router = moduleExports.router;
        }
        if (moduleExports.service) {
          loadedModule.service = moduleExports.service;
        }
      }

      // 加载路由文件
      if (manifest.backend?.routes?.file) {
        const routesPath = path.join(modulePath, manifest.backend.routes.file);
        const routesModule = await this.loadModuleFile(routesPath);
        if (routesModule.default || routesModule.router) {
          loadedModule.router = routesModule.default || routesModule.router;
        }
      }

      // 加载钩子
      if (manifest.hooks) {
        loadedModule.hooks = await this.loadHooks(modulePath, manifest.hooks);
      }

      // 缓存加载的模块
      this.loadedModules.set(moduleName, loadedModule);
      
      return loadedModule;
    } catch (error) {
      throw new Error(`Failed to load module ${moduleName}: ${error instanceof Error ? error.message : String(error)}`);
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
      // 清理沙箱资源
      if (this.sandboxEnabled) {
        this.cleanupSandbox(moduleName);
      }

      // 清理模块缓存
      const modulePath = path.join(this.modulesDirectory, moduleName);
      this.clearModuleCache(modulePath);

      // 从已加载模块中移除
      this.loadedModules.delete(moduleName);
    } catch (error) {
      throw new Error(`Failed to unload module ${moduleName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 重新加载模块
   */
  async reload(moduleName: string, manifest: ModuleManifest): Promise<LoadedBackendModule> {
    await this.unload(moduleName);
    return await this.load(moduleName, manifest);
  }

  /**
   * 获取已加载的模块
   */
  getLoadedModule(moduleName: string): LoadedBackendModule | undefined {
    return this.loadedModules.get(moduleName);
  }

  /**
   * 获取所有已加载的模块
   */
  getAllLoadedModules(): LoadedBackendModule[] {
    return Array.from(this.loadedModules.values());
  }

  /**
   * 检查模块是否已加载
   */
  isLoaded(moduleName: string): boolean {
    return this.loadedModules.has(moduleName);
  }

  /**
   * 验证模块目录
   */
  private async validateModuleDirectory(modulePath: string): Promise<void> {
    try {
      const stats = await fs.stat(modulePath);
      if (!stats.isDirectory()) {
        throw new Error(`Module path is not a directory: ${modulePath}`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Module directory not found: ${modulePath}`);
      }
      throw error;
    }
  }

  /**
   * 加载模块文件
   */
  private async loadModuleFile(filePath: string): Promise<any> {
    // 检查缓存
    if (this.moduleCache.has(filePath)) {
      return this.moduleCache.get(filePath);
    }

    try {
      // 验证文件存在
      await fs.access(filePath);

      // 动态导入模块
      const absolutePath = path.resolve(filePath);
      const moduleExports = await import(absolutePath);

      // 缓存模块
      this.moduleCache.set(filePath, moduleExports);

      return moduleExports;
    } catch (error) {
      throw new Error(`Failed to load module file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 加载钩子函数
   */
  private async loadHooks(modulePath: string, hooksConfig: Record<string, string>): Promise<ModuleHooks> {
    const hooks: ModuleHooks = {};

    for (const [hookName, hookFile] of Object.entries(hooksConfig)) {
      if (hookFile) {
        try {
          const hookPath = path.join(modulePath, hookFile);
          const hookModule = await this.loadModuleFile(hookPath);
          const hookFunction = hookModule.default || hookModule[hookName];
          
          if (typeof hookFunction === 'function') {
            hooks[hookName as keyof ModuleHooks] = hookFunction;
          }
        } catch (error) {
          console.warn(`Failed to load hook ${hookName} for module: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    return hooks;
  }

  /**
   * 清理模块缓存
   */
  private clearModuleCache(modulePath: string): void {
    // 清理所有与该模块相关的缓存
    const keysToDelete: string[] = [];
    
    for (const key of this.moduleCache.keys()) {
      if (key.startsWith(modulePath)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.moduleCache.delete(key);
      
      // 清理 Node.js require 缓存
      const resolvedPath = path.resolve(key);
      if (require.cache[resolvedPath]) {
        delete require.cache[resolvedPath];
      }
    }
  }

  /**
   * 清理所有缓存
   */
  clearAllCache(): void {
    this.moduleCache.clear();
    this.loadedModules.clear();
  }

  /**
   * 验证模块签名
   */
  private async verifyModuleSignature(modulePath: string, moduleName: string): Promise<boolean> {
    try {
      // 检查签名文件是否存在
      const signaturePath = path.join(modulePath, 'module.signature');
      try {
        await fs.access(signaturePath);
      } catch (err) {
        console.warn(`Module ${moduleName} has no signature file, skipping verification`);
        return true; // 如果没有签名文件,允许加载 (向后兼容)
      }

      // 验证签名
      const isValid = await this.signer.verifyModule(modulePath);
      
      if (!isValid) {
        console.error(`Module ${moduleName} signature verification failed`);
        return false;
      }

      console.log(`Module ${moduleName} signature verified successfully`);
      return true;
    } catch (error) {
      console.error(`Error verifying module ${moduleName}:`, error);
      return false;
    }
  }

  /**
   * 启用/禁用签名验证
   */
  setSignatureVerification(enabled: boolean): void {
    this.signatureVerificationEnabled = enabled;
  }

  /**
   * 获取签名验证状态
   */
  isSignatureVerificationEnabled(): boolean {
    return this.signatureVerificationEnabled;
  }

  /**
   * 初始化模块沙箱
   */
  private initializeSandbox(moduleName: string, manifest: ModuleManifest): void {
    // 确定权限级别
    const permissionLevel = this.determinePermissionLevel(manifest);
    
    // 设置基础权限
    const permissions: ModulePermissions = {
      level: permissionLevel,
      allowedPaths: [
        path.join(this.modulesDirectory, moduleName), // 模块自己的目录
        path.join(process.cwd(), 'uploads'), // 上传目录
        path.join(process.cwd(), 'data') // 数据目录
      ]
    };

    // 从 manifest 中读取额外的权限配置
    if (manifest.permissions) {
      if (manifest.permissions.allowedDomains) {
        permissions.allowedDomains = manifest.permissions.allowedDomains;
      }
      if (manifest.permissions.allowedPaths) {
        permissions.allowedPaths = [
          ...permissions.allowedPaths,
          ...manifest.permissions.allowedPaths.map(p => path.join(process.cwd(), p))
        ];
      }
    }

    // 设置权限
    permissionManager.setModulePermissions(moduleName, permissions);

    // 设置资源限制
    resourceMonitor.setResourceLimits(moduleName, {
      maxMemoryMB: 512,
      maxCpuPercent: 80,
      maxExecutionTimeMs: 30000
    });

    // 开始监控
    resourceMonitor.startMonitoring(moduleName);
  }

  /**
   * 清理模块沙箱
   */
  private cleanupSandbox(moduleName: string): void {
    // 停止监控
    resourceMonitor.stopMonitoring(moduleName);
    
    // 清理资源记录
    resourceMonitor.clearModuleResources(moduleName);
    
    // 移除权限
    permissionManager.removeModulePermissions(moduleName);
  }

  /**
   * 确定模块权限级别
   */
  private determinePermissionLevel(manifest: ModuleManifest): PermissionLevel {
    // 系统模块拥有完全权限
    if (manifest.category === 'system') {
      return PermissionLevel.FULL;
    }

    // 根据 manifest 中的权限声明确定级别
    if (manifest.permissions?.level) {
      return manifest.permissions.level as PermissionLevel;
    }

    // 默认为标准权限
    return PermissionLevel.STANDARD;
  }

  /**
   * 启用/禁用沙箱
   */
  setSandbox(enabled: boolean): void {
    this.sandboxEnabled = enabled;
  }

  /**
   * 获取沙箱状态
   */
  isSandboxEnabled(): boolean {
    return this.sandboxEnabled;
  }

  /**
   * 获取模块资源使用情况
   */
  getModuleResourceUsage(moduleName: string) {
    return {
      current: resourceMonitor.getCurrentUsage(moduleName),
      average: resourceMonitor.getAverageUsage(moduleName),
      peak: resourceMonitor.getPeakUsage(moduleName),
      limits: resourceMonitor.getResourceLimits(moduleName)
    };
  }
}

// 导出单例实例
export const backendModuleLoader = new BackendModuleLoader();
