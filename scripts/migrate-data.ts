#!/usr/bin/env ts-node

/**
 * AI 数据问答平台 - 数据迁移脚本
 * 版本: 1.0.0
 * 日期: 2026-02-01
 * 
 * 用途: 从旧系统迁移数据到新的模块化系统
 */

import { createConnection, Connection } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

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
  info: (msg: string) => console.log(`${colors.green}[INFO]${colors.reset} ${msg}`),
  warn: (msg: string) => console.log(`${colors.yellow}[WARN]${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
};

// 迁移统计
interface MigrationStats {
  users: number;
  roles: number;
  permissions: number;
  menus: number;
  modules: number;
  configs: number;
  errors: number;
}

const stats: MigrationStats = {
  users: 0,
  roles: 0,
  permissions: 0,
  menus: 0,
  modules: 0,
  configs: 0,
  errors: 0,
};

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
 * 迁移用户数据
 */
async function migrateUsers(connection: Connection): Promise<void> {
  log.info('迁移用户数据...');
  
  try {
    // 检查用户表是否存在
    const hasUsers = await connection.query(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'sys_users'",
      [process.env.DB_NAME]
    );
    
    if (hasUsers[0].count === 0) {
      log.warn('用户表不存在，跳过用户迁移');
      return;
    }
    
    // 获取用户数量
    const userCount = await connection.query('SELECT COUNT(*) as count FROM sys_users');
    stats.users = userCount[0].count;
    
    log.success(`用户数据迁移完成: ${stats.users} 条记录`);
  } catch (error) {
    log.error(`用户数据迁移失败: ${error.message}`);
    stats.errors++;
  }
}

/**
 * 迁移角色数据
 */
async function migrateRoles(connection: Connection): Promise<void> {
  log.info('迁移角色数据...');
  
  try {
    // 检查角色表是否存在
    const hasRoles = await connection.query(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'sys_roles'",
      [process.env.DB_NAME]
    );
    
    if (hasRoles[0].count === 0) {
      log.warn('角色表不存在，跳过角色迁移');
      return;
    }
    
    // 获取角色数量
    const roleCount = await connection.query('SELECT COUNT(*) as count FROM sys_roles');
    stats.roles = roleCount[0].count;
    
    log.success(`角色数据迁移完成: ${stats.roles} 条记录`);
  } catch (error) {
    log.error(`角色数据迁移失败: ${error.message}`);
    stats.errors++;
  }
}

/**
 * 迁移权限数据
 */
async function migratePermissions(connection: Connection): Promise<void> {
  log.info('迁移权限数据...');
  
  try {
    // 检查权限表是否存在
    const hasPermissions = await connection.query(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'sys_permissions'",
      [process.env.DB_NAME]
    );
    
    if (hasPermissions[0].count === 0) {
      log.warn('权限表不存在，跳过权限迁移');
      return;
    }
    
    // 获取权限数量
    const permissionCount = await connection.query('SELECT COUNT(*) as count FROM sys_permissions');
    stats.permissions = permissionCount[0].count;
    
    log.success(`权限数据迁移完成: ${stats.permissions} 条记录`);
  } catch (error) {
    log.error(`权限数据迁移失败: ${error.message}`);
    stats.errors++;
  }
}

/**
 * 迁移菜单数据
 */
async function migrateMenus(connection: Connection): Promise<void> {
  log.info('迁移菜单数据...');
  
  try {
    // 检查菜单表是否存在
    const hasMenus = await connection.query(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'sys_menus'",
      [process.env.DB_NAME]
    );
    
    if (hasMenus[0].count === 0) {
      log.warn('菜单表不存在，跳过菜单迁移');
      return;
    }
    
    // 获取菜单数量
    const menuCount = await connection.query('SELECT COUNT(*) as count FROM sys_menus');
    stats.menus = menuCount[0].count;
    
    log.success(`菜单数据迁移完成: ${stats.menus} 条记录`);
  } catch (error) {
    log.error(`菜单数据迁移失败: ${error.message}`);
    stats.errors++;
  }
}

/**
 * 迁移模块数据
 */
async function migrateModules(connection: Connection): Promise<void> {
  log.info('迁移模块数据...');
  
  try {
    // 检查模块表是否存在
    const hasModules = await connection.query(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'sys_modules'",
      [process.env.DB_NAME]
    );
    
    if (hasModules[0].count === 0) {
      log.info('模块表不存在，创建模块表...');
      
      // 读取并执行模块系统表创建脚本
      const sqlPath = path.join(__dirname, '../migrations/create-module-system-tables.sql');
      if (fs.existsSync(sqlPath)) {
        const sql = fs.readFileSync(sqlPath, 'utf8');
        const statements = sql.split(';').filter(s => s.trim());
        
        for (const statement of statements) {
          if (statement.trim()) {
            await connection.query(statement);
          }
        }
        
        log.success('模块表创建成功');
      } else {
        log.warn('模块表创建脚本不存在');
      }
    }
    
    // 扫描 modules 目录，注册所有模块
    const modulesDir = path.join(__dirname, '../modules');
    if (fs.existsSync(modulesDir)) {
      const modules = fs.readdirSync(modulesDir).filter(name => {
        const modulePath = path.join(modulesDir, name);
        return fs.statSync(modulePath).isDirectory();
      });
      
      for (const moduleName of modules) {
        const manifestPath = path.join(modulesDir, moduleName, 'module.json');
        if (fs.existsSync(manifestPath)) {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          
          // 检查模块是否已注册
          const existing = await connection.query(
            'SELECT id FROM sys_modules WHERE name = ?',
            [manifest.name]
          );
          
          if (existing.length === 0) {
            // 注册新模块
            await connection.query(
              `INSERT INTO sys_modules (name, version, description, author, status, enabled, installed_at, created_at, updated_at)
               VALUES (?, ?, ?, ?, 'installed', 1, NOW(), NOW(), NOW())`,
              [manifest.name, manifest.version, manifest.description, manifest.author]
            );
            
            stats.modules++;
            log.info(`注册模块: ${manifest.name} v${manifest.version}`);
          }
        }
      }
      
      log.success(`模块数据迁移完成: ${stats.modules} 个模块`);
    } else {
      log.warn('modules 目录不存在');
    }
  } catch (error) {
    log.error(`模块数据迁移失败: ${error.message}`);
    stats.errors++;
  }
}

/**
 * 迁移配置数据
 */
async function migrateConfigs(connection: Connection): Promise<void> {
  log.info('迁移配置数据...');
  
  try {
    // 检查配置表是否存在
    const hasConfigs = await connection.query(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'sys_configs'",
      [process.env.DB_NAME]
    );
    
    if (hasConfigs[0].count === 0) {
      log.warn('配置表不存在，跳过配置迁移');
      return;
    }
    
    // 获取配置数量
    const configCount = await connection.query('SELECT COUNT(*) as count FROM sys_configs');
    stats.configs = configCount[0].count;
    
    log.success(`配置数据迁移完成: ${stats.configs} 条记录`);
  } catch (error) {
    log.error(`配置数据迁移失败: ${error.message}`);
    stats.errors++;
  }
}

/**
 * 生成迁移报告
 */
function generateReport(): void {
  log.info('========================================');
  log.info('数据迁移报告');
  log.info('========================================');
  log.info(`用户: ${stats.users} 条`);
  log.info(`角色: ${stats.roles} 条`);
  log.info(`权限: ${stats.permissions} 条`);
  log.info(`菜单: ${stats.menus} 条`);
  log.info(`模块: ${stats.modules} 个`);
  log.info(`配置: ${stats.configs} 条`);
  log.info(`错误: ${stats.errors} 个`);
  log.info('========================================');
  
  // 保存报告到文件
  const reportPath = path.join(__dirname, '../logs/migration-report.json');
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
  
  log.success(`迁移报告已保存: ${reportPath}`);
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  let connection: Connection | null = null;
  
  try {
    log.info('========================================');
    log.info('AI 数据问答平台 - 数据迁移开始');
    log.info('========================================');
    
    // 创建数据库连接
    connection = await createDatabaseConnection();
    
    // 执行迁移
    await migrateUsers(connection);
    await migrateRoles(connection);
    await migratePermissions(connection);
    await migrateMenus(connection);
    await migrateModules(connection);
    await migrateConfigs(connection);
    
    // 生成报告
    generateReport();
    
    log.info('========================================');
    if (stats.errors === 0) {
      log.success('数据迁移完成 ✓');
    } else {
      log.warn(`数据迁移完成，但有 ${stats.errors} 个错误`);
    }
    log.info('========================================');
    
    process.exit(0);
  } catch (error) {
    log.error(`数据迁移失败: ${error.message}`);
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
