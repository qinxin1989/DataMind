/**
 * 缓存性能测试
 * 测试缓存命中率和性能提升效果
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { CacheManager, createCacheManager } from '../../src/core/cache/CacheManager';

describe('缓存性能测试', () => {
  let cache: CacheManager;

  beforeEach(() => {
    cache = createCacheManager({
      prefix: 'test',
      ttl: 60 // 1分钟
    });
  });

  describe('基本缓存操作性能', () => {
    test('缓存写入 < 1ms', async () => {
      const start = performance.now();
      await cache.set('test-key', { data: 'test-value' });
      const duration = performance.now() - start;

      console.log(`缓存写入耗时: ${duration.toFixed(3)}ms`);
      expect(duration).toBeLessThan(1);
    });

    test('缓存读取 < 1ms', async () => {
      await cache.set('test-key', { data: 'test-value' });

      const start = performance.now();
      const value = await cache.get('test-key');
      const duration = performance.now() - start;

      console.log(`缓存读取耗时: ${duration.toFixed(3)}ms`);
      expect(duration).toBeLessThan(1);
      expect(value).toEqual({ data: 'test-value' });
    });

    test('缓存删除 < 1ms', async () => {
      await cache.set('test-key', { data: 'test-value' });

      const start = performance.now();
      await cache.delete('test-key');
      const duration = performance.now() - start;

      console.log(`缓存删除耗时: ${duration.toFixed(3)}ms`);
      expect(duration).toBeLessThan(1);

      const value = await cache.get('test-key');
      expect(value).toBeNull();
    });

    test('缓存清空 < 1ms', async () => {
      // 写入多个缓存
      for (let i = 0; i < 100; i++) {
        await cache.set(`test-key-${i}`, { data: `test-value-${i}` });
      }

      const start = performance.now();
      await cache.clear();
      const duration = performance.now() - start;

      console.log(`缓存清空耗时: ${duration.toFixed(3)}ms`);
      expect(duration).toBeLessThan(1);

      const value = await cache.get('test-key-0');
      expect(value).toBeNull();
    });
  });

  describe('批量操作性能', () => {
    test('批量写入100个缓存 < 10ms', async () => {
      const start = performance.now();
      
      for (let i = 0; i < 100; i++) {
        await cache.set(`batch-key-${i}`, { data: `batch-value-${i}` });
      }
      
      const duration = performance.now() - start;

      console.log(`批量写入100个缓存耗时: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(10);
    });

    test('批量读取100个缓存 < 10ms', async () => {
      // 先写入
      for (let i = 0; i < 100; i++) {
        await cache.set(`batch-key-${i}`, { data: `batch-value-${i}` });
      }

      const start = performance.now();
      
      for (let i = 0; i < 100; i++) {
        await cache.get(`batch-key-${i}`);
      }
      
      const duration = performance.now() - start;

      console.log(`批量读取100个缓存耗时: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(10);
    });

    test('模式匹配清空 < 5ms', async () => {
      // 写入多个缓存
      for (let i = 0; i < 50; i++) {
        await cache.set(`user:${i}`, { id: i });
        await cache.set(`role:${i}`, { id: i });
      }

      const start = performance.now();
      await cache.clear('test:user:*');
      const duration = performance.now() - start;

      console.log(`模式匹配清空耗时: ${duration.toFixed(3)}ms`);
      expect(duration).toBeLessThan(5);

      // 验证user缓存已清空
      const userValue = await cache.get('user:0');
      expect(userValue).toBeNull();

      // 验证role缓存仍存在
      const roleValue = await cache.get('role:0');
      expect(roleValue).toBeDefined();
    });
  });

  describe('缓存命中性能对比', () => {
    test('缓存命中应该比未命中快至少10倍', async () => {
      // 模拟数据库查询函数
      const slowQuery = async () => {
        // 模拟50ms的数据库查询
        await new Promise(resolve => setTimeout(resolve, 50));
        return { data: 'query-result' };
      };

      // 第一次查询 - 未命中缓存
      const start1 = performance.now();
      const result1 = await cache.getOrSet('slow-query', slowQuery);
      const duration1 = performance.now() - start1;

      // 第二次查询 - 命中缓存
      const start2 = performance.now();
      const result2 = await cache.getOrSet('slow-query', slowQuery);
      const duration2 = performance.now() - start2;

      console.log(`未命中缓存耗时: ${duration1.toFixed(2)}ms`);
      console.log(`命中缓存耗时: ${duration2.toFixed(3)}ms`);
      console.log(`性能提升: ${(duration1 / duration2).toFixed(1)}倍`);

      expect(result1).toEqual(result2);
      expect(duration2).toBeLessThan(duration1 / 10);
    });

    test('高频查询缓存效果', async () => {
      const queryCount = 100;
      let cacheHits = 0;
      let cacheMisses = 0;

      // 模拟数据库查询
      const query = async (id: number) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return { id, data: `data-${id}` };
      };

      const start = performance.now();

      // 模拟100次查询,其中有重复的ID
      for (let i = 0; i < queryCount; i++) {
        const id = Math.floor(Math.random() * 10); // 0-9的随机ID
        const key = `query:${id}`;

        const hasCache = await cache.has(key);
        if (hasCache) {
          cacheHits++;
          await cache.get(key);
        } else {
          cacheMisses++;
          const result = await query(id);
          await cache.set(key, result);
        }
      }

      const duration = performance.now() - start;
      const hitRate = (cacheHits / queryCount * 100).toFixed(1);

      console.log(`总查询次数: ${queryCount}`);
      console.log(`缓存命中: ${cacheHits} (${hitRate}%)`);
      console.log(`缓存未命中: ${cacheMisses}`);
      console.log(`总耗时: ${duration.toFixed(2)}ms`);
      console.log(`平均耗时: ${(duration / queryCount).toFixed(2)}ms`);

      // 缓存命中率应该 > 80%
      expect(cacheHits / queryCount).toBeGreaterThan(0.8);
    });
  });

  describe('缓存过期测试', () => {
    test('过期缓存应该返回null', async () => {
      // 创建1秒过期的缓存
      const shortCache = createCacheManager({
        prefix: 'short',
        ttl: 1
      });

      await shortCache.set('expire-key', { data: 'expire-value' });

      // 立即读取应该成功
      const value1 = await shortCache.get('expire-key');
      expect(value1).toBeDefined();

      // 等待1.1秒后读取应该返回null
      await new Promise(resolve => setTimeout(resolve, 1100));
      const value2 = await shortCache.get('expire-key');
      expect(value2).toBeNull();
    });

    test('清理过期缓存 < 5ms', async () => {
      // 创建短期缓存
      const shortCache = createCacheManager({
        prefix: 'cleanup',
        ttl: 1
      });

      // 写入50个缓存
      for (let i = 0; i < 50; i++) {
        await shortCache.set(`key-${i}`, { data: `value-${i}` });
      }

      // 等待过期
      await new Promise(resolve => setTimeout(resolve, 1100));

      const start = performance.now();
      const cleanedCount = shortCache.cleanup();
      const duration = performance.now() - start;

      console.log(`清理${cleanedCount}个过期缓存耗时: ${duration.toFixed(3)}ms`);
      expect(duration).toBeLessThan(5);
      expect(cleanedCount).toBe(50);
    });
  });

  describe('缓存统计信息', () => {
    test('获取缓存统计 < 1ms', async () => {
      // 写入一些缓存
      for (let i = 0; i < 20; i++) {
        await cache.set(`stats-key-${i}`, { data: `stats-value-${i}` });
      }

      const start = performance.now();
      const stats = cache.getStats();
      const duration = performance.now() - start;

      console.log(`获取缓存统计耗时: ${duration.toFixed(3)}ms`);
      console.log(`缓存统计:`, stats);

      expect(duration).toBeLessThan(1);
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.valid).toBeGreaterThan(0);
    });
  });

  describe('并发访问性能', () => {
    test('并发读写 < 50ms', async () => {
      const concurrency = 50;
      const promises: Promise<any>[] = [];

      const start = performance.now();

      // 并发读写
      for (let i = 0; i < concurrency; i++) {
        promises.push(
          cache.set(`concurrent-${i}`, { data: `value-${i}` })
        );
      }

      await Promise.all(promises);

      // 并发读取
      const readPromises: Promise<any>[] = [];
      for (let i = 0; i < concurrency; i++) {
        readPromises.push(cache.get(`concurrent-${i}`));
      }

      await Promise.all(readPromises);

      const duration = performance.now() - start;

      console.log(`${concurrency}个并发读写耗时: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(50);
    });
  });
});
