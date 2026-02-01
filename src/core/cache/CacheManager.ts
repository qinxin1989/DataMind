/**
 * 缓存管理器
 * 提供统一的缓存接口,支持内存缓存和 Redis 缓存
 */

interface CacheEntry<T = any> {
  value: T;
  expireAt: number;
}

interface CacheOptions {
  ttl?: number; // 过期时间(秒)
  prefix?: string; // 键前缀
}

export class CacheManager {
  private memoryCache: Map<string, CacheEntry> = new Map();
  private prefix: string;
  private defaultTTL: number;

  constructor(options: CacheOptions = {}) {
    this.prefix = options.prefix || 'cache';
    this.defaultTTL = options.ttl || 300; // 默认5分钟
  }

  /**
   * 获取缓存值
   */
  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.getFullKey(key);
    const entry = this.memoryCache.get(fullKey);

    if (!entry) {
      return null;
    }

    // 检查是否过期
    if (Date.now() > entry.expireAt) {
      this.memoryCache.delete(fullKey);
      return null;
    }

    return entry.value as T;
  }

  /**
   * 设置缓存值
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const fullKey = this.getFullKey(key);
    const expireAt = Date.now() + (ttl || this.defaultTTL) * 1000;

    this.memoryCache.set(fullKey, {
      value,
      expireAt
    });
  }

  /**
   * 删除缓存
   */
  async delete(key: string): Promise<void> {
    const fullKey = this.getFullKey(key);
    this.memoryCache.delete(fullKey);
  }

  /**
   * 清空缓存
   * @param pattern 可选的键模式,支持通配符 *
   */
  async clear(pattern?: string): Promise<void> {
    if (!pattern) {
      this.memoryCache.clear();
      return;
    }

    // 转换通配符模式为正则表达式
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*') + '$'
    );

    // 删除匹配的键
    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        this.memoryCache.delete(key);
      }
    }
  }

  /**
   * 获取或设置缓存
   * 如果缓存不存在,则调用 factory 函数获取值并缓存
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // 尝试从缓存获取
    let value = await this.get<T>(key);
    if (value !== null) {
      return value;
    }

    // 调用工厂函数获取值
    value = await factory();

    // 缓存值
    await this.set(key, value, ttl);

    return value;
  }

  /**
   * 检查缓存是否存在
   */
  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  /**
   * 获取缓存统计信息
   */
  getStats() {
    let validCount = 0;
    let expiredCount = 0;
    const now = Date.now();

    for (const entry of this.memoryCache.values()) {
      if (now > entry.expireAt) {
        expiredCount++;
      } else {
        validCount++;
      }
    }

    return {
      total: this.memoryCache.size,
      valid: validCount,
      expired: expiredCount
    };
  }

  /**
   * 清理过期缓存
   */
  cleanup(): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.memoryCache.entries()) {
      if (now > entry.expireAt) {
        this.memoryCache.delete(key);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  /**
   * 获取完整的缓存键
   */
  private getFullKey(key: string): string {
    return `${this.prefix}:${key}`;
  }
}

/**
 * 创建缓存管理器实例
 */
export function createCacheManager(options?: CacheOptions): CacheManager {
  return new CacheManager(options);
}

/**
 * 全局缓存管理器实例
 */
export const globalCache = new CacheManager({
  prefix: 'global',
  ttl: 300 // 5分钟
});

/**
 * 权限缓存管理器
 */
export const permissionCache = new CacheManager({
  prefix: 'permission',
  ttl: 300 // 5分钟
});

/**
 * 菜单缓存管理器
 */
export const menuCache = new CacheManager({
  prefix: 'menu',
  ttl: 300 // 5分钟
});

/**
 * 用户缓存管理器
 */
export const userCache = new CacheManager({
  prefix: 'user',
  ttl: 600 // 10分钟
});

/**
 * 角色缓存管理器
 */
export const roleCache = new CacheManager({
  prefix: 'role',
  ttl: 600 // 10分钟
});

/**
 * 模块缓存管理器
 */
export const moduleCache = new CacheManager({
  prefix: 'module',
  ttl: 1800 // 30分钟
});
