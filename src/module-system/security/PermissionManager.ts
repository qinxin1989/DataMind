/**
 * 模块权限管理器
 * 管理模块的权限级别和权限检查
 */

/**
 * 权限级别
 */
export enum PermissionLevel {
  MINIMAL = 'minimal',     // 最小权限
  STANDARD = 'standard',   // 标准权限
  ELEVATED = 'elevated',   // 提升权限
  FULL = 'full'           // 完全权限
}

/**
 * 权限类型
 */
export enum PermissionType {
  FILE_READ = 'file:read',
  FILE_WRITE = 'file:write',
  FILE_DELETE = 'file:delete',
  NETWORK_HTTP = 'network:http',
  NETWORK_HTTPS = 'network:https',
  DATABASE_READ = 'database:read',
  DATABASE_WRITE = 'database:write',
  PROCESS_SPAWN = 'process:spawn',
  SYSTEM_INFO = 'system:info'
}

/**
 * 模块权限配置
 */
export interface ModulePermissions {
  level: PermissionLevel;
  allowedPaths?: string[];
  allowedDomains?: string[];
  allowedPermissions?: PermissionType[];
  deniedPermissions?: PermissionType[];
}

/**
 * 权限管理器类
 */
export class PermissionManager {
  private modulePermissions: Map<string, ModulePermissions> = new Map();
  
  // 默认权限配置
  private static readonly DEFAULT_PERMISSIONS: Record<PermissionLevel, PermissionType[]> = {
    [PermissionLevel.MINIMAL]: [
      PermissionType.FILE_READ
    ],
    [PermissionLevel.STANDARD]: [
      PermissionType.FILE_READ,
      PermissionType.FILE_WRITE,
      PermissionType.NETWORK_HTTPS,
      PermissionType.DATABASE_READ
    ],
    [PermissionLevel.ELEVATED]: [
      PermissionType.FILE_READ,
      PermissionType.FILE_WRITE,
      PermissionType.FILE_DELETE,
      PermissionType.NETWORK_HTTP,
      PermissionType.NETWORK_HTTPS,
      PermissionType.DATABASE_READ,
      PermissionType.DATABASE_WRITE,
      PermissionType.SYSTEM_INFO
    ],
    [PermissionLevel.FULL]: Object.values(PermissionType)
  };

  /**
   * 设置模块权限
   */
  setModulePermissions(moduleName: string, permissions: ModulePermissions): void {
    this.modulePermissions.set(moduleName, permissions);
  }

  /**
   * 获取模块权限
   */
  getModulePermissions(moduleName: string): ModulePermissions | undefined {
    return this.modulePermissions.get(moduleName);
  }

  /**
   * 检查模块是否有特定权限
   */
  hasPermission(moduleName: string, permission: PermissionType): boolean {
    const modulePerms = this.modulePermissions.get(moduleName);
    
    if (!modulePerms) {
      // 默认为最小权限
      return PermissionManager.DEFAULT_PERMISSIONS[PermissionLevel.MINIMAL].includes(permission);
    }

    // 检查显式拒绝的权限
    if (modulePerms.deniedPermissions?.includes(permission)) {
      return false;
    }

    // 检查显式允许的权限
    if (modulePerms.allowedPermissions?.includes(permission)) {
      return true;
    }

    // 检查权限级别默认权限
    return PermissionManager.DEFAULT_PERMISSIONS[modulePerms.level].includes(permission);
  }

  /**
   * 检查模块是否可以访问路径
   */
  canAccessPath(moduleName: string, targetPath: string): boolean {
    const modulePerms = this.modulePermissions.get(moduleName);
    
    if (!modulePerms) {
      return false;
    }

    // 完全权限可以访问任何路径
    if (modulePerms.level === PermissionLevel.FULL) {
      return true;
    }

    // 检查是否在允许的路径列表中
    if (modulePerms.allowedPaths) {
      return modulePerms.allowedPaths.some(allowedPath => 
        targetPath.startsWith(allowedPath)
      );
    }

    // 默认只能访问模块自己的目录
    const modulePath = `modules/${moduleName}`;
    return targetPath.startsWith(modulePath);
  }

  /**
   * 检查模块是否可以访问域名
   */
  canAccessDomain(moduleName: string, domain: string): boolean {
    const modulePerms = this.modulePermissions.get(moduleName);
    
    if (!modulePerms) {
      return false;
    }

    // 完全权限可以访问任何域名
    if (modulePerms.level === PermissionLevel.FULL) {
      return true;
    }

    // 检查是否在允许的域名列表中
    if (modulePerms.allowedDomains) {
      return modulePerms.allowedDomains.some(allowedDomain => {
        // 支持通配符匹配
        if (allowedDomain.startsWith('*.')) {
          const baseDomain = allowedDomain.substring(2);
          // 只匹配子域名,不匹配基础域名本身
          return domain.endsWith('.' + baseDomain);
        }
        return domain === allowedDomain;
      });
    }

    return false;
  }

  /**
   * 授予权限
   */
  grantPermission(moduleName: string, permission: PermissionType): void {
    const modulePerms = this.modulePermissions.get(moduleName);
    
    if (!modulePerms) {
      this.modulePermissions.set(moduleName, {
        level: PermissionLevel.MINIMAL,
        allowedPermissions: [permission]
      });
      return;
    }

    if (!modulePerms.allowedPermissions) {
      modulePerms.allowedPermissions = [];
    }

    if (!modulePerms.allowedPermissions.includes(permission)) {
      modulePerms.allowedPermissions.push(permission);
    }

    // 从拒绝列表中移除
    if (modulePerms.deniedPermissions) {
      modulePerms.deniedPermissions = modulePerms.deniedPermissions.filter(
        p => p !== permission
      );
    }
  }

  /**
   * 撤销权限
   */
  revokePermission(moduleName: string, permission: PermissionType): void {
    const modulePerms = this.modulePermissions.get(moduleName);
    
    if (!modulePerms) {
      return;
    }

    // 从允许列表中移除
    if (modulePerms.allowedPermissions) {
      modulePerms.allowedPermissions = modulePerms.allowedPermissions.filter(
        p => p !== permission
      );
    }

    // 添加到拒绝列表
    if (!modulePerms.deniedPermissions) {
      modulePerms.deniedPermissions = [];
    }

    if (!modulePerms.deniedPermissions.includes(permission)) {
      modulePerms.deniedPermissions.push(permission);
    }
  }

  /**
   * 添加允许的路径
   */
  addAllowedPath(moduleName: string, path: string): void {
    const modulePerms = this.modulePermissions.get(moduleName);
    
    if (!modulePerms) {
      this.modulePermissions.set(moduleName, {
        level: PermissionLevel.MINIMAL,
        allowedPaths: [path]
      });
      return;
    }

    if (!modulePerms.allowedPaths) {
      modulePerms.allowedPaths = [];
    }

    if (!modulePerms.allowedPaths.includes(path)) {
      modulePerms.allowedPaths.push(path);
    }
  }

  /**
   * 添加允许的域名
   */
  addAllowedDomain(moduleName: string, domain: string): void {
    const modulePerms = this.modulePermissions.get(moduleName);
    
    if (!modulePerms) {
      this.modulePermissions.set(moduleName, {
        level: PermissionLevel.MINIMAL,
        allowedDomains: [domain]
      });
      return;
    }

    if (!modulePerms.allowedDomains) {
      modulePerms.allowedDomains = [];
    }

    if (!modulePerms.allowedDomains.includes(domain)) {
      modulePerms.allowedDomains.push(domain);
    }
  }

  /**
   * 移除模块权限
   */
  removeModulePermissions(moduleName: string): void {
    this.modulePermissions.delete(moduleName);
  }

  /**
   * 获取所有模块权限
   */
  getAllModulePermissions(): Map<string, ModulePermissions> {
    return new Map(this.modulePermissions);
  }

  /**
   * 清空所有权限
   */
  clearAll(): void {
    this.modulePermissions.clear();
  }
}

// 导出单例实例
export const permissionManager = new PermissionManager();
