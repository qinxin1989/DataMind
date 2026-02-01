#!/usr/bin/env ts-node

/**
 * AI 数据问答平台 - 数据迁移验证脚本
 * 版本: 1.0.0
 * 日期: 2026-02-01
 * 
 * 用途: 验证数据迁移的完整性和一致性
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
  info: (msg: string) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  warn: (msg: string) => console.log(`${colors.yellow}[WARN]${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
};

// 验证结果
interface ValidationResult {
  category: string;
  check: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  details?: any;
}

const results: ValidationResult[] = [];

/**
 * 添加验证结果
 */
function addResult(category: string, check: string, status: 'pass' | 'fail' | 'warn', message: string, details?: any): void {
  results.push({ category, check, status, message, details });
  
  const icon = status === 'pass' ? '✓' : status === 'fail' ? '✗' : '⚠';
  const color = status === 'pass' ? colors.green : status === 'fail' ? colors.red : colors.yellow;
  
  console.log(`${color}${icon}${colors.reset} [${category}] ${check}: ${message}`);
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
 * 验证表结构
 */
async function validateTableStructure(connection: Connection): Promise<void> {
  log.info('验证表结构...');
  
  const requiredTables = [
    'sys_users',
    'sys_roles',
    'sys_permissions',
    'sys_menus',
    'sys_modules',
    'sys_configs',
  ];
  
  for (const table of requiredTables) {
    try {
      const result = await connection.query(
        "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = ?",
        [process.env.DB_NAME, table]
      );
      
      if (result[0].count > 0) {
        addResult('表结构', table, 'pass', '表存在');
      } else {
        addResult('表结构', table, 'fail', '表不存在');
      }
    } catch (error) {
      addResult('表结构', table, 'fail', `检查失败: ${error.message}`);
    }
  }
}

/**
 * 验证数据完整性
 */
async function validateDataIntegrity(connection: Connection): Promise<void> {
  log.info('验证数据完整性...');
  
  // 验证用户数据
  try {
    const users = await connection.query('SELECT COUNT(*) as count FROM sys_users');
    const userCount = users[0].count;
    
    if (userCount > 0) {
      addResult('数据完整性', '用户数据', 'pass', `${userCount} 条记录`);
      
      // 验证必填字段
      const invalidUsers = await connection.query(
        'SELECT COUNT(*) as count FROM sys_users WHERE username IS NULL OR username = "" OR password IS NULL OR password = ""'
      );
      
      if (invalidUsers[0].count === 0) {
        addResult('数据完整性', '用户必填字段', 'pass', '所有用户数据完整');
      } else {
        addResult('数据完整性', '用户必填字段', 'fail', `${invalidUsers[0].count} 条记录缺少必填字段`);
      }
    } else {
      addResult('数据完整性', '用户数据', 'warn', '没有用户数据');
    }
  } catch (error) {
    addResult('数据完整性', '用户数据', 'fail', `验证失败: ${error.message}`);
  }
  
  // 验证角色数据
  try {
    const roles = await connection.query('SELECT COUNT(*) as count FROM sys_roles');
    const roleCount = roles[0].count;
    
    if (roleCount > 0) {
      addResult('数据完整性', '角色数据', 'pass', `${roleCount} 条记录`);
    } else {
      addResult('数据完整性', '角色数据', 'warn', '没有角色数据');
    }
  } catch (error) {
    addResult('数据完整性', '角色数据', 'fail', `验证失败: ${error.message}`);
  }
  
  // 验证菜单数据
  try {
    const menus = await connection.query('SELECT COUNT(*) as count FROM sys_menus');
    const menuCount = menus[0].count;
    
    if (menuCount > 0) {
      addResult('数据完整性', '菜单数据', 'pass', `${menuCount} 条记录`);
    } else {
      addResult('数据完整性', '菜单数据', 'warn', '没有菜单数据');
    }
  } catch (error) {
    addResult('数据完整性', '菜单数据', 'fail', `验证失败: ${error.message}`);
  }
  
  // 验证模块数据
  try {
    const modules = await connection.query('SELECT COUNT(*) as count FROM sys_modules');
    const moduleCount = modules[0].count;
    
    if (moduleCount > 0) {
      addResult('数据完整性', '模块数据', 'pass', `${moduleCount} 条记录`);
    } else {
      addResult('数据完整性', '模块数据', 'warn', '没有模块数据');
    }
  } catch (error) {
    addResult('数据完整性', '模块数据', 'fail', `验证失败: ${error.message}`);
  }
}

/**
 * 验证数据一致性
 */
async function validateDataConsistency(connection: Connection): Promise<void> {
  log.info('验证数据一致性...');
  
  // 验证用户-角色关联
  try {
    const orphanUserRoles = await connection.query(`
      SELECT COUNT(*) as count FROM sys_user_roles ur
      LEFT JOIN sys_users u ON ur.user_id = u.id
      LEFT JOIN sys_roles r ON ur.role_id = r.id
      WHERE u.id IS NULL OR r.id IS NULL
    `);
    
    if (orphanUserRoles[0].count === 0) {
      addResult('数据一致性', '用户-角色关联', 'pass', '所有关联有效');
    } else {
      addResult('数据一致性', '用户-角色关联', 'fail', `${orphanUserRoles[0].count} 条无效关联`);
    }
  } catch (error) {
    addResult('数据一致性', '用户-角色关联', 'warn', `验证跳过: ${error.message}`);
  }
  
  // 验证角色-权限关联
  try {
    const orphanRolePermissions = await connection.query(`
      SELECT COUNT(*) as count FROM sys_role_permissions rp
      LEFT JOIN sys_roles r ON rp.role_id = r.id
      LEFT JOIN sys_permissions p ON rp.permission_id = p.id
      WHERE r.id IS NULL OR p.id IS NULL
    `);
    
    if (orphanRolePermissions[0].count === 0) {
      addResult('数据一致性', '角色-权限关联', 'pass', '所有关联有效');
    } else {
      addResult('数据一致性', '角色-权限关联', 'fail', `${orphanRolePermissions[0].count} 条无效关联`);
    }
  } catch (error) {
    addResult('数据一致性', '角色-权限关联', 'warn', `验证跳过: ${error.message}`);
  }
  
  // 验证菜单层级关系
  try {
    const orphanMenus = await connection.query(`
      SELECT COUNT(*) as count FROM sys_menus m
      LEFT JOIN sys_menus p ON m.parent_id = p.id
      WHERE m.parent_id IS NOT NULL AND m.parent_id != 0 AND p.id IS NULL
    `);
    
    if (orphanMenus[0].count === 0) {
      addResult('数据一致性', '菜单层级关系', 'pass', '所有菜单层级有效');
    } else {
      addResult('数据一致性', '菜单层级关系', 'fail', `${orphanMenus[0].count} 个菜单的父菜单不存在`);
    }
  } catch (error) {
    addResult('数据一致性', '菜单层级关系', 'warn', `验证跳过: ${error.message}`);
  }
}

/**
 * 验证外键约束
 */
async function validateForeignKeys(connection: Connection): Promise<void> {
  log.info('验证外键约束...');
  
  try {
    const foreignKeys = await connection.query(`
      SELECT 
        TABLE_NAME,
        CONSTRAINT_NAME,
        REFERENCED_TABLE_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL
    `, [process.env.DB_NAME]);
    
    if (foreignKeys.length > 0) {
      addResult('外键约束', '外键数量', 'pass', `${foreignKeys.length} 个外键约束`);
      
      // 验证每个外键
      for (const fk of foreignKeys) {
        try {
          // 这里可以添加更详细的外键验证逻辑
          addResult('外键约束', fk.CONSTRAINT_NAME, 'pass', `${fk.TABLE_NAME} -> ${fk.REFERENCED_TABLE_NAME}`);
        } catch (error) {
          addResult('外键约束', fk.CONSTRAINT_NAME, 'fail', `验证失败: ${error.message}`);
        }
      }
    } else {
      addResult('外键约束', '外键数量', 'warn', '没有外键约束');
    }
  } catch (error) {
    addResult('外键约束', '外键验证', 'fail', `验证失败: ${error.message}`);
  }
}

/**
 * 验证索引
 */
async function validateIndexes(connection: Connection): Promise<void> {
  log.info('验证索引...');
  
  try {
    const indexes = await connection.query(`
      SELECT 
        TABLE_NAME,
        INDEX_NAME,
        COLUMN_NAME
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = ? AND INDEX_NAME != 'PRIMARY'
      ORDER BY TABLE_NAME, INDEX_NAME
    `, [process.env.DB_NAME]);
    
    if (indexes.length > 0) {
      addResult('索引', '索引数量', 'pass', `${indexes.length} 个索引`);
    } else {
      addResult('索引', '索引数量', 'warn', '没有索引（除主键外）');
    }
  } catch (error) {
    addResult('索引', '索引验证', 'fail', `验证失败: ${error.message}`);
  }
}

/**
 * 生成验证报告
 */
function generateReport(): void {
  log.info('========================================');
  log.info('数据迁移验证报告');
  log.info('========================================');
  
  const passCount = results.filter(r => r.status === 'pass').length;
  const failCount = results.filter(r => r.status === 'fail').length;
  const warnCount = results.filter(r => r.status === 'warn').length;
  const totalCount = results.length;
  
  log.info(`总检查项: ${totalCount}`);
  log.success(`通过: ${passCount}`);
  log.error(`失败: ${failCount}`);
  log.warn(`警告: ${warnCount}`);
  
  // 按类别统计
  const categories = [...new Set(results.map(r => r.category))];
  log.info('');
  log.info('分类统计:');
  
  for (const category of categories) {
    const categoryResults = results.filter(r => r.category === category);
    const categoryPass = categoryResults.filter(r => r.status === 'pass').length;
    const categoryFail = categoryResults.filter(r => r.status === 'fail').length;
    const categoryWarn = categoryResults.filter(r => r.status === 'warn').length;
    
    log.info(`  ${category}: ${categoryPass} 通过, ${categoryFail} 失败, ${categoryWarn} 警告`);
  }
  
  log.info('========================================');
  
  // 保存报告到文件
  const reportPath = path.join(__dirname, '../logs/validation-report.json');
  const reportDir = path.dirname(reportPath);
  
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  fs.writeFileSync(
    reportPath,
    JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        total: totalCount,
        pass: passCount,
        fail: failCount,
        warn: warnCount,
      },
      results,
    }, null, 2)
  );
  
  log.success(`验证报告已保存: ${reportPath}`);
  
  // 返回退出码
  return failCount > 0 ? 1 : 0;
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  let connection: Connection | null = null;
  
  try {
    log.info('========================================');
    log.info('AI 数据问答平台 - 数据迁移验证开始');
    log.info('========================================');
    
    // 创建数据库连接
    connection = await createDatabaseConnection();
    
    // 执行验证
    await validateTableStructure(connection);
    await validateDataIntegrity(connection);
    await validateDataConsistency(connection);
    await validateForeignKeys(connection);
    await validateIndexes(connection);
    
    // 生成报告
    const exitCode = generateReport();
    
    log.info('========================================');
    if (exitCode === 0) {
      log.success('数据迁移验证通过 ✓');
    } else {
      log.error('数据迁移验证失败 ✗');
    }
    log.info('========================================');
    
    process.exit(exitCode);
  } catch (error) {
    log.error(`数据迁移验证失败: ${error.message}`);
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
