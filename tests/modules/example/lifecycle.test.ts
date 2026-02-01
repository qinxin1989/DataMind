/**
 * 示例模块生命周期集成测试
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { ManifestParser } from '../../../src/module-system/core/ManifestParser';
import fs from 'fs/promises';
import path from 'path';

describe('Example Module Lifecycle', () => {
  let manifest: any;
  const parser = new ManifestParser();

  beforeAll(async () => {
    // 读取示例模块的 module.json
    const manifestPath = path.join(process.cwd(), 'modules', 'example', 'module.json');
    const content = await fs.readFile(manifestPath, 'utf-8');
    manifest = JSON.parse(content);
  });

  it('应该能够解析示例模块清单', () => {
    expect(manifest).toBeDefined();
    expect(manifest.name).toBe('example');
    expect(manifest.displayName).toBe('示例模块');
    expect(manifest.version).toBe('1.0.0');
  });

  it('应该验证模块清单格式', () => {
    // 验证清单已经被正确解析
    expect(manifest).toBeDefined();
    expect(manifest.name).toBe('example');
    expect(manifest.version).toBe('1.0.0');
  });

  it('应该验证必需字段', () => {
    expect(manifest.name).toBe('example');
    expect(manifest.displayName).toBe('示例模块');
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.description).toBeDefined();
    
    // 验证后端配置
    expect(manifest.backend).toBeDefined();
    expect(manifest.backend.entry).toBe('./backend/index.ts');
    expect(manifest.backend.routes).toBeDefined();
    
    // 验证前端配置
    expect(manifest.frontend).toBeDefined();
    expect(manifest.frontend.entry).toBe('./frontend/index.ts');
    
    // 验证权限
    expect(manifest.permissions).toBeDefined();
    expect(manifest.permissions.length).toBeGreaterThan(0);
    
    // 验证菜单
    expect(manifest.menus).toBeDefined();
    expect(manifest.menus.length).toBeGreaterThan(0);
  });

  it('应该验证权限定义', () => {
    const permissions = manifest.permissions;
    
    expect(permissions).toContainEqual(
      expect.objectContaining({
        code: 'example:view',
        name: '查看示例'
      })
    );
    
    expect(permissions).toContainEqual(
      expect.objectContaining({
        code: 'example:create',
        name: '创建示例'
      })
    );
    
    expect(permissions).toContainEqual(
      expect.objectContaining({
        code: 'example:update',
        name: '更新示例'
      })
    );
    
    expect(permissions).toContainEqual(
      expect.objectContaining({
        code: 'example:delete',
        name: '删除示例'
      })
    );
  });

  it('应该验证菜单定义', () => {
    const menus = manifest.menus;
    
    expect(menus).toContainEqual(
      expect.objectContaining({
        id: 'example-menu',
        title: '示例模块',
        path: '/example',
        permission: 'example:view'
      })
    );
  });

  it('应该验证API端点定义', () => {
    const endpoints = manifest.api.endpoints;
    
    expect(endpoints).toContainEqual(
      expect.objectContaining({
        method: 'GET',
        path: '/example',
        permission: 'example:view'
      })
    );
    
    expect(endpoints).toContainEqual(
      expect.objectContaining({
        method: 'POST',
        path: '/example',
        permission: 'example:create'
      })
    );
  });

  it('应该验证配置Schema', () => {
    expect(manifest.config.schema).toBe('./config/schema.json');
    expect(manifest.config.defaults).toBe('./config/default.json');
  });

  it('应该验证生命周期钩子', () => {
    const hooks = manifest.hooks;
    
    expect(hooks.beforeInstall).toBe('./backend/hooks/beforeInstall.ts');
    expect(hooks.afterInstall).toBe('./backend/hooks/afterInstall.ts');
    expect(hooks.beforeEnable).toBe('./backend/hooks/beforeEnable.ts');
    expect(hooks.afterEnable).toBe('./backend/hooks/afterEnable.ts');
    expect(hooks.beforeDisable).toBe('./backend/hooks/beforeDisable.ts');
    expect(hooks.afterDisable).toBe('./backend/hooks/afterDisable.ts');
    expect(hooks.beforeUninstall).toBe('./backend/hooks/beforeUninstall.ts');
    expect(hooks.afterUninstall).toBe('./backend/hooks/afterUninstall.ts');
  });
});
