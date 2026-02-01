/**
 * 模块清单解析器
 * 负责解析和验证 module.json 文件
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { ModuleManifest } from '../types';
import semver from 'semver';

export class ManifestParser {
  /**
   * 从文件解析模块清单
   */
  static parseFromFile(filePath: string): ModuleManifest {
    if (!existsSync(filePath)) {
      throw new Error(`Manifest file not found: ${filePath}`);
    }

    try {
      const content = readFileSync(filePath, 'utf-8');
      return this.parseFromString(content);
    } catch (error: any) {
      throw new Error(`Failed to read manifest file: ${error.message}`);
    }
  }

  /**
   * 从字符串解析模块清单
   */
  static parseFromString(content: string): ModuleManifest {
    let manifest: any;

    try {
      manifest = JSON.parse(content);
    } catch (error: any) {
      throw new Error(`Invalid JSON format: ${error.message}`);
    }

    // 验证清单
    this.validate(manifest);

    return manifest as ModuleManifest;
  }

  /**
   * 从模块目录解析清单
   */
  static parseFromDirectory(moduleDir: string): ModuleManifest {
    const manifestPath = join(moduleDir, 'module.json');
    return this.parseFromFile(manifestPath);
  }

  /**
   * 验证模块清单
   */
  static validate(manifest: any): void {
    const errors: string[] = [];

    // 验证必需字段
    if (!manifest.name) {
      errors.push('Missing required field: name');
    } else if (typeof manifest.name !== 'string') {
      errors.push('Field "name" must be a string');
    } else if (!this.isValidModuleName(manifest.name)) {
      errors.push(
        'Field "name" must be in kebab-case format (lowercase letters, numbers, and hyphens)'
      );
    }

    if (!manifest.displayName) {
      errors.push('Missing required field: displayName');
    } else if (typeof manifest.displayName !== 'string') {
      errors.push('Field "displayName" must be a string');
    }

    if (!manifest.version) {
      errors.push('Missing required field: version');
    } else if (typeof manifest.version !== 'string') {
      errors.push('Field "version" must be a string');
    } else if (!this.isValidVersion(manifest.version)) {
      errors.push(`Invalid version format: ${manifest.version}. Must follow semver (e.g., 1.0.0)`);
    }

    // 验证可选字段类型
    if (manifest.description !== undefined && typeof manifest.description !== 'string') {
      errors.push('Field "description" must be a string');
    }

    if (manifest.author !== undefined && typeof manifest.author !== 'string') {
      errors.push('Field "author" must be a string');
    }

    if (manifest.license !== undefined && typeof manifest.license !== 'string') {
      errors.push('Field "license" must be a string');
    }

    if (manifest.type !== undefined) {
      if (!['business', 'system', 'tool'].includes(manifest.type)) {
        errors.push('Field "type" must be one of: business, system, tool');
      }
    }

    if (manifest.category !== undefined && typeof manifest.category !== 'string') {
      errors.push('Field "category" must be a string');
    }

    if (manifest.tags !== undefined) {
      if (!Array.isArray(manifest.tags)) {
        errors.push('Field "tags" must be an array');
      } else if (!manifest.tags.every((tag: any) => typeof tag === 'string')) {
        errors.push('All tags must be strings');
      }
    }

    // 验证依赖关系
    if (manifest.dependencies !== undefined) {
      if (typeof manifest.dependencies !== 'object' || Array.isArray(manifest.dependencies)) {
        errors.push('Field "dependencies" must be an object');
      } else {
        for (const [depName, versionRange] of Object.entries(manifest.dependencies)) {
          if (typeof versionRange !== 'string') {
            errors.push(`Dependency "${depName}" version must be a string`);
          } else if (!this.isValidVersionRange(versionRange as string)) {
            errors.push(`Invalid version range for dependency "${depName}": ${versionRange}`);
          }
        }
      }
    }

    // 验证后端配置
    if (manifest.backend !== undefined) {
      if (typeof manifest.backend !== 'object') {
        errors.push('Field "backend" must be an object');
      } else {
        if (!manifest.backend.entry) {
          errors.push('Field "backend.entry" is required when backend is specified');
        } else if (typeof manifest.backend.entry !== 'string') {
          errors.push('Field "backend.entry" must be a string');
        }

        if (manifest.backend.routes !== undefined) {
          if (typeof manifest.backend.routes !== 'object') {
            errors.push('Field "backend.routes" must be an object');
          } else {
            if (!manifest.backend.routes.prefix || typeof manifest.backend.routes.prefix !== 'string') {
              errors.push('Field "backend.routes.prefix" must be a string');
            }
            if (!manifest.backend.routes.file || typeof manifest.backend.routes.file !== 'string') {
              errors.push('Field "backend.routes.file" must be a string');
            }
          }
        }
      }
    }

    // 验证前端配置
    if (manifest.frontend !== undefined) {
      if (typeof manifest.frontend !== 'object') {
        errors.push('Field "frontend" must be an object');
      } else {
        if (!manifest.frontend.entry) {
          errors.push('Field "frontend.entry" is required when frontend is specified');
        } else if (typeof manifest.frontend.entry !== 'string') {
          errors.push('Field "frontend.entry" must be a string');
        }
      }
    }

    // 验证菜单配置
    if (manifest.menus !== undefined) {
      if (!Array.isArray(manifest.menus)) {
        errors.push('Field "menus" must be an array');
      } else {
        manifest.menus.forEach((menu: any, index: number) => {
          if (!menu.id) errors.push(`Menu[${index}]: Missing required field "id"`);
          if (!menu.title) errors.push(`Menu[${index}]: Missing required field "title"`);
          if (!menu.path) errors.push(`Menu[${index}]: Missing required field "path"`);
          if (menu.sortOrder === undefined) errors.push(`Menu[${index}]: Missing required field "sortOrder"`);
        });
      }
    }

    // 验证权限配置
    if (manifest.permissions !== undefined) {
      if (!Array.isArray(manifest.permissions)) {
        errors.push('Field "permissions" must be an array');
      } else {
        manifest.permissions.forEach((perm: any, index: number) => {
          if (!perm.code) errors.push(`Permission[${index}]: Missing required field "code"`);
          if (!perm.name) errors.push(`Permission[${index}]: Missing required field "name"`);
          if (!perm.description) errors.push(`Permission[${index}]: Missing required field "description"`);
        });
      }
    }

    // 如果有错误，抛出异常
    if (errors.length > 0) {
      throw new Error(`Manifest validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`);
    }
  }

  /**
   * 验证模块名称格式
   */
  private static isValidModuleName(name: string): boolean {
    return /^[a-z][a-z0-9-]*$/.test(name);
  }

  /**
   * 验证版本号格式
   */
  private static isValidVersion(version: string): boolean {
    return semver.valid(version) !== null;
  }

  /**
   * 验证版本范围格式
   */
  private static isValidVersionRange(range: string): boolean {
    try {
      return semver.validRange(range) !== null;
    } catch {
      return false;
    }
  }

  /**
   * 序列化清单为 JSON 字符串
   */
  static stringify(manifest: ModuleManifest, pretty: boolean = true): string {
    return JSON.stringify(manifest, null, pretty ? 2 : 0);
  }
}
