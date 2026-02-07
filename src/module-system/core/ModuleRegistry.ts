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
import { RowDataPacket } from 'mysql2';

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
      // 获取所有模块基本信息
      const [moduleRows] = await connection.query<(ModuleRecord & RowDataPacket)[]>(
        'SELECT * FROM sys_modules'
      );

      for (const moduleRow of moduleRows) {
        try {
          // 获取原始 manifest 数据
          let manifestData: any = {};
          if (moduleRow.manifest) {
            manifestData = typeof moduleRow.manifest === 'string'
              ? JSON.parse(moduleRow.manifest)
              : moduleRow.manifest;
          }

          // 构建完整的manifest对象
          const manifest: ModuleManifest = {
            ...manifestData,
            name: moduleRow.name,
            displayName: moduleRow.display_name,
            version: moduleRow.version,
            description: moduleRow.description || manifestData.description,
            author: moduleRow.author || manifestData.author,
            license: moduleRow.license || manifestData.license,
            type: (moduleRow.type as any) || manifestData.type,
            category: moduleRow.category || manifestData.category,
          };

          // 如果没有从 manifestData 中获取到必要的数组，初始化它们
          if (!manifest.dependencies) manifest.dependencies = {};
          if (!manifest.tags) manifest.tags = [];
          if (!manifest.permissions) manifest.permissions = [];
          if (!manifest.menus) manifest.menus = [];
          if (!manifest.api) manifest.api = { endpoints: [] };

          // 获取标签
          const [tagRows] = await connection.query<RowDataPacket[]>(
            'SELECT tag FROM sys_module_tags WHERE module_name = ?',
            [moduleRow.name]
          );
          manifest.tags = tagRows.map((row: any) => row.tag);

          // 获取依赖
          const [depRows] = await connection.query<RowDataPacket[]>(
            'SELECT dependency_name, version_range FROM sys_module_dependencies WHERE module_name = ?',
            [moduleRow.name]
          );
          for (const dep of depRows as any[]) {
            manifest.dependencies![dep.dependency_name] = dep.version_range;
          }

          // 获取权限
          const [permRows] = await connection.query<RowDataPacket[]>(
            'SELECT code, name, description FROM sys_module_permissions WHERE module_name = ?',
            [moduleRow.name]
          );
          manifest.permissions = permRows.map((row: any) => ({
            code: row.code,
            name: row.name,
            description: row.description
          }));

          // 获取菜单
          const [menuRows] = await connection.query<RowDataPacket[]>(
            'SELECT menu_id, title, path, icon, parent_id, sort_order, permission_code FROM sys_module_menus WHERE module_name = ?',
            [moduleRow.name]
          );
          manifest.menus = menuRows.map((row: any) => ({
            id: row.menu_id,
            title: row.title,
            path: row.path,
            icon: row.icon,
            parentId: row.parent_id,
            sortOrder: row.sort_order,
            permission: row.permission_code
          }));

          // 获取后端配置
          const [backendRows] = await connection.query<RowDataPacket[]>(
            'SELECT entry_file, routes_prefix, routes_file FROM sys_module_backend WHERE module_name = ?',
            [moduleRow.name]
          );
          if (backendRows.length > 0) {
            const backend = backendRows[0] as any;
            manifest.backend = {
              entry: backend.entry_file
            };
            if (backend.routes_prefix || backend.routes_file) {
              manifest.backend.routes = {
                prefix: backend.routes_prefix,
                file: backend.routes_file
              };
            }
          }

          // 获取前端配置
          const [frontendRows] = await connection.query<RowDataPacket[]>(
            'SELECT entry_file, routes_file FROM sys_module_frontend WHERE module_name = ?',
            [moduleRow.name]
          );
          if (frontendRows.length > 0) {
            const frontend = frontendRows[0] as any;
            manifest.frontend = {
              entry: frontend.entry_file,
              routes: frontend.routes_file
            };
          }

          // 获取API端点
          const [apiRows] = await connection.query<RowDataPacket[]>(
            'SELECT method, path, description, permission_code FROM sys_module_api_endpoints WHERE module_name = ?',
            [moduleRow.name]
          );
          manifest.api!.endpoints = apiRows.map((row: any) => ({
            method: row.method,
            path: row.path,
            description: row.description,
            permission: row.permission_code
          }));

          this.moduleCache.set(moduleRow.name, {
            manifest,
            status: moduleRow.status,
            error: moduleRow.error_message,
            loadedAt: moduleRow.updated_at
          });
        } catch (error) {
          console.error(`Failed to load module ${moduleRow.name}:`, error);
        }
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

      // 插入主模块记录
      const moduleId = uuidv4();
      await connection.execute(
        `INSERT INTO sys_modules (
          id, name, display_name, version, description, author, license, type, category, manifest, status, installed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          moduleId,
          manifest.name,
          manifest.displayName,
          manifest.version,
          manifest.description || null,
          manifest.author || null,
          manifest.license || null,
          manifest.type || null,
          manifest.category || null,
          JSON.stringify(manifest),
          'installed'
        ]
      );

      // 插入标签
      if (manifest.tags && Array.isArray(manifest.tags)) {
        for (const tag of manifest.tags) {
          await connection.execute(
            `INSERT INTO sys_module_tags (id, module_name, tag) VALUES (?, ?, ?)`,
            [uuidv4(), manifest.name, tag]
          );
        }
      }

      // 插入依赖关系
      if (manifest.dependencies) {
        for (const [depName, versionRange] of Object.entries(manifest.dependencies)) {
          await connection.execute(
            `INSERT INTO sys_module_dependencies (id, module_name, dependency_name, version_range) VALUES (?, ?, ?, ?)`,
            [uuidv4(), manifest.name, depName, versionRange]
          );
        }
      }

      // 插入权限（支持字符串数组或对象数组）
      if (manifest.permissions && Array.isArray(manifest.permissions)) {
        for (const perm of manifest.permissions) {
          // 支持字符串格式：["module:action"]
          if (typeof perm === 'string') {
            const pStr = perm as string;
            const parts = pStr.split(':');
            const code = pStr;
            const name = parts[1] ? `${parts[0]} ${parts[1]}` : pStr;
            const description = `Permission to ${name}`;
            await connection.execute(
              `INSERT INTO sys_module_permissions (id, module_name, code, name, description) VALUES (?, ?, ?, ?, ?)`,
              [uuidv4(), manifest.name, code, name, description]
            );
          }
          // 支持对象格式：{code, name, description}
          else if (typeof perm === 'object' && (perm as any).code) {
            const pObj = perm as any;
            await connection.execute(
              `INSERT INTO sys_module_permissions (id, module_name, code, name, description) VALUES (?, ?, ?, ?, ?)`,
              [uuidv4(), manifest.name, pObj.code, pObj.name, pObj.description || null]
            );
          }
        }
      }

      // 插入菜单
      if (manifest.menus && Array.isArray(manifest.menus)) {
        for (const menu of manifest.menus) {
          await connection.execute(
            `INSERT INTO sys_module_menus (id, module_name, menu_id, title, path, icon, parent_id, sort_order, permission_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [uuidv4(), manifest.name, menu.id, menu.title, menu.path, menu.icon || null, menu.parentId || null, menu.sortOrder || 0, menu.permission || null]
          );
        }
      }

      // 插入后端配置
      if (manifest.backend) {
        await connection.execute(
          `INSERT INTO sys_module_backend (module_name, entry_file, routes_prefix, routes_file) VALUES (?, ?, ?, ?)`,
          [manifest.name, manifest.backend.entry, manifest.backend.routes?.prefix || null, manifest.backend.routes?.file || null]
        );
      }

      // 插入前端配置
      if (manifest.frontend) {
        await connection.execute(
          `INSERT INTO sys_module_frontend (module_name, entry_file, routes_file) VALUES (?, ?, ?)`,
          [manifest.name, manifest.frontend.entry, manifest.frontend.routes || null]
        );
      }

      // 插入API端点
      if (manifest.api && manifest.api.endpoints && Array.isArray(manifest.api.endpoints)) {
        for (const endpoint of manifest.api.endpoints) {
          await connection.execute(
            `INSERT INTO sys_module_api_endpoints (id, module_name, method, path, description, permission_code) VALUES (?, ?, ?, ?, ?, ?)`,
            [uuidv4(), manifest.name, endpoint.method, endpoint.path, endpoint.description || null, endpoint.permission || null]
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

      // 更新缓存 - 先删除缓存，防止 getModule 返回过期数据
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
      const [rows] = await connection.query<(ModuleRecord & RowDataPacket)[]>(
        'SELECT * FROM sys_modules WHERE name = ?',
        [moduleName]
      );

      if (rows.length === 0) {
        return null;
      }

      const moduleRow = rows[0];

      // 构建完整的manifest对象
      const manifest: ModuleManifest = {
        name: moduleRow.name,
        displayName: moduleRow.display_name,
        version: moduleRow.version,
        description: moduleRow.description,
        author: moduleRow.author,
        license: moduleRow.license,
        type: moduleRow.type as any,
        category: moduleRow.category,
        dependencies: {},
        tags: [],
        permissions: [],
        menus: [],
        api: { endpoints: [] }
      };

      // 获取相关数据
      const [tagRows] = await connection.query<RowDataPacket[]>('SELECT tag FROM sys_module_tags WHERE module_name = ?', [moduleName]);
      manifest.tags = tagRows.map((row: any) => row.tag);

      const [depRows] = await connection.query<RowDataPacket[]>('SELECT dependency_name, version_range FROM sys_module_dependencies WHERE module_name = ?', [moduleName]);
      for (const dep of depRows as any[]) {
        manifest.dependencies![dep.dependency_name] = dep.version_range;
      }

      const [permRows] = await connection.query<RowDataPacket[]>('SELECT code, name, description FROM sys_module_permissions WHERE module_name = ?', [moduleName]);
      manifest.permissions = permRows.map((row: any) => ({ code: row.code, name: row.name, description: row.description }));

      const [menuRows] = await connection.query<RowDataPacket[]>('SELECT menu_id, title, path, icon, parent_id, sort_order, permission_code FROM sys_module_menus WHERE module_name = ?', [moduleName]);
      manifest.menus = menuRows.map((row: any) => ({ id: row.menu_id, title: row.title, path: row.path, icon: row.icon, parentId: row.parent_id, sortOrder: row.sort_order, permission: row.permission_code }));

      const [backendRows] = await connection.query<RowDataPacket[]>('SELECT entry_file, routes_prefix, routes_file FROM sys_module_backend WHERE module_name = ?', [moduleName]);
      if (backendRows.length > 0) {
        const backend = backendRows[0] as any;
        manifest.backend = { entry: backend.entry_file };
        if (backend.routes_prefix || backend.routes_file) {
          manifest.backend.routes = { prefix: backend.routes_prefix, file: backend.routes_file };
        }
      }

      const [frontendRows] = await connection.query<RowDataPacket[]>('SELECT entry_file, routes_file FROM sys_module_frontend WHERE module_name = ?', [moduleName]);
      if (frontendRows.length > 0) {
        const frontend = frontendRows[0] as any;
        manifest.frontend = { entry: frontend.entry_file, routes: frontend.routes_file };
      }

      const [apiRows] = await connection.query<RowDataPacket[]>('SELECT method, path, description, permission_code FROM sys_module_api_endpoints WHERE module_name = ?', [moduleName]);
      manifest.api!.endpoints = apiRows.map((row: any) => ({ method: row.method, path: row.path, description: row.description, permission: row.permission_code }));

      const moduleInfo: ModuleInfo = {
        manifest,
        status: moduleRow.status,
        error: moduleRow.error_message,
        loadedAt: moduleRow.updated_at
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
      const [rows] = await connection.query<(ModuleDependencyRecord & RowDataPacket)[]>(
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
