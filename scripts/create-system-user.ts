/**
 * 创建系统用户并初始化省级模板
 */

import { pool } from '../src/admin/core/database';
import { v4 as uuidv4 } from 'uuid';
import { PROVINCE_CONFIGS } from '../src/agent/skills/crawler/provinces.config';

async function createSystemUserAndTemplates() {
  console.log('========================================');
  console.log('创建系统用户并初始化模板');
  console.log('========================================\n');

  const connection = await pool.getConnection();

  try {
    // 1. 检查现有用户
    console.log('[1/4] 检查用户...');
    const [users] = await connection.query('SELECT id, username, full_name FROM sys_users LIMIT 5');
    console.log('现有用户:');
    for (const user of users as any[]) {
      console.log(`  - ${user.username} (${user.full_name}): ${user.id}`);
    }

    // 2. 获取或创建系统用户
    console.log('\n[2/4] 创建系统用户...');
    let systemUserId = '00000000-0000-0000-0000-000000000000';

    try {
      await connection.query(
        `INSERT INTO sys_users (id, username, password_hash, full_name, role, status, created_at)
         VALUES (?, 'system', 'SYSTEM_USER', '系统', 'system', 1, NOW())`,
        [systemUserId]
      );
      console.log('✓ 系统用户创建成功');
    } catch (e: any) {
      if (e.code !== 'ER_DUP_ENTRY') {
        console.log('✗ 创建系统用户失败:', e.message);
      } else {
        console.log('⊘ 系统用户已存在');
      }
    }

    // 3. 检查是否需要使用现有用户
    const [sysUser] = await connection.query('SELECT id FROM sys_users WHERE username = ?', ['system']);
    if ((sysUser as any[]).length === 0) {
      console.log('\n系统用户不存在，使用第一个现有用户...');
      const [firstUser] = await connection.query('SELECT id FROM sys_users LIMIT 1');
      if ((firstUser as any[]).length > 0) {
        systemUserId = (firstUser as any[])[0].id;
        console.log(`使用用户ID: ${systemUserId}`);
      } else {
        throw new Error('没有可用的用户');
      }
    } else {
      systemUserId = (sysUser as any[])[0].id;
    }

    // 4. 初始化省级模板
    console.log('\n[3/4] 初始化省级模板...\n');

    let successCount = 0;
    let skipCount = 0;

    for (const config of PROVINCE_CONFIGS) {
      try {
        // 检查是否已存在
        const [existing] = await connection.execute(
          'SELECT id FROM crawler_templates WHERE user_id = ? AND url = ?',
          [systemUserId, config.url]
        );

        if ((existing as any[]).length > 0) {
          console.log(`⊘ ${config.name} (已存在)`);
          skipCount++;
          continue;
        }

        // 创建模板
        const templateId = uuidv4();

        await connection.execute(
          `INSERT INTO crawler_templates (
            id, user_id, name, url, department, data_type,
            container_selector, page_type, auto_generated,
            confidence, tags, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            templateId,
            systemUserId,
            `${config.name}政策文件`,
            config.url,
            config.department,
            '政策文件',
            config.selectors.container,
            config.needDynamic ? 'dynamic' : 'static',
            true,
            85.00,
            JSON.stringify([config.code, '省级', '政策文件', '系统模板'])
          ]
        );

        // 创建字段
        for (const [fieldName, selector] of Object.entries(config.selectors.fields)) {
          await connection.execute(
            `INSERT INTO crawler_template_fields (id, template_id, field_name, field_selector)
             VALUES (?, ?, ?, ?)`,
            [uuidv4(), templateId, fieldName, selector]
          );
        }

        console.log(`✓ ${config.name} (${config.code})`);
        successCount++;

      } catch (error: any) {
        console.error(`✗ ${config.name} 失败: ${error.message}`);
      }
    }

    console.log('\n[4/4] 验证结果...\n');

    const [stats] = await connection.execute(
      'SELECT page_type, COUNT(*) as count FROM crawler_templates WHERE user_id = ? GROUP BY page_type',
      [systemUserId]
    );

    console.log('模板分类统计:');
    for (const row of stats as any[]) {
      console.log(`  ${row.page_type}: ${row.count} 个`);
    }

    console.log('\n========================================');
    console.log(`初始化完成！`);
    console.log(`成功: ${successCount} 个`);
    console.log(`跳过: ${skipCount} 个`);
    console.log(`总计: ${PROVINCE_CONFIGS.length} 个省份`);
    console.log('========================================\n');

    connection.release();

    console.log('✓ 数据库和模板已就绪！');
    console.log('\n下一步:');
    console.log('  npm run dev                 # 启动服务器');
    console.log('  npm run test:province bj  # 测试单个省份\n');

  } catch (error) {
    console.error('\n✗ 初始化失败:', error);
    connection.release();
    process.exit(1);
  }
}

createSystemUserAndTemplates()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
