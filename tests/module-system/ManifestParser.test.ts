/**
 * ManifestParser 单元测试
 */

import { describe, it, expect } from 'vitest';
import { ManifestParser } from '../../src/module-system/core/ManifestParser';
import { ModuleManifest } from '../../src/module-system/types';

describe('ManifestParser', () => {
  describe('parseFromString', () => {
    it('should parse valid manifest', () => {
      const manifestJson = JSON.stringify({
        name: 'test-module',
        displayName: 'Test Module',
        version: '1.0.0',
        description: 'A test module'
      });

      const manifest = ManifestParser.parseFromString(manifestJson);
      expect(manifest.name).toBe('test-module');
      expect(manifest.displayName).toBe('Test Module');
      expect(manifest.version).toBe('1.0.0');
    });

    it('should throw error for invalid JSON', () => {
      const invalidJson = '{ invalid json }';

      expect(() => ManifestParser.parseFromString(invalidJson)).toThrow(
        'Invalid JSON format'
      );
    });

    it('should throw error for missing required fields', () => {
      const manifestJson = JSON.stringify({
        displayName: 'Test Module',
        version: '1.0.0'
        // Missing 'name'
      });

      expect(() => ManifestParser.parseFromString(manifestJson)).toThrow(
        'Missing required field: name'
      );
    });

    it('should throw error for invalid module name format', () => {
      const manifestJson = JSON.stringify({
        name: 'Test_Module', // Invalid: should be kebab-case
        displayName: 'Test Module',
        version: '1.0.0'
      });

      expect(() => ManifestParser.parseFromString(manifestJson)).toThrow(
        'must be in kebab-case format'
      );
    });

    it('should throw error for invalid version format', () => {
      const manifestJson = JSON.stringify({
        name: 'test-module',
        displayName: 'Test Module',
        version: 'invalid-version'
      });

      expect(() => ManifestParser.parseFromString(manifestJson)).toThrow(
        'Invalid version format'
      );
    });

    it('should parse manifest with dependencies', () => {
      const manifestJson = JSON.stringify({
        name: 'test-module',
        displayName: 'Test Module',
        version: '1.0.0',
        dependencies: {
          'other-module': '^1.0.0',
          'another-module': '~2.0.0'
        }
      });

      const manifest = ManifestParser.parseFromString(manifestJson);
      expect(manifest.dependencies).toEqual({
        'other-module': '^1.0.0',
        'another-module': '~2.0.0'
      });
    });

    it('should throw error for invalid dependency version range', () => {
      const manifestJson = JSON.stringify({
        name: 'test-module',
        displayName: 'Test Module',
        version: '1.0.0',
        dependencies: {
          'other-module': 'invalid-range'
        }
      });

      expect(() => ManifestParser.parseFromString(manifestJson)).toThrow(
        'Invalid version range'
      );
    });

    it('should parse manifest with backend configuration', () => {
      const manifestJson = JSON.stringify({
        name: 'test-module',
        displayName: 'Test Module',
        version: '1.0.0',
        backend: {
          entry: './backend/index.ts',
          routes: {
            prefix: '/test',
            file: './backend/routes.ts'
          }
        }
      });

      const manifest = ManifestParser.parseFromString(manifestJson);
      expect(manifest.backend?.entry).toBe('./backend/index.ts');
      expect(manifest.backend?.routes?.prefix).toBe('/test');
    });

    it('should throw error for backend without entry', () => {
      const manifestJson = JSON.stringify({
        name: 'test-module',
        displayName: 'Test Module',
        version: '1.0.0',
        backend: {
          routes: {
            prefix: '/test',
            file: './backend/routes.ts'
          }
        }
      });

      expect(() => ManifestParser.parseFromString(manifestJson)).toThrow(
        'backend.entry" is required'
      );
    });

    it('should parse manifest with frontend configuration', () => {
      const manifestJson = JSON.stringify({
        name: 'test-module',
        displayName: 'Test Module',
        version: '1.0.0',
        frontend: {
          entry: './frontend/index.ts',
          routes: './frontend/routes.ts'
        }
      });

      const manifest = ManifestParser.parseFromString(manifestJson);
      expect(manifest.frontend?.entry).toBe('./frontend/index.ts');
      expect(manifest.frontend?.routes).toBe('./frontend/routes.ts');
    });

    it('should parse manifest with menus', () => {
      const manifestJson = JSON.stringify({
        name: 'test-module',
        displayName: 'Test Module',
        version: '1.0.0',
        menus: [
          {
            id: 'test-menu',
            title: 'Test Menu',
            path: '/test',
            icon: 'TestIcon',
            sortOrder: 1
          }
        ]
      });

      const manifest = ManifestParser.parseFromString(manifestJson);
      expect(manifest.menus).toHaveLength(1);
      expect(manifest.menus?.[0].id).toBe('test-menu');
    });

    it('should throw error for menu without required fields', () => {
      const manifestJson = JSON.stringify({
        name: 'test-module',
        displayName: 'Test Module',
        version: '1.0.0',
        menus: [
          {
            id: 'test-menu',
            title: 'Test Menu'
            // Missing 'path' and 'sortOrder'
          }
        ]
      });

      expect(() => ManifestParser.parseFromString(manifestJson)).toThrow(
        'Missing required field'
      );
    });

    it('should parse manifest with permissions', () => {
      const manifestJson = JSON.stringify({
        name: 'test-module',
        displayName: 'Test Module',
        version: '1.0.0',
        permissions: [
          {
            code: 'test:view',
            name: 'View Test',
            description: 'View test data'
          }
        ]
      });

      const manifest = ManifestParser.parseFromString(manifestJson);
      expect(manifest.permissions).toHaveLength(1);
      expect(manifest.permissions?.[0].code).toBe('test:view');
    });

    it('should throw error for permission without required fields', () => {
      const manifestJson = JSON.stringify({
        name: 'test-module',
        displayName: 'Test Module',
        version: '1.0.0',
        permissions: [
          {
            code: 'test:view',
            name: 'View Test'
            // Missing 'description'
          }
        ]
      });

      expect(() => ManifestParser.parseFromString(manifestJson)).toThrow(
        'Missing required field'
      );
    });

    it('should parse manifest with all optional fields', () => {
      const manifestJson = JSON.stringify({
        name: 'test-module',
        displayName: 'Test Module',
        version: '1.0.0',
        description: 'A comprehensive test module',
        author: 'Test Author',
        license: 'MIT',
        type: 'business',
        category: 'test',
        tags: ['test', 'example'],
        dependencies: {
          'other-module': '^1.0.0'
        },
        backend: {
          entry: './backend/index.ts'
        },
        frontend: {
          entry: './frontend/index.ts'
        },
        menus: [
          {
            id: 'test-menu',
            title: 'Test',
            path: '/test',
            sortOrder: 1
          }
        ],
        permissions: [
          {
            code: 'test:view',
            name: 'View',
            description: 'View test'
          }
        ]
      });

      const manifest = ManifestParser.parseFromString(manifestJson);
      expect(manifest.name).toBe('test-module');
      expect(manifest.author).toBe('Test Author');
      expect(manifest.type).toBe('business');
      expect(manifest.tags).toEqual(['test', 'example']);
    });
  });

  describe('validate', () => {
    it('should validate correct manifest', () => {
      const manifest: ModuleManifest = {
        name: 'test-module',
        displayName: 'Test Module',
        version: '1.0.0'
      };

      expect(() => ManifestParser.validate(manifest)).not.toThrow();
    });

    it('should throw error for invalid type', () => {
      const manifest: any = {
        name: 'test-module',
        displayName: 'Test Module',
        version: '1.0.0',
        type: 'invalid-type'
      };

      expect(() => ManifestParser.validate(manifest)).toThrow(
        'must be one of: business, system, tool'
      );
    });

    it('should throw error for non-array tags', () => {
      const manifest: any = {
        name: 'test-module',
        displayName: 'Test Module',
        version: '1.0.0',
        tags: 'not-an-array'
      };

      expect(() => ManifestParser.validate(manifest)).toThrow(
        'must be an array'
      );
    });
  });

  describe('stringify', () => {
    it('should stringify manifest to JSON', () => {
      const manifest: ModuleManifest = {
        name: 'test-module',
        displayName: 'Test Module',
        version: '1.0.0'
      };

      const json = ManifestParser.stringify(manifest);
      expect(json).toContain('"name": "test-module"');
      expect(json).toContain('"displayName": "Test Module"');
    });

    it('should stringify manifest without pretty print', () => {
      const manifest: ModuleManifest = {
        name: 'test-module',
        displayName: 'Test Module',
        version: '1.0.0'
      };

      const json = ManifestParser.stringify(manifest, false);
      expect(json).not.toContain('\n');
    });
  });
});
