/**
 * 备份恢复服务
 * 实现数据备份和恢复功能
 */

import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const DATA_DIR = path.join(process.cwd(), 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

export interface BackupInfo {
  id: string;
  name: string;
  description?: string;
  size: number;
  createdAt: number;
  files: string[];
}

export class BackupService {
  constructor() {
    this.ensureBackupDir();
  }

  private ensureBackupDir(): void {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
  }

  private getBackupPath(id: string): string {
    return path.join(BACKUP_DIR, id);
  }

  private getBackupMetaFile(id: string): string {
    return path.join(this.getBackupPath(id), 'meta.json');
  }

  // ==================== 备份管理 ====================

  async createBackup(name: string, description?: string): Promise<BackupInfo> {
    const id = uuidv4();
    const backupPath = this.getBackupPath(id);
    fs.mkdirSync(backupPath, { recursive: true });

    // 要备份的文件
    const filesToBackup = [
      'users.json',
      'roles.json',
      'permissions.json',
      'menus.json',
      'ai-configs.json',
      'system-configs.json',
      'admin-users.json',
    ];

    const backedUpFiles: string[] = [];
    let totalSize = 0;

    for (const file of filesToBackup) {
      const srcPath = path.join(DATA_DIR, file);
      if (fs.existsSync(srcPath)) {
        const destPath = path.join(backupPath, file);
        fs.copyFileSync(srcPath, destPath);
        const stats = fs.statSync(destPath);
        totalSize += stats.size;
        backedUpFiles.push(file);
      }
    }

    const backupInfo: BackupInfo = {
      id,
      name,
      description,
      size: totalSize,
      createdAt: Date.now(),
      files: backedUpFiles,
    };

    // 保存元数据
    fs.writeFileSync(this.getBackupMetaFile(id), JSON.stringify(backupInfo, null, 2));

    return backupInfo;
  }

  async listBackups(): Promise<BackupInfo[]> {
    const backups: BackupInfo[] = [];

    if (!fs.existsSync(BACKUP_DIR)) {
      return backups;
    }

    const dirs = fs.readdirSync(BACKUP_DIR);
    for (const dir of dirs) {
      const metaFile = path.join(BACKUP_DIR, dir, 'meta.json');
      if (fs.existsSync(metaFile)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaFile, 'utf-8'));
          backups.push(meta);
        } catch {
          // 忽略无效的备份
        }
      }
    }

    // 按时间倒序
    backups.sort((a, b) => b.createdAt - a.createdAt);
    return backups;
  }

  async getBackup(id: string): Promise<BackupInfo | null> {
    const metaFile = this.getBackupMetaFile(id);
    if (!fs.existsSync(metaFile)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(metaFile, 'utf-8'));
  }

  async deleteBackup(id: string): Promise<void> {
    const backupPath = this.getBackupPath(id);
    if (!fs.existsSync(backupPath)) {
      throw new Error('备份不存在');
    }

    // 删除备份目录
    const files = fs.readdirSync(backupPath);
    for (const file of files) {
      fs.unlinkSync(path.join(backupPath, file));
    }
    fs.rmdirSync(backupPath);
  }

  // ==================== 恢复功能 ====================

  async restoreBackup(id: string): Promise<{ restored: string[]; skipped: string[] }> {
    const backupPath = this.getBackupPath(id);
    const metaFile = this.getBackupMetaFile(id);

    if (!fs.existsSync(metaFile)) {
      throw new Error('备份不存在');
    }

    const meta: BackupInfo = JSON.parse(fs.readFileSync(metaFile, 'utf-8'));
    const restored: string[] = [];
    const skipped: string[] = [];

    for (const file of meta.files) {
      const srcPath = path.join(backupPath, file);
      const destPath = path.join(DATA_DIR, file);

      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        restored.push(file);
      } else {
        skipped.push(file);
      }
    }

    return { restored, skipped };
  }

  // ==================== 验证功能 ====================

  async verifyBackup(id: string): Promise<{ valid: boolean; errors: string[] }> {
    const backupPath = this.getBackupPath(id);
    const metaFile = this.getBackupMetaFile(id);
    const errors: string[] = [];

    if (!fs.existsSync(metaFile)) {
      return { valid: false, errors: ['备份元数据不存在'] };
    }

    try {
      const meta: BackupInfo = JSON.parse(fs.readFileSync(metaFile, 'utf-8'));

      for (const file of meta.files) {
        const filePath = path.join(backupPath, file);
        if (!fs.existsSync(filePath)) {
          errors.push(`文件缺失: ${file}`);
          continue;
        }

        // 验证 JSON 格式
        try {
          JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        } catch {
          errors.push(`文件格式无效: ${file}`);
        }
      }
    } catch {
      errors.push('元数据格式无效');
    }

    return { valid: errors.length === 0, errors };
  }

  // ==================== 导出功能 ====================

  async exportBackup(id: string): Promise<string> {
    const backupPath = this.getBackupPath(id);
    const metaFile = this.getBackupMetaFile(id);

    if (!fs.existsSync(metaFile)) {
      throw new Error('备份不存在');
    }

    const meta: BackupInfo = JSON.parse(fs.readFileSync(metaFile, 'utf-8'));
    const exportData: Record<string, any> = {
      meta,
      data: {},
    };

    for (const file of meta.files) {
      const filePath = path.join(backupPath, file);
      if (fs.existsSync(filePath)) {
        exportData.data[file] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
    }

    return JSON.stringify(exportData, null, 2);
  }

  // ==================== 测试辅助 ====================

  clearAll(): void {
    if (fs.existsSync(BACKUP_DIR)) {
      const dirs = fs.readdirSync(BACKUP_DIR);
      for (const dir of dirs) {
        const dirPath = path.join(BACKUP_DIR, dir);
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
          fs.unlinkSync(path.join(dirPath, file));
        }
        fs.rmdirSync(dirPath);
      }
    }
  }
}

export const backupService = new BackupService();
