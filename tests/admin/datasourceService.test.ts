/**
 * 数据源管理服务测试
 * Property 19: Datasource Connection Test Validity
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { DatasourceService, DatasourceType } from '../../src/admin/modules/datasource/datasourceService';

describe('DatasourceService', () => {
  let datasourceService: DatasourceService;

  beforeEach(() => {
    datasourceService = new DatasourceService();
    datasourceService.clearAll();
  });

  afterEach(() => {
    datasourceService.clearAll();
  });

  // Property 19: Datasource Connection Test Validity
  describe('Property 19: Datasource Connection Test Validity', () => {
    it('should return success for valid configuration', async () => {
      const ds = await datasourceService.createDatasource({
        name: 'Test DB',
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        database: 'testdb',
        username: 'root',
        password: 'password',
        tags: [],
      });

      const result = await datasourceService.testConnection(ds.id);
      expect(result.success).toBe(true);
      expect(result.latency).toBeDefined();
    });

    it('should return error for missing host', async () => {
      const result = await datasourceService.testConnectionConfig({
        type: 'mysql',
        host: '',
        port: 3306,
        database: 'testdb',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('主机');
    });

    it('should return error for invalid port', async () => {
      const result = await datasourceService.testConnectionConfig({
        type: 'mysql',
        host: 'localhost',
        port: 0,
        database: 'testdb',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('端口');
    });

    it('should return error for missing database', async () => {
      const result = await datasourceService.testConnectionConfig({
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        database: '',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('数据库');
    });

    it('should update datasource status after test', async () => {
      const ds = await datasourceService.createDatasource({
        name: 'Test DB',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        tags: [],
      });

      expect(ds.status).toBe('inactive');

      await datasourceService.testConnection(ds.id);

      const updated = await datasourceService.getDatasourceById(ds.id);
      expect(updated?.status).toBe('active');
      expect(updated?.lastTestAt).toBeDefined();
      expect(updated?.lastTestResult).toBeDefined();
    });
  });

  describe('Datasource CRUD', () => {
    it('should create datasource with all fields', async () => {
      const ds = await datasourceService.createDatasource({
        name: 'Production DB',
        type: 'mysql',
        host: 'db.example.com',
        port: 3306,
        database: 'production',
        username: 'admin',
        password: 'secret',
        group: 'production',
        tags: ['mysql', 'production'],
      });

      expect(ds.id).toBeDefined();
      expect(ds.name).toBe('Production DB');
      expect(ds.type).toBe('mysql');
      expect(ds.status).toBe('inactive');
      expect(ds.tags).toContain('mysql');
      expect(ds.createdAt).toBeDefined();
    });

    it('should query datasources with filters', async () => {
      await datasourceService.createDatasource({
        name: 'MySQL DB',
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        database: 'db1',
        group: 'dev',
        tags: ['dev'],
      });

      await datasourceService.createDatasource({
        name: 'PostgreSQL DB',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'db2',
        group: 'prod',
        tags: ['prod'],
      });

      // 按类型过滤
      const mysqlResult = await datasourceService.queryDatasources({
        type: 'mysql',
        page: 1,
        pageSize: 10,
      });
      expect(mysqlResult.list.length).toBe(1);
      expect(mysqlResult.list[0].type).toBe('mysql');

      // 按分组过滤
      const devResult = await datasourceService.queryDatasources({
        group: 'dev',
        page: 1,
        pageSize: 10,
      });
      expect(devResult.list.length).toBe(1);

      // 按标签过滤
      const prodResult = await datasourceService.queryDatasources({
        tag: 'prod',
        page: 1,
        pageSize: 10,
      });
      expect(prodResult.list.length).toBe(1);
    });

    it('should update datasource', async () => {
      const ds = await datasourceService.createDatasource({
        name: 'Original',
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        database: 'db',
        tags: [],
      });

      const updated = await datasourceService.updateDatasource(ds.id, {
        name: 'Updated',
        port: 3307,
      });

      expect(updated.name).toBe('Updated');
      expect(updated.port).toBe(3307);
    });

    it('should delete datasource', async () => {
      const ds = await datasourceService.createDatasource({
        name: 'To Delete',
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        database: 'db',
        tags: [],
      });

      await datasourceService.deleteDatasource(ds.id);

      const retrieved = await datasourceService.getDatasourceById(ds.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('Usage Statistics', () => {
    it('should record and retrieve stats', async () => {
      const ds = await datasourceService.createDatasource({
        name: 'Stats Test',
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        database: 'db',
        tags: [],
      });

      // 记录查询
      await datasourceService.recordQuery(ds.id, true, 100);
      await datasourceService.recordQuery(ds.id, true, 200);
      await datasourceService.recordQuery(ds.id, false, 50);

      const stats = await datasourceService.getStats(ds.id);
      expect(stats?.totalQueries).toBe(3);
      expect(stats?.successQueries).toBe(2);
      expect(stats?.failedQueries).toBe(1);
      expect(stats?.avgResponseTime).toBeCloseTo((100 + 200 + 50) / 3);
    });

    it('should track queries by day', async () => {
      const ds = await datasourceService.createDatasource({
        name: 'Daily Stats',
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        database: 'db',
        tags: [],
      });

      await datasourceService.recordQuery(ds.id, true, 100);
      await datasourceService.recordQuery(ds.id, true, 100);

      const stats = await datasourceService.getStats(ds.id);
      expect(stats?.queriesByDay.length).toBe(1);
      expect(stats?.queriesByDay[0].count).toBe(2);
    });
  });

  describe('Groups and Tags', () => {
    it('should get all groups', async () => {
      await datasourceService.createDatasource({
        name: 'DS1',
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        database: 'db1',
        group: 'dev',
        tags: [],
      });

      await datasourceService.createDatasource({
        name: 'DS2',
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        database: 'db2',
        group: 'prod',
        tags: [],
      });

      const groups = await datasourceService.getGroups();
      expect(groups).toContain('dev');
      expect(groups).toContain('prod');
    });

    it('should get all tags', async () => {
      await datasourceService.createDatasource({
        name: 'DS1',
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        database: 'db1',
        tags: ['mysql', 'primary'],
      });

      await datasourceService.createDatasource({
        name: 'DS2',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'db2',
        tags: ['postgresql', 'replica'],
      });

      const tags = await datasourceService.getTags();
      expect(tags).toContain('mysql');
      expect(tags).toContain('postgresql');
      expect(tags).toContain('primary');
      expect(tags).toContain('replica');
    });

    it('should add and remove tags', async () => {
      const ds = await datasourceService.createDatasource({
        name: 'Tag Test',
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        database: 'db',
        tags: ['initial'],
      });

      // 添加标签
      await datasourceService.addTag(ds.id, 'new-tag');
      let updated = await datasourceService.getDatasourceById(ds.id);
      expect(updated?.tags).toContain('new-tag');

      // 删除标签
      await datasourceService.removeTag(ds.id, 'initial');
      updated = await datasourceService.getDatasourceById(ds.id);
      expect(updated?.tags).not.toContain('initial');
    });

    it('should set group', async () => {
      const ds = await datasourceService.createDatasource({
        name: 'Group Test',
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        database: 'db',
        tags: [],
      });

      await datasourceService.setGroup(ds.id, 'new-group');
      const updated = await datasourceService.getDatasourceById(ds.id);
      expect(updated?.group).toBe('new-group');
    });
  });

  // Property-based tests
  describe('Property-based Tests', () => {
    const typeArb = fc.constantFrom<DatasourceType>('mysql', 'postgresql', 'sqlite', 'mongodb');

    it('Property 19: valid config should pass, invalid should fail', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            host: fc.oneof(fc.constant(''), fc.string({ minLength: 1, maxLength: 50 })),
            port: fc.oneof(fc.constant(0), fc.integer({ min: 1, max: 65535 })),
            database: fc.oneof(fc.constant(''), fc.string({ minLength: 1, maxLength: 50 })),
          }),
          async (config) => {
            const result = await datasourceService.testConnectionConfig({
              type: 'mysql',
              ...config,
            });

            const isValid = config.host !== '' && config.port > 0 && config.database !== '';
            expect(result.success).toBe(isValid);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should maintain stats accuracy', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              success: fc.boolean(),
              responseTime: fc.nat(1000),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (queries) => {
            datasourceService.clearAll();

            const ds = await datasourceService.createDatasource({
              name: 'Stats Test',
              type: 'mysql',
              host: 'localhost',
              port: 3306,
              database: 'db',
              tags: [],
            });

            for (const q of queries) {
              await datasourceService.recordQuery(ds.id, q.success, q.responseTime);
            }

            const stats = await datasourceService.getStats(ds.id);
            const expectedSuccess = queries.filter(q => q.success).length;
            const expectedFailed = queries.filter(q => !q.success).length;

            expect(stats?.totalQueries).toBe(queries.length);
            expect(stats?.successQueries).toBe(expectedSuccess);
            expect(stats?.failedQueries).toBe(expectedFailed);
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});
