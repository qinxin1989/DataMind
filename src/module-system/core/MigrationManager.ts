/**
 * 数据库迁移管理器
 * 负责管理模块的数据库版本和迁移
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { query, transaction } from '../../admin/core/database';

/**
 * 迁移接口
 */
export interface Migration {
  version: string;
  name: string;
  upFile: string;
  downFile: string;
}

/**
 * 迁移记录接口
 */
export interface MigrationRecord {
  id: string;
  moduleName: string;
  version: string;
  name: string;
  executedAt: Date;
  executionTime: number;
}

/**
 * 迁移管理器类
 */
export class MigrationManager {
  private modulesDirectory: string;

  constructor(modulesDirectory: string = 'modules') {
    this.modulesDirectory = path.resolve(process.cwd(), modulesDirectory);
  }

  /**
   * 执行迁移
   */
  async migrate(moduleName: string, targetVersion?: string): Promise<void> {
    try {
      const migrations = await this.getPendingMigrations(moduleName);
      
      if (migrations.length === 0) {
        console.log(`No pending migrations for module ${moduleName}`);
        return;
      }

      // 过滤到目标版本
      const toExecute = targetVersion
        ? migrations.filter(m => m.version <= targetVersion)
        : migrations;

      for (const migration of toExecute) {
        await this.executeMigration(moduleName, migration);
      }

      console.log(`Migrations completed for module ${moduleName}`);
    } catch (error) {
      throw new Error(`Failed to migrate module ${moduleName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 回滚迁移
   */
  async rollback(moduleName: string, targetVersion: string): Promise<void> {
    try {
      const currentVersion = await this.getCurrentVersion(moduleName);
      
      if (!currentVersion) {
        throw new Error('No migrations to rollback');
      }

      if (targetVersion >= currentVersion) {
        throw new Error('Target version must be lower than current version');
      }

      const migrations = await this.getExecutedMigrations(moduleName);
      const toRollback = migrations.filter(m => m.version > targetVersion);

      // 按版本倒序回滚
      toRollback.reverse();

      for (const migration of toRollback) {
        await this.rollbackMigration(moduleName, migration);
      }

      console.log(`Rollback completed for module ${moduleName}`);
    } catch (error) {
      throw new Error(`Failed to rollback module ${moduleName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取当前版本
   */
  async getCurrentVersion(moduleName: string): Promise<string | null> {
    try {
      const result = await query(
        `SELECT version FROM sys_module_migrations 
         WHERE module_name = ? 
         ORDER BY version DESC 
         LIMIT 1`,
        [moduleName]
      );

      return result.length > 0 ? result[0].version : null;
    } catch (error) {
      throw new Error(`Failed to get current version: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取待执行的迁移
   */
  async getPendingMigrations(moduleName: string): Promise<Migration[]> {
    try {
      const currentVersion = await this.getCurrentVersion(moduleName);
      const allMigrations = await this.scanMigrations(moduleName);

      if (!currentVersion) {
        return allMigrations;
      }

      return allMigrations.filter(m => m.version > currentVersion);
    } catch (error) {
      throw new Error(`Failed to get pending migrations: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取已执行的迁移
   */
  private async getExecutedMigrations(moduleName: string): Promise<Migration[]> {
    try {
      const records = await query(
        `SELECT version, name FROM sys_module_migrations 
         WHERE module_name = ? 
         ORDER BY version ASC`,
        [moduleName]
      );

      return records.map((r: any) => ({
        version: r.version,
        name: r.name,
        upFile: '',
        downFile: ''
      }));
    } catch (error) {
      throw new Error(`Failed to get executed migrations: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 扫描迁移文件
   */
  private async scanMigrations(moduleName: string): Promise<Migration[]> {
    const migrationsDir = path.join(this.modulesDirectory, moduleName, 'backend', 'migrations');
    
    try {
      const files = await fs.readdir(migrationsDir);
      const sqlFiles = files.filter(f => f.endsWith('.sql') && !f.startsWith('rollback'));

      const migrations: Migration[] = [];

      for (const file of sqlFiles) {
        const match = file.match(/^(\d+)_(.+)\.sql$/);
        if (match) {
          const version = match[1];
          const name = match[2];
          
          migrations.push({
            version,
            name,
            upFile: path.join(migrationsDir, file),
            downFile: path.join(migrationsDir, 'rollback', file)
          });
        }
      }

      return migrations.sort((a, b) => a.version.localeCompare(b.version));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * 执行单个迁移
   */
  private async executeMigration(moduleName: string, migration: Migration): Promise<void> {
    const startTime = Date.now();

    try {
      const sql = await fs.readFile(migration.upFile, 'utf-8');

      await transaction(async (conn) => {
        // 执行 SQL
        const statements = sql.split(';').filter(s => s.trim());
        for (const statement of statements) {
          if (statement.trim()) {
            await query(statement, [], conn);
          }
        }

        // 记录迁移
        await query(
          `INSERT INTO sys_module_migrations 
           (id, module_name, version, name, executed_at, execution_time)
           VALUES (?, ?, ?, ?, NOW(), ?)`,
          [
            uuidv4(),
            moduleName,
            migration.version,
            migration.name,
            Date.now() - startTime
          ],
          conn
        );
      });

      console.log(`Migration ${migration.version}_${migration.name} executed for module ${moduleName}`);
    } catch (error) {
      throw new Error(`Failed to execute migration ${migration.version}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 回滚单个迁移
   */
  private async rollbackMigration(moduleName: string, migration: Migration): Promise<void> {
    try {
      const downFile = path.join(
        this.modulesDirectory,
        moduleName,
        'backend',
        'migrations',
        'rollback',
        `${migration.version}_${migration.name}.sql`
      );

      const sql = await fs.readFile(downFile, 'utf-8');

      await transaction(async (conn) => {
        // 执行回滚 SQL
        const statements = sql.split(';').filter(s => s.trim());
        for (const statement of statements) {
          if (statement.trim()) {
            await query(statement, [], conn);
          }
        }

        // 删除迁移记录
        await query(
          'DELETE FROM sys_module_migrations WHERE module_name = ? AND version = ?',
          [moduleName, migration.version],
          conn
        );
      });

      console.log(`Migration ${migration.version}_${migration.name} rolled back for module ${moduleName}`);
    } catch (error) {
      throw new Error(`Failed to rollback migration ${migration.version}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// 导出单例实例
export const migrationManager = new MigrationManager();
