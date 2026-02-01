/**
 * 文件系统代理
 * 提供文件系统访问控制和路径验证
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { permissionManager, PermissionType } from './PermissionManager';

/**
 * 文件系统代理类
 */
export class FileSystemProxy {
  private modulesDirectory: string;

  constructor(modulesDirectory: string = 'modules') {
    this.modulesDirectory = path.resolve(process.cwd(), modulesDirectory);
  }

  /**
   * 验证路径是否安全
   */
  private validatePath(moduleName: string, targetPath: string): void {
    // 检查路径遍历攻击 (在解析前检查)
    if (targetPath.includes('..')) {
      throw new Error(`Path traversal detected: ${targetPath}`);
    }

    // 解析绝对路径
    const absolutePath = path.resolve(targetPath);
    
    // 检查符号链接
    // 注意: 这是简化版本,生产环境需要更严格的检查
    
    // 检查权限
    if (!permissionManager.canAccessPath(moduleName, absolutePath)) {
      throw new Error(`Access denied: ${moduleName} cannot access ${targetPath}`);
    }
  }

  /**
   * 读取文件 (代理)
   */
  async readFile(
    moduleName: string,
    filePath: string,
    encoding: BufferEncoding = 'utf-8'
  ): Promise<string> {
    // 检查读权限
    if (!permissionManager.hasPermission(moduleName, PermissionType.FILE_READ)) {
      throw new Error(`Permission denied: ${moduleName} does not have FILE_READ permission`);
    }

    // 验证路径
    this.validatePath(moduleName, filePath);

    // 执行读取
    return await fs.readFile(filePath, encoding);
  }

  /**
   * 写入文件 (代理)
   */
  async writeFile(
    moduleName: string,
    filePath: string,
    data: string | Buffer,
    encoding: BufferEncoding = 'utf-8'
  ): Promise<void> {
    // 检查写权限
    if (!permissionManager.hasPermission(moduleName, PermissionType.FILE_WRITE)) {
      throw new Error(`Permission denied: ${moduleName} does not have FILE_WRITE permission`);
    }

    // 验证路径
    this.validatePath(moduleName, filePath);

    // 执行写入
    await fs.writeFile(filePath, data, encoding);
  }

  /**
   * 删除文件 (代理)
   */
  async deleteFile(moduleName: string, filePath: string): Promise<void> {
    // 检查删除权限
    if (!permissionManager.hasPermission(moduleName, PermissionType.FILE_DELETE)) {
      throw new Error(`Permission denied: ${moduleName} does not have FILE_DELETE permission`);
    }

    // 验证路径
    this.validatePath(moduleName, filePath);

    // 执行删除
    await fs.unlink(filePath);
  }

  /**
   * 读取目录 (代理)
   */
  async readDirectory(moduleName: string, dirPath: string): Promise<string[]> {
    // 检查读权限
    if (!permissionManager.hasPermission(moduleName, PermissionType.FILE_READ)) {
      throw new Error(`Permission denied: ${moduleName} does not have FILE_READ permission`);
    }

    // 验证路径
    this.validatePath(moduleName, dirPath);

    // 执行读取
    return await fs.readdir(dirPath);
  }

  /**
   * 检查文件是否存在 (代理)
   */
  async exists(moduleName: string, filePath: string): Promise<boolean> {
    // 检查读权限
    if (!permissionManager.hasPermission(moduleName, PermissionType.FILE_READ)) {
      throw new Error(`Permission denied: ${moduleName} does not have FILE_READ permission`);
    }

    // 验证路径
    this.validatePath(moduleName, filePath);

    // 检查存在性
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取文件信息 (代理)
   */
  async stat(moduleName: string, filePath: string): Promise<any> {
    // 检查读权限
    if (!permissionManager.hasPermission(moduleName, PermissionType.FILE_READ)) {
      throw new Error(`Permission denied: ${moduleName} does not have FILE_READ permission`);
    }

    // 验证路径
    this.validatePath(moduleName, filePath);

    // 获取信息
    return await fs.stat(filePath);
  }
}

// 导出单例实例
export const fileSystemProxy = new FileSystemProxy();
