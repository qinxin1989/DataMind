/**
 * 系统备份服务
 */

import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type {
  SystemBackup,
  CreateBackupRequest,
  BackupQueryParams,
  BackupQueryResult,
  RestoreResult,
  VerifyResult,
  SystemBackupModuleConfig
} from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DEFAULT_BACKUP_DIR = path.join(DATA_DIR, 'backups');

export class SystemBackupService {
  private db: any;
  private config: SystemBackupModuleConfig;

  constructor(db: any, config?: Partial<SystemBackupModuleConfig>) {
    this.db = db;
    this.config = {
      backupDir: DEFAULT_BACKUP_DIR,
      maxBackups: 50,
      autoCleanup: true,
      retentionDays: 30,
      ...config
    };
    this.ensureBackupDir();
  }

  private ensureBackupDir(): void {
    if (!fs.existsSync(this.config.backupDir)) {
      fs.mkdirSync(this.config.backupDir, { recursive: true });
    }
  }

  private getBackupPath(id: string): string {
    return path.join(this.config.backupDir, id);
  }

  // ==================== 备份管理 ====================

  /**
   * 创建备份
   */
  async createBackup(request: CreateBackupRequest): Promise<SystemBackup> {
    const id = uuidv4();
    const now = Date.now();
    const backupPath = this.getBackupPath(id);

    try {
      // 创建备份目录
      fs.mkdirSync(backupPath, { recursive: true });

      // 要备份的文件
      const filesToBackup = [
        'users.json',
        'roles.json',
        'permissions.json',
        'menus.json',
        'ai-configs.json',
        'system-configs.json',
        'admin-users.json'
      ];

      let totalSize = 0;
      let fileCount = 0;

      // 复制文件
      for (const file of filesToBackup) {
        const srcPath = path.join(DATA_DIR, file);
        if (fs.existsSync(srcPath)) {
          const destPath = path.join(backupPath, file);
          fs.copyFileSync(srcPath, destPath);
          const stats = fs.statSync(destPath);
          totalSize += stats.size;
          fileCount++;
        }
      }

      // 导出关键数据库表
      const tablesToExport = ['sys_users', 'sys_audit_logs', 'sys_chat_history', 'system_configs'];
      for (const tableName of tablesToExport) {
        try {
          const [rows] = await this.db.query(`SELECT * FROM ${tableName}`);
          if (Array.isArray(rows)) { // 即使为空也导出结构
            const destPath = path.join(backupPath, `${tableName}.json`);
            fs.writeFileSync(destPath, JSON.stringify(rows, null, 2));
            const stats = fs.statSync(destPath);
            totalSize += stats.size;
            fileCount++;
          }
        } catch (err: any) {
          console.warn(`[Backup] Failed to export table ${tableName}: ${err.message}`);
          // 继续执行，不中断备份
        }
      }

      // 创建备份记录
      const query = `
        INSERT INTO system_backups 
        (id, name, description, backup_size, file_count, backup_path, status, created_by, created_at, completed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await this.db.execute(query, [
        id,
        request.name,
        request.description || null,
        totalSize,
        fileCount,
        backupPath,
        'completed',
        request.createdBy || 'system',
        new Date(now),
        new Date(now)
      ]);

      const backup = await this.getBackup(id);
      if (!backup) {
        throw new Error('创建备份失败');
      }

      return backup;
    } catch (error: any) {
      // 清理失败的备份
      if (fs.existsSync(backupPath)) {
        try {
          const files = fs.readdirSync(backupPath);
          for (const file of files) {
            fs.unlinkSync(path.join(backupPath, file));
          }
          fs.rmdirSync(backupPath);
        } catch {
          // 忽略清理错误
        }
      }

      // 记录失败
      const failQuery = `
        INSERT INTO system_backups 
        (id, name, description, backup_size, file_count, backup_path, status, created_by, created_at, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await this.db.execute(failQuery, [
        id,
        request.name,
        request.description ?? null,
        0,
        0,
        backupPath,
        'failed',
        request.createdBy ?? null,
        new Date(now),
        error.message ?? 'Unknown error'
      ]);

      throw error;
    }
  }

  /**
   * 获取单个备份
   */
  async getBackup(id: string): Promise<SystemBackup | null> {
    const query = 'SELECT * FROM system_backups WHERE id = ?';
    const [rows]: any = await this.db.execute(query, [id]);
    return rows.length > 0 ? this.mapRowToBackup(rows[0]) : null;
  }

  /**
   * 查询备份列表
   */
  async queryBackups(params: BackupQueryParams = {}): Promise<BackupQueryResult> {
    const {
      status,
      createdBy,
      startDate,
      endDate,
      page = 1,
      pageSize = 20
    } = params;

    // 构建查询条件
    const conditions: string[] = [];
    const values: any[] = [];

    if (status) {
      conditions.push('status = ?');
      values.push(status);
    }

    if (createdBy) {
      conditions.push('created_by = ?');
      values.push(createdBy);
    }

    if (startDate) {
      conditions.push('created_at >= ?');
      values.push(startDate);
    }

    if (endDate) {
      conditions.push('created_at <= ?');
      values.push(endDate);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // 获取总数
    const countQuery = `SELECT COUNT(*) as total FROM system_backups ${whereClause}`;
    const params1 = values.map(v => v === undefined ? null : v);
    console.log('[SystemBackup] Count Query:', countQuery, 'Params:', params1);
    const [countRows]: any = await this.db.execute(countQuery, params1);
    const total = countRows[0].total;

    // 获取数据 - LIMIT/OFFSET 不使用参数绑定，因可能导致Incorrect arguments错误
    const offset = (Number(page) - 1) * Number(pageSize);
    const dataQuery = `
      SELECT * FROM system_backups 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${Number(pageSize)} OFFSET ${offset}
    `;
    // 移除最后两个参数
    console.log('[SystemBackup] Data Query:', dataQuery, 'Params:', params1);
    const [rows]: any = await this.db.execute(dataQuery, params1);

    return {
      total,
      page,
      pageSize,
      items: rows.map((row: any) => this.mapRowToBackup(row))
    };
  }

  /**
   * 删除备份
   */
  async deleteBackup(id: string): Promise<void> {
    const backup = await this.getBackup(id);
    if (!backup) {
      throw new Error('备份不存在');
    }

    // 删除文件
    if (fs.existsSync(backup.backupPath)) {
      try {
        const files = fs.readdirSync(backup.backupPath);
        for (const file of files) {
          fs.unlinkSync(path.join(backup.backupPath, file));
        }
        fs.rmdirSync(backup.backupPath);
      } catch (error: any) {
        console.error('删除备份文件失败:', error);
      }
    }

    // 删除记录
    const query = 'DELETE FROM system_backups WHERE id = ?';
    await this.db.execute(query, [id]);
  }

  // ==================== 恢复功能 ====================

  /**
   * 恢复备份
   */
  async restoreBackup(id: string): Promise<RestoreResult> {
    const backup = await this.getBackup(id);
    if (!backup) {
      throw new Error('备份不存在');
    }

    if (backup.status !== 'completed') {
      throw new Error('只能恢复已完成的备份');
    }

    if (!fs.existsSync(backup.backupPath)) {
      throw new Error('备份文件不存在');
    }

    const restored: string[] = [];
    const skipped: string[] = [];

    try {
      const files = fs.readdirSync(backup.backupPath);

      for (const file of files) {
        const srcPath = path.join(backup.backupPath, file);
        const destPath = path.join(DATA_DIR, file);

        if (fs.existsSync(srcPath) && file.endsWith('.json')) {
          fs.copyFileSync(srcPath, destPath);
          restored.push(file);
        } else {
          skipped.push(file);
        }
      }

      return {
        success: true,
        restored,
        skipped,
        message: `成功恢复 ${restored.length} 个文件`
      };
    } catch (error: any) {
      return {
        success: false,
        restored,
        skipped,
        message: `恢复失败: ${error.message}`
      };
    }
  }

  // ==================== 验证功能 ====================

  /**
   * 验证备份
   */
  async verifyBackup(id: string): Promise<VerifyResult> {
    const backup = await this.getBackup(id);
    if (!backup) {
      return {
        valid: false,
        errors: ['备份不存在'],
        message: '备份不存在'
      };
    }

    if (!fs.existsSync(backup.backupPath)) {
      return {
        valid: false,
        errors: ['备份目录不存在'],
        message: '备份目录不存在'
      };
    }

    const errors: string[] = [];

    try {
      const files = fs.readdirSync(backup.backupPath);

      for (const file of files) {
        if (!file.endsWith('.json')) {
          continue;
        }

        const filePath = path.join(backup.backupPath, file);

        // 检查文件是否存在
        if (!fs.existsSync(filePath)) {
          errors.push(`文件缺失: ${file}`);
          continue;
        }

        // 验证 JSON 格式
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          JSON.parse(content);
        } catch {
          errors.push(`文件格式无效: ${file}`);
        }
      }

      const valid = errors.length === 0;
      return {
        valid,
        errors,
        message: valid ? '备份验证通过' : `发现 ${errors.length} 个错误`
      };
    } catch (error: any) {
      return {
        valid: false,
        errors: [error.message],
        message: `验证失败: ${error.message}`
      };
    }
  }

  // ==================== 导出功能 ====================

  /**
   * 导出备份
   */
  async exportBackup(id: string): Promise<string> {
    const backup = await this.getBackup(id);
    if (!backup) {
      throw new Error('备份不存在');
    }

    if (!fs.existsSync(backup.backupPath)) {
      throw new Error('备份文件不存在');
    }

    const exportData: Record<string, any> = {
      meta: backup,
      data: {}
    };

    const files = fs.readdirSync(backup.backupPath);
    for (const file of files) {
      if (!file.endsWith('.json')) {
        continue;
      }

      const filePath = path.join(backup.backupPath, file);
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          exportData.data[file] = JSON.parse(content);
        } catch {
          // 忽略无效文件
        }
      }
    }

    return JSON.stringify(exportData, null, 2);
  }

  // ==================== 清理功能 ====================

  /**
   * 清理过期备份
   */
  async cleanupOldBackups(): Promise<number> {
    const beforeDate = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000);

    const query = 'SELECT id FROM system_backups WHERE created_at < ? AND status = ?';
    const [rows]: any = await this.db.execute(query, [new Date(beforeDate), 'completed']);

    let count = 0;
    for (const row of rows) {
      try {
        await this.deleteBackup(row.id);
        count++;
      } catch (error) {
        console.error(`删除备份失败: ${row.id}`, error);
      }
    }

    return count;
  }

  // ==================== 辅助方法 ====================

  /**
   * 映射数据库行到备份对象
   */
  private mapRowToBackup(row: any): SystemBackup {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      backupSize: row.backup_size,
      fileCount: row.file_count,
      backupPath: row.backup_path,
      status: row.status,
      createdBy: row.created_by,
      createdAt: row.created_at,
      completedAt: row.completed_at,
      errorMessage: row.error_message
    };
  }
}
