/**
 * 模块注册表
 * 负责管理所有模块的注册信息和状态
 */

import { v4 as uuidv4 } from 'uuid';
import { pool } from '../../admin/core/database';
import {
  ModuleManifest,
  ModuleInfo,
  ModuleStatus,
  DependencyCheckResult,
  DependencyTree,
  ModuleRecord,
  ModuleDependencyRecord
} from '../types';
import semver from 'semver';

export class ModuleRegistry {
  private moduleCache: Map<string, ModuleInfo> = new Map();
  private initialized: boolean = false;

  /**
   * 初始化注册表（从数据库加载所有模块）
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query<ModuleRecord[]>(
        'SELECT * FROM sys_modules'
      );

      for (const row of rows) {
        const manifest = JSON.parse(row.manifest) as ModuleManifest;
        this.moduleCache.set(row.name, {
          manifest,
          status: row.status,
          error: row.error_message,
          loadedAt: row.updated_at
        });
      }

      this.initialized = true;
      console.log(`ModuleRegistry initialized with ${this.moduleCache.size} modules`);
    } finally {
      connection.release();
    }
  }

  /**
   * 注册模块
   */
  async register(manifest: ModuleManifest): Promise<void> {
    // 验证清单
    this.validateManifest(manifest);

    // 检查模块是否已存在
    if (await this.hasModule(manifest.name)) {
      throw new Error(`Module ${manifest.name} is already registered`);
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 插入模块记录
      const moduleId = uuidv4();
      await connection.execute(
        `INSERT INTO sys_modules (
          id, name, display_name, version, description, author, type, category,
          manifest, status, installed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          moduleId,
          manifest.name,
          manifest.displayName,
          manifest.version,
          manifest.description || null,
          manifest.author || null,
          manifest.type || null,
          manifest.category || null,
          JSON.stringify(manifest),
          'installed'
        ]
      );

      // 插入依赖关系
      if (manifest.dependencies) {
        for (const [depName, versionRange] of Object.entries(manifest.dependencies)) {
          await connection.execute(
            `INSERT INTO sys_module_dependencies (
              id, module_name, dependency_name, version_range
            ) VALUES (?, ?, ?, ?)`,
            [uuidv4(), manifest.name, depName, versionRange]
          );
        }
      }

      await connection.commit();

      // 更新缓存
      this.moduleCache.set(manifest.name, {
        manifest,
        status: 'installed',
        loadedAt: new Date()
      });

      console.log(`Module ${manifest.name} registered successfully`);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 注销模块
   */
  async unregister(moduleName: string): Promise<void> {
    // 检查模块是否存在
    if (!await this.hasModule(moduleName)) {
      throw new Error(`Module ${moduleName} is not registered`);
    }

    // 检查是否有其他模块依赖此模块
    const dependents = await this.getDependents(moduleName);
    if (dependents.length > 0) {
      throw new Error(
        `Cannot unregister module ${moduleName}. ` +
        `It is required by: ${dependents.join(', ')}`
      );
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 删除模块记录（级联删除依赖关系、迁移记录、配置）
      await connection.execute(
        'DELETE FROM sys_modules WHERE name = ?',
        [moduleName]
      );

      await connection.commit();

      // 更新缓存
      this.moduleCache.delete(moduleName);

      console.log(`Module ${moduleName} unregistered successfully`);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 获取模块信息
   */
  async getModule(moduleName: string): Promise<ModuleInfo | null> {
    // 先从缓存获取
    if (this.moduleCache.has(moduleName)) {
      return this.moduleCache.get(moduleName)!;
    }

    // 从数据库获取
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query<ModuleRecord[]>(
        'SELECT * FROM sys_modules WHERE name = ?',
        [moduleName]
      );

      if (rows.length === 0) {
        return null;
      }

      const row = rows[0];
      const manifest = JSON.parse(row.manifest) as ModuleManifest;
      const moduleInfo: ModuleInfo = {
        manifest,
        status: row.status,
        error: row.error_message,
        loadedAt: row.updated_at
      };

      // 更新缓存
      this.moduleCache.set(moduleName, moduleInfo);

      return moduleInfo;
    } finally {
      connection.release();
    }
  }

  /**
   * 获取所有模块
   */
  async getAllModules(): Promise<ModuleInfo[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    return Array.from(this.moduleCache.values());
  }

  /**
   * 获取已启用的模块
   */
  async getEnabledModules(): Promise<ModuleInfo[]> {
    const allModules = await this.getAllModules();
    return allModules.filter(m => m.status === 'enabled');
  }

  /**
   * 检查模块是否存在
   */
  async hasModule(moduleName: string): Promise<boolean> {
    return (await this.getModule(moduleName)) !== null;
  }

  /**
   * 更新模块状态
   */
  async updateModuleStatus(
    moduleName: string,
    status: ModuleStatus,
    error?: string
  ): Promise<void> {
    const connection = await pool.getConnection();
    try {
      const statusField = status === 'enabled' ? 'enabled_at' :
                         status === 'disabled' ? 'disabled_at' : null;

      await connection.execute(
        `UPDATE sys_modules 
         SET status = ?, error_message = ?, ${statusField ? `${statusField} = NOW(),` : ''} updated_at = NOW()
         WHERE name = ?`,
        [status, error || null, moduleName]
      );

      // 更新缓存
      const moduleInfo = this.moduleCache.get(moduleName);
      if (moduleInfo) {
        moduleInfo.status = status;
        moduleInfo.error = error;
      }

      console.log(`Module ${moduleName} status updated to ${status}`);
    } finally {
      connection.release();
    }
  }

  /**
   * 检查依赖关系
   */
  async checkDependencies(moduleName: string): Promise<DependencyCheckResult> {
    const moduleInfo = await this.getModule(moduleName);
    if (!moduleInfo) {
      throw new Error(`Module ${moduleName} not found`);
    }

    const result: DependencyCheckResult = {
      satisfied: true,
      missing: [],
      conflicts: []
    };

    const dependencies = moduleInfo.manifest.dependencies || {};

    for (const [depName, versionRange] of Object.entries(dependencies)) {
      const depInfo = await this.getModule(depName);

      if (!depInfo) {
        result.satisfied = false;
        result.missing.push(depName);
      } else {
        // 检查版本是否满足要求
        if (!semver.satisfies(depInfo.manifest.version, versionRange)) {
          result.satisfied = false;
          result.conflicts.push({
            module: depName,
            required: versionRange,
            installed: depInfo.manifest.version
          });
        }
      }
    }

    return result;
  }

  /**
   * 获取依赖树
   */
  async getDependencyTree(moduleName: string): Promise<DependencyTree> {
    const moduleInfo = await this.getModule(moduleName);
    if (!moduleInfo) {
      throw new Error(`Module ${moduleName} not found`);
    }

    return await this.buildDependencyTree(moduleInfo.manifest, new Set());
  }

  /**
   * 获取依赖此模块的模块列表
   */
  private async getDependents(moduleName: string): Promise<string[]> {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query<ModuleDependencyRecord[]>(
        'SELECT module_name FROM sys_module_dependencies WHERE dependency_name = ?',
        [moduleName]
      );

      return rows.map(r => r.module_name);
    } finally {
      connection.release();
    }
  }

  /**
   * 构建依赖树（递归）
   */
  private async buildDependencyTree(
    manifest: ModuleManifest,
    visited: Set<string>
  ): Promise<DependencyTree> {
    // 防止循环依赖
    if (visited.has(manifest.name)) {
      throw new Error(`Circular dependency detected: ${manifest.name}`);
    }

    visited.add(manifest.name);

    const dependencies: DependencyTree[] = [];
    const deps = manifest.dependencies || {};

    for (const depName of Object.keys(deps)) {
      const depInfo = await this.getModule(depName);
      if (depInfo) {
        dependencies.push(
          await this.buildDependencyTree(depInfo.manifest, new Set(visited))
        );
      }
    }

    return {
      name: manifest.name,
      version: manifest.version,
      dependencies
    };
  }

  /**
   * 验证模块清单
   */
  private validateManifest(manifest: ModuleManifest): void {
    if (!manifest.name) {
      throw new Error('Module name is required');
    }

    if (!manifest.displayName) {
      throw new Error('Module displayName is required');
    }

    if (!manifest.version) {
      throw new Error('Module version is required');
    }

    // 验证版本号格式
    if (!semver.valid(manifest.version)) {
      throw new Error(`Invalid version format: ${manifest.version}`);
    }

    // 验证模块名称格式（kebab-case）
    if (!/^[a-z][a-z0-9-]*$/.test(manifest.name)) {
      throw new Error(
        `Invalid module name: ${manifest.name}. ` +
        'Module name must be in kebab-case format (lowercase letters, numbers, and hyphens)'
      );
    }
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.moduleCache.clear();
    this.initialized = false;
  }
}

// 导出单例实例
export const moduleRegistry = new ModuleRegistry();
