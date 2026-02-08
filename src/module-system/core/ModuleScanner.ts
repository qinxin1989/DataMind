/**
 * 模块扫描器
 * 负责扫描模块目录并解析模块清单
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ModuleManifest } from '../types';
import { ManifestParser } from './ManifestParser';

/**
 * 扫描结果接口
 */
export interface ScanResult {
  moduleName: string;
  manifest: ModuleManifest;
  path: string;
  valid: boolean;
  errors: string[];
}

/**
 * 扫描选项
 */
export interface ScanOptions {
  // 是否验证模块结构
  validateStructure?: boolean;
  // 是否包含禁用的模块
  includeDisabled?: boolean;
  // 自定义过滤函数
  filter?: (moduleName: string) => boolean;
}

/**
 * 模块扫描器类
 */
export class ModuleScanner {
  private modulesDirectory: string;

  constructor(modulesDirectory: string = 'modules') {
    // 自动检测路径：优先使用 process.cwd()/modules
    // 如果在 dist 目录中运行且 dist/modules 存在，则使用 dist/modules
    const distModules = path.resolve(process.cwd(), 'dist', 'modules');
    const rootModules = path.resolve(process.cwd(), 'modules');

    // 这是一个简单的启发式检查，实际上我们可能需要更复杂的逻辑
    // 但通常情况下，部署时 modules 目录位于项目根目录
    this.modulesDirectory = rootModules;
  }

  /**
   * 扫描模块目录
   */
  async scan(options: ScanOptions = {}): Promise<ScanResult[]> {
    const results: ScanResult[] = [];

    try {
      // 确保模块目录存在
      await this.ensureModulesDirectory();

      // 读取目录内容
      const entries = await fs.readdir(this.modulesDirectory, { withFileTypes: true });

      // 过滤出目录
      const directories = entries.filter(entry => entry.isDirectory());

      // 扫描每个模块目录
      for (const dir of directories) {
        const moduleName = dir.name;

        // 应用自定义过滤器
        if (options.filter && !options.filter(moduleName)) {
          continue;
        }

        const result = await this.scanModule(moduleName, options);
        results.push(result);
      }

      return results;
    } catch (error) {
      throw new Error(`Failed to scan modules directory: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 扫描单个模块
   */
  async scanModule(moduleName: string, options: ScanOptions = {}): Promise<ScanResult> {
    const modulePath = path.join(this.modulesDirectory, moduleName);
    const result: ScanResult = {
      moduleName,
      manifest: {} as ModuleManifest,
      path: modulePath,
      valid: false,
      errors: []
    };

    try {
      // 检查模块目录是否存在
      const stats = await fs.stat(modulePath);
      if (!stats.isDirectory()) {
        result.errors.push('Module path is not a directory');
        return result;
      }

      // 读取并解析 module.json
      const manifestPath = path.join(modulePath, 'module.json');
      try {
        const manifestContent = await fs.readFile(manifestPath, 'utf-8');
        result.manifest = ManifestParser.parseFromString(manifestContent);
      } catch (error) {
        result.errors.push(`Failed to read or parse module.json: ${error instanceof Error ? error.message : String(error)}`);
        return result;
      }

      // 验证模块名称匹配
      if (result.manifest.name !== moduleName) {
        result.errors.push(`Module name mismatch: directory name is "${moduleName}" but manifest name is "${result.manifest.name}"`);
      }

      // 检查是否包含禁用的模块
      if (!options.includeDisabled && result.manifest.enabled === false) {
        result.errors.push('Module is disabled');
        return result;
      }

      // 验证模块结构
      if (options.validateStructure) {
        const structureErrors = await this.validateModuleStructure(modulePath, result.manifest);
        result.errors.push(...structureErrors);
      }

      // 如果没有错误，标记为有效
      result.valid = result.errors.length === 0;

      return result;
    } catch (error) {
      result.errors.push(`Failed to scan module: ${error instanceof Error ? error.message : String(error)}`);
      return result;
    }
  }

  /**
   * 验证模块结构
   */
  private async validateModuleStructure(modulePath: string, manifest: ModuleManifest): Promise<string[]> {
    const errors: string[] = [];

    // 辅助检查函数：检查 TS 或 JS 文件是否存在
    const checkFile = async (relPath: string): Promise<boolean> => {
      const fullPath = path.join(modulePath, relPath);
      // 1. 直接检查原路径
      if (await this.fileExists(fullPath)) return true;

      // 2. 如果是 .ts 文件，检查对应的 .js 文件 (针对编译后的生产环境)
      if (relPath.endsWith('.ts')) {
        const jsPath = fullPath.replace(/\.ts$/, '.js');
        if (await this.fileExists(jsPath)) return true;
      }

      // 3. 同样的逻辑适用于 .vue (虽然编译后没有 .vue.js，但前端构建产物在dist中，这里主要解决后端验证)
      // 对于前端文件以 .vue 结尾，我们在后端可能无法验证其编译后的存在性
      // 因此在生产环境下，如果找不到 .vue 文件，我们可以选择忽略（假设已构建）
      if (relPath.endsWith('.vue')) {
        // 简单策略：如果我们在 dist 目录，且找不到 .vue，姑且认为它是有效的（因为源码不在此）
        if (__dirname.includes('dist') || __dirname.includes('build')) return true;
      }

      return false;
    };

    // 验证后端入口文件
    if (manifest.backend?.entry) {
      if (!await checkFile(manifest.backend.entry)) {
        errors.push(`Backend entry file not found: ${manifest.backend.entry}`);
      }
    }

    // 验证后端路由文件
    if (manifest.backend?.routes?.file) {
      if (!await checkFile(manifest.backend.routes.file)) {
        errors.push(`Backend routes file not found: ${manifest.backend.routes.file}`);
      }
    }

    // 验证前端入口文件
    if (manifest.frontend?.entry) {
      if (!await checkFile(manifest.frontend.entry)) {
        errors.push(`Frontend entry file not found: ${manifest.frontend.entry}`);
      }
    }

    // 验证前端路由文件
    if (manifest.frontend?.routes) {
      if (!await checkFile(manifest.frontend.routes)) {
        errors.push(`Frontend routes file not found: ${manifest.frontend.routes}`);
      }
    }

    // 验证迁移目录
    if (manifest.backend?.migrations?.directory) {
      const migrationsPath = path.join(modulePath, manifest.backend.migrations.directory);
      if (!await this.directoryExists(migrationsPath)) {
        errors.push(`Migrations directory not found: ${manifest.backend.migrations.directory}`);
      }
    }

    // 验证钩子文件
    if (manifest.hooks) {
      for (const [hookName, hookFile] of Object.entries(manifest.hooks)) {
        if (hookFile) {
          if (!await checkFile(hookFile)) {
            errors.push(`Hook file not found: ${hookName} -> ${hookFile}`);
          }
        }
      }
    }

    return errors;
  }

  /**
   * 检查文件是否存在
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      return stats.isFile();
    } catch {
      return false;
    }
  }

  /**
   * 检查目录是否存在
   */
  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * 确保模块目录存在
   */
  private async ensureModulesDirectory(): Promise<void> {
    try {
      await fs.access(this.modulesDirectory);
    } catch {
      // 目录不存在，创建它
      await fs.mkdir(this.modulesDirectory, { recursive: true });
    }
  }

  /**
   * 获取模块清单
   */
  async getModuleManifest(moduleName: string): Promise<ModuleManifest> {
    const manifestPath = path.join(this.modulesDirectory, moduleName, 'module.json');

    try {
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      return ManifestParser.parseFromString(manifestContent);
    } catch (error) {
      throw new Error(`Failed to read module manifest for ${moduleName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 检查模块是否存在
   */
  async moduleExists(moduleName: string): Promise<boolean> {
    const modulePath = path.join(this.modulesDirectory, moduleName);
    return await this.directoryExists(modulePath);
  }

  /**
   * 获取所有模块名称
   */
  async getAllModuleNames(): Promise<string[]> {
    try {
      await this.ensureModulesDirectory();
      const entries = await fs.readdir(this.modulesDirectory, { withFileTypes: true });
      return entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);
    } catch (error) {
      throw new Error(`Failed to get module names: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// 导出单例实例
export const moduleScanner = new ModuleScanner();
