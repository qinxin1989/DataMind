/**
 * 爬虫代码清理脚本
 * 将旧的测试脚本和调试文件移动到归档目录
 */

import fs from 'fs';
import path from 'path';

const ROOT = path.join(process.cwd());
const SCRIPTS_DIR = path.join(ROOT, 'scripts');

// 要归档的文件模式
const ARCHIVE_PATTERNS = [
  /^batch-test-sites/,
  /^debug-/,
  /^fix-/,
  /^test-nmg-site/,
  /^test-remaining/,
  /^verify-/,
  /^get-/,
  /^crawl-to-excel/,
  /^test-engine-local/
];

// 调试数据文件模式
const DEBUG_DATA_PATTERNS = [
  /\.html$/,
  /\.png$/,
  /^(test_|final_|fixed_).*\.json$/
];

/**
 * 归档文件
 */
function archiveFiles() {
  console.log('开始归档爬虫测试文件...\n');

  // 创建归档目录
  const archiveDir = path.join(SCRIPTS_DIR, 'archive');
  const debugDataDir = path.join(SCRIPTS_DIR, 'debug-data');

  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
    console.log('✓ 创建归档目录: scripts/archive');
  }

  if (!fs.existsSync(debugDataDir)) {
    fs.mkdirSync(debugDataDir, { recursive: true });
    console.log('✓ 创建调试数据目录: scripts/debug-data');
  }

  // 获取scripts目录下的所有文件
  const files = fs.readdirSync(SCRIPTS_DIR);
  const tsJsFiles = files.filter(f => /\.(ts|js)$/.test(f));

  // 归档旧脚本
  let archivedCount = 0;
  for (const file of tsJsFiles) {
    if (ARCHIVE_PATTERNS.some(p => p.test(file))) {
      const src = path.join(SCRIPTS_DIR, file);
      const dest = path.join(archiveDir, file);

      if (fs.existsSync(dest)) {
        // 目标文件已存在，跳过
        console.log(`⊘ 跳过（已存在）: ${file}`);
        continue;
      }

      try {
        fs.renameSync(src, dest);
        console.log(`✓ 归档: ${file} -> archive/`);
        archivedCount++;
      } catch (e: any) {
        console.log(`✗ 失败: ${file} - ${e.message}`);
      }
    }
  }

  // 归档调试数据
  let dataCount = 0;
  for (const file of files) {
    if (DEBUG_DATA_PATTERNS.some(p => p.test(file))) {
      const src = path.join(SCRIPTS_DIR, file);
      const dest = path.join(debugDataDir, file);

      if (fs.existsSync(dest)) {
        console.log(`⊘ 跳过（已存在）: ${file}`);
        continue;
      }

      try {
        fs.renameSync(src, dest);
        console.log(`✓ 归档: ${file} -> debug-data/`);
        dataCount++;
      } catch (e: any) {
        console.log(`✗ 失败: ${file} - ${e.message}`);
      }
    }
  }

  console.log(`\n归档完成！`);
  console.log(`  - 脚本文件: ${archivedCount} 个`);
  console.log(`  - 调试数据: ${dataCount} 个`);
  console.log(`  - 归档目录: scripts/archive/`);
  console.log(`  - 调试数据目录: scripts/debug-data/`);
}

/**
 * 显示清理计划
 */
function showPlan() {
  console.log('爬虫代码清理计划\n');
  console.log('将归档以下文件：\n');

  const files = fs.readdirSync(SCRIPTS_DIR);

  console.log('【旧脚本】');
  const tsJsFiles = files.filter(f => /\.(ts|js)$/.test(f));
  for (const file of tsJsFiles) {
    if (ARCHIVE_PATTERNS.some(p => p.test(file))) {
      console.log(`  - ${file}`);
    }
  }

  console.log('\n【调试数据】');
  for (const file of files) {
    if (DEBUG_DATA_PATTERNS.some(p => p.test(file))) {
      console.log(`  - ${file}`);
    }
  }

  console.log('\n保留的文件：');
  console.log('  - test-provinces.ts (新的统一测试脚本)');
  console.log('  - 其他非测试脚本');
  console.log('');
}

/**
 * 清理空目录
 */
function cleanEmptyDirs() {
  console.log('清理空目录...');

  function cleanDir(dir: string) {
    const files = fs.readdirSync(dir);
    if (files.length === 0) {
      fs.rmdirSync(dir);
      console.log(`✓ 删除空目录: ${path.relative(ROOT, dir)}`);
      return true;
    }
    return false;
  }

  // 清理 debug-data 中的空子目录（如果有）
  const debugDataDir = path.join(SCRIPTS_DIR, 'debug-data');
  if (fs.existsSync(debugDataDir)) {
    const subdirs = fs.readdirSync(debugDataDir);
    for (const subdir of subdirs) {
      const subdirPath = path.join(debugDataDir, subdir);
      if (fs.statSync(subdirPath).isDirectory()) {
        cleanDir(subdirPath);
      }
    }
    cleanDir(debugDataDir);
  }
}

// ===== 主程序 =====

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
爬虫代码清理工具

用法:
  npm run crawler:clean          # 显示清理计划
  npm run crawler:clean --do     # 执行清理
  npm run crawler:clean --empty  # 清理空目录

选项:
  --do    执行文件归档
  --empty 清理空目录
  --help  显示帮助
`);
} else if (args.includes('--do')) {
  archiveFiles();
  if (args.includes('--empty')) {
    console.log();
    cleanEmptyDirs();
  }
} else if (args.includes('--empty')) {
  cleanEmptyDirs();
} else {
  showPlan();
  console.log('执行清理: npm run crawler:clean --do');
}

export { archiveFiles, showPlan, cleanEmptyDirs };
