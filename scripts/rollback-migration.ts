#!/usr/bin/env ts-node

/**
 * AI 数据问答平台 - 数据迁移回滚脚本
 * 版本: 1.0.0
 * 日期: 2026-02-01
 * 
 * 用途: 回滚数据迁移，恢复到迁移前的状态
 */

import { createConnection, Connection } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as readline from 'readline';

// 加载环境变量
dotenv.config({ path: '.env.production' });

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

// 日志函数
const log = {
  info: (msg: string) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  warn: (msg: string) => console.log(`${colors.yellow}[WARN]${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
};

// 回滚统计
interface RollbackStats {
  tablesCleared: number;
  recordsDeleted: number;
  backupsRestored: number;
  errors: number;
}

const stats: RollbackStats = {
  tablesCleared: 0,
  recordsDeleted: 0,
  backupsRestored: 0,
  errors: 0,
};

/**
 * 创建 readline 接口
 */
function createReadlineInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * 询问用户确认
 */
async function askConfirmation(question: string): Promise<boolean> {
  const rl = createReadlineInterface();
  
  return new Promise((resolve) => {
    rl.question(`${colors.yellow}${question} (yes/no): ${colors.reset}`, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

/**
 * 创建数据库连接
 */
async function createDatabaseConnection(): Promise<Connection> {
  log.info('连接数据库...');
  
  const connection = await createConnection({
    type: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: 'utf8mb4',
  });
  
  log.success('数据库连接成功');
  return connection;
}

/**
 * 查找备份文件
 */
function findBackupFile(): string | null {
  const backupDir = path.join(__dirname, '../backups');
  
  if (!fs.existsSync(backupDir)) {
    log.warn('备份目录不存在');
    return null;
  }
  
  const files = fs.readdirSync(backupDir)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .reverse();
  
  if (files.length === 0) {
    log.warn('没有找到备份文件');
    return null;
  }
  
  const latestBackup = files[0];
  log.info(`找到最新备份: ${latestBackup}`);
  
  return path.join(backupDir, latestBackup);
}

/**
 * 清空迁移的数据
 */
async function clearMigratedData(connection: Connection): Promise<void> {
  log.info('清空迁移的数据...');
  
  const tables = [
    'sys_modules',
    'sys_module_configs',
    'sys_module_dependencies',
  ];
  
  for (const table of tables) {
    try {
      // 检查表是否存在
      const tableExists = await connection.query(
        "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = ?",
        [process.env.DB_NAME, table]
      );
      
      if (tableExists[0].count > 0) {
        // 获取记录数
        const countResult = await connection.query(`SELECT COUNT(*) as count FROM ${table}`);
        const recordCount = countResult[0].count;
        
        if (recordCount > 0) {
          // 清空表
          await connection.query(`DELETE FROM ${table}`);
          
          stats.tablesCleared++;
          stats.recordsDeleted += recordCount;
          
          log.success(`清空表 ${table}: ${recordCount} 条记录`);
        } else {
          log.info(`表 ${table} 已经是空的`);
        }
      } else {
        log.warn(`表 ${table} 不存在`);
      }
    } catch (error) {
      log.error(`清空表 ${table} 失败: ${error.message}`);
      stats.errors++;
    }
  }
}

/**
 * 恢复备份数据
 */
async function restoreBackup(connection: Connection, backupFile: string): Promise<void> {
  log.info('恢复备份数据...');
  
  try {
    // 读取备份文件
    const sql = fs.readFileSync(backupFile, 'utf8');
    
    // 分割 SQL 语句
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    log.info(`执行 ${statements.length} 条 SQL 语句...`);
    
    // 执行 SQL 语句
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      try {
        await connection.query(statement);
        
        if ((i + 1) % 100 === 0) {
          log.info(`已执行 ${i + 1}/${statements.length} 条语句`);
        }
      } catch (error) {
        log.error(`执行 SQL 失败: ${error.message}`);
        log.error(`SQL: ${statement.substring(0, 100)}...`);
        stats.errors++;
      }
    }
    
    stats.backupsRestored++;
    log.success('备份数据恢复完成');
  } catch (error) {
    log.error(`恢复备份失败: ${error.message}`);
    stats.errors++;
    throw error;
  }
}

/**
 * 重置自增 ID
 */
async function resetAutoIncrement(connection: Connection): Promise<void> {
  log.info('重置自增 ID...');
  
  const tables = [
    'sys_users',
    'sys_roles',
    'sys_permissions',
    'sys_menus',
    'sys_modules',
    'sys_configs',
  ];
  
  for (const table of tables) {
    try {
      // 检查表是否存在
      const tableExists = await connection.query(
        "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = ?",
        [process.env.DB_NAME, table]
      );
      
      if (tableExists[0].count > 0) {
        // 获取最大 ID
        const maxIdResult = await connection.query(`SELECT MAX(id) as maxId FROM ${table}`);
        const maxId = maxIdResult[0].maxId || 0;
        
        // 重置自增 ID
        await connection.query(`ALTER TABLE ${table} AUTO_INCREMENT = ${maxId + 1}`);
        
        log.success(`重置表 ${table} 自增 ID: ${maxId + 1}`);
      }
    } catch (error) {
      log.error(`重置表 ${table} 自增 ID 失败: ${error.message}`);
      stats.errors++;
    }
  }
}

/**
 * 验证回滚结果
 */
async function validateRollback(connection: Connection): Promise<void> {
  log.info('验证回滚结果...');
  
  try {
    // 检查模块表
    const moduleCount = await connection.query('SELECT COUNT(*) as count FROM sys_modules');
    log.info(`模块数量: ${moduleCount[0].count}`);
    
    // 检查用户表
    const userCount = await connection.query('SELECT COUNT(*) as count FROM sys_users');
    log.info(`用户数量: ${userCount[0].count}`);
    
    // 检查角色表
    const roleCount = await connection.query('SELECT COUNT(*) as count FROM sys_roles');
    log.info(`角色数量: ${roleCount[0].count}`);
    
    log.success('回滚验证完成');
  } catch (error) {
    log.error(`回滚验证失败: ${error.message}`);
    stats.errors++;
  }
}

/**
 * 生成回滚报告
 */
function generateReport(): void {
  log.info('========================================');
  log.info('数据迁移回滚报告');
  log.info('========================================');
  log.info(`清空表数量: ${stats.tablesCleared}`);
  log.info(`删除记录数: ${stats.recordsDeleted}`);
  log.info(`恢复备份数: ${stats.backupsRestored}`);
  log.info(`错误数量: ${stats.errors}`);
  log.info('========================================');
  
  // 保存报告到文件
  const reportPath = path.join(__dirname, '../logs/rollback-report.json');
  const reportDir = path.dirname(reportPath);
  
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  fs.writeFileSync(
    reportPath,
    JSON.stringify({
      timestamp: new Date().toISOString(),
      stats,
    }, null, 2)
  );
  
  log.success(`回滚报告已保存: ${reportPath}`);
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  let connection: Connection | null = null;
  
  try {
    log.info('========================================');
    log.info('AI 数据问答平台 - 数据迁移回滚');
    log.info('========================================');
    
    // 警告信息
    log.warn('');
    log.warn('⚠️  警告: 此操作将回滚数据迁移，删除迁移的数据！');
    log.warn('⚠️  请确保已经备份了重要数据！');
    log.warn('');
    
    // 询问确认
    const confirmed = await askConfirmation('确定要继续吗？');
    
    if (!confirmed) {
      log.info('回滚已取消');
      process.exit(0);
    }
    
    // 创建数据库连接
    connection = await createDatabaseConnection();
    
    // 查找备份文件
    const backupFile = findBackupFile();
    
    if (backupFile) {
      const useBackup = await askConfirmation(`是否恢复备份文件 ${path.basename(backupFile)}？`);
      
      if (useBackup) {
        // 恢复备份
        await restoreBackup(connection, backupFile);
      }
    }
    
    // 清空迁移的数据
    await clearMigratedData(connection);
    
    // 重置自增 ID
    await resetAutoIncrement(connection);
    
    // 验证回滚结果
    await validateRollback(connection);
    
    // 生成报告
    generateReport();
    
    log.info('========================================');
    if (stats.errors === 0) {
      log.success('数据迁移回滚完成 ✓');
    } else {
      log.warn(`数据迁移回滚完成，但有 ${stats.errors} 个错误`);
    }
    log.info('========================================');
    
    process.exit(0);
  } catch (error) {
    log.error(`数据迁移回滚失败: ${error.message}`);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

// 执行主函数
main();
