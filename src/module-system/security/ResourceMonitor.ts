/**
 * 资源监控器
 * 监控模块的资源使用情况 (内存、CPU等)
 */

/**
 * 资源限制配置
 */
export interface ResourceLimits {
  maxMemoryMB?: number;      // 最大内存使用 (MB)
  maxCpuPercent?: number;    // 最大 CPU 使用率 (%)
  maxExecutionTimeMs?: number; // 最大执行时间 (ms)
}

/**
 * 资源使用统计
 */
export interface ResourceUsage {
  memoryMB: number;
  cpuPercent: number;
  executionTimeMs: number;
  timestamp: number;
}

/**
 * 资源监控器类
 */
export class ResourceMonitor {
  private moduleResources: Map<string, ResourceUsage[]> = new Map();
  private moduleLimits: Map<string, ResourceLimits> = new Map();
  private moduleStartTime: Map<string, number> = new Map();
  
  // 默认限制
  private static readonly DEFAULT_LIMITS: ResourceLimits = {
    maxMemoryMB: 512,        // 512MB
    maxCpuPercent: 80,       // 80%
    maxExecutionTimeMs: 30000 // 30秒
  };

  /**
   * 设置模块资源限制
   */
  setResourceLimits(moduleName: string, limits: ResourceLimits): void {
    this.moduleLimits.set(moduleName, {
      ...ResourceMonitor.DEFAULT_LIMITS,
      ...limits
    });
  }

  /**
   * 获取模块资源限制
   */
  getResourceLimits(moduleName: string): ResourceLimits {
    return this.moduleLimits.get(moduleName) || ResourceMonitor.DEFAULT_LIMITS;
  }

  /**
   * 开始监控模块
   */
  startMonitoring(moduleName: string): void {
    this.moduleStartTime.set(moduleName, Date.now());
    
    if (!this.moduleResources.has(moduleName)) {
      this.moduleResources.set(moduleName, []);
    }
  }

  /**
   * 停止监控模块
   */
  stopMonitoring(moduleName: string): void {
    this.moduleStartTime.delete(moduleName);
  }

  /**
   * 记录资源使用
   */
  recordUsage(moduleName: string): ResourceUsage {
    const memoryUsage = process.memoryUsage();
    const memoryMB = memoryUsage.heapUsed / 1024 / 1024;
    
    // 简化的 CPU 使用率计算
    // 注意: 这是简化版本,生产环境需要更精确的 CPU 监控
    const cpuUsage = process.cpuUsage();
    const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // 转换为秒
    
    const startTime = this.moduleStartTime.get(moduleName) || Date.now();
    const executionTimeMs = Date.now() - startTime;
    
    const usage: ResourceUsage = {
      memoryMB,
      cpuPercent,
      executionTimeMs,
      timestamp: Date.now()
    };
    
    // 记录使用情况
    const usageHistory = this.moduleResources.get(moduleName) || [];
    usageHistory.push(usage);
    
    // 只保留最近 100 条记录
    if (usageHistory.length > 100) {
      usageHistory.shift();
    }
    
    this.moduleResources.set(moduleName, usageHistory);
    
    return usage;
  }

  /**
   * 检查资源限制
   */
  checkLimits(moduleName: string): { exceeded: boolean; reason?: string } {
    const limits = this.getResourceLimits(moduleName);
    const usage = this.getCurrentUsage(moduleName);
    
    if (!usage) {
      return { exceeded: false };
    }
    
    // 检查内存限制
    if (limits.maxMemoryMB && usage.memoryMB > limits.maxMemoryMB) {
      return {
        exceeded: true,
        reason: `Memory limit exceeded: ${usage.memoryMB.toFixed(2)}MB > ${limits.maxMemoryMB}MB`
      };
    }
    
    // 检查 CPU 限制
    if (limits.maxCpuPercent && usage.cpuPercent > limits.maxCpuPercent) {
      return {
        exceeded: true,
        reason: `CPU limit exceeded: ${usage.cpuPercent.toFixed(2)}% > ${limits.maxCpuPercent}%`
      };
    }
    
    // 检查执行时间限制
    if (limits.maxExecutionTimeMs && usage.executionTimeMs > limits.maxExecutionTimeMs) {
      return {
        exceeded: true,
        reason: `Execution time limit exceeded: ${usage.executionTimeMs}ms > ${limits.maxExecutionTimeMs}ms`
      };
    }
    
    return { exceeded: false };
  }

  /**
   * 获取当前资源使用
   */
  getCurrentUsage(moduleName: string): ResourceUsage | undefined {
    const usageHistory = this.moduleResources.get(moduleName);
    if (!usageHistory || usageHistory.length === 0) {
      return undefined;
    }
    return usageHistory[usageHistory.length - 1];
  }

  /**
   * 获取资源使用历史
   */
  getUsageHistory(moduleName: string, limit?: number): ResourceUsage[] {
    const usageHistory = this.moduleResources.get(moduleName) || [];
    if (limit) {
      return usageHistory.slice(-limit);
    }
    return [...usageHistory];
  }

  /**
   * 获取平均资源使用
   */
  getAverageUsage(moduleName: string): ResourceUsage | undefined {
    const usageHistory = this.moduleResources.get(moduleName);
    if (!usageHistory || usageHistory.length === 0) {
      return undefined;
    }
    
    const sum = usageHistory.reduce(
      (acc, usage) => ({
        memoryMB: acc.memoryMB + usage.memoryMB,
        cpuPercent: acc.cpuPercent + usage.cpuPercent,
        executionTimeMs: acc.executionTimeMs + usage.executionTimeMs,
        timestamp: 0
      }),
      { memoryMB: 0, cpuPercent: 0, executionTimeMs: 0, timestamp: 0 }
    );
    
    const count = usageHistory.length;
    return {
      memoryMB: sum.memoryMB / count,
      cpuPercent: sum.cpuPercent / count,
      executionTimeMs: sum.executionTimeMs / count,
      timestamp: Date.now()
    };
  }

  /**
   * 获取峰值资源使用
   */
  getPeakUsage(moduleName: string): ResourceUsage | undefined {
    const usageHistory = this.moduleResources.get(moduleName);
    if (!usageHistory || usageHistory.length === 0) {
      return undefined;
    }
    
    return usageHistory.reduce((peak, usage) => {
      return {
        memoryMB: Math.max(peak.memoryMB, usage.memoryMB),
        cpuPercent: Math.max(peak.cpuPercent, usage.cpuPercent),
        executionTimeMs: Math.max(peak.executionTimeMs, usage.executionTimeMs),
        timestamp: usage.timestamp
      };
    });
  }

  /**
   * 清空模块资源记录
   */
  clearModuleResources(moduleName: string): void {
    this.moduleResources.delete(moduleName);
    this.moduleStartTime.delete(moduleName);
  }

  /**
   * 清空所有资源记录
   */
  clearAll(): void {
    this.moduleResources.clear();
    this.moduleLimits.clear();
    this.moduleStartTime.clear();
  }

  /**
   * 获取所有模块的资源使用情况
   */
  getAllModuleUsage(): Map<string, ResourceUsage | undefined> {
    const result = new Map<string, ResourceUsage | undefined>();
    for (const [moduleName] of this.moduleResources) {
      result.set(moduleName, this.getCurrentUsage(moduleName));
    }
    return result;
  }
}

// 导出单例实例
export const resourceMonitor = new ResourceMonitor();
