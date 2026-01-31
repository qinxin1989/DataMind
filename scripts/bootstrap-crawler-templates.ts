/**
 * 省级爬虫模板初始化脚本
 * 将 provinces.config.ts 中的31个省份配置导入数据库
 */

import { pool } from '../src/admin/core/database';
import { v4 as uuidv4 } from 'uuid';
import { PROVINCE_CONFIGS } from '../src/agent/skills/crawler/provinces.config';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

async function bootstrapProvinceTemplates() {
  console.log('开始初始化省级爬虫模板...\n');

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const config of PROVINCE_CONFIGS) {
      try {
        // 检查是否已存在
        const [existing] = await connection.execute(
          'SELECT id FROM crawler_templates WHERE user_id = ? AND url = ?',
          [SYSTEM_USER_ID, config.url]
        );

        if ((existing as any[]).length > 0) {
          console.log(`⊘ 跳过: ${config.name} (已存在)`);
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
            SYSTEM_USER_ID,
            `${config.name}政策文件`,
            config.url,
            config.department,
            '政策文件',
            config.selectors.container,
            config.needDynamic ? 'dynamic' : 'static',
            true,
            85.00, // 系统模板的默认置信度
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
        errorCount++;
      }
    }

    await connection.commit();

    console.log('\n=================================');
    console.log(`初始化完成！`);
    console.log(`成功: ${successCount} 个`);
    console.log(`跳过: ${skipCount} 个`);
    console.log(`失败: ${errorCount} 个`);
    console.log(`总计: ${PROVINCE_CONFIGS.length} 个省份`);
    console.log('=================================\n');

    // 显示统计
    const [stats] = await connection.execute(
      'SELECT page_type, COUNT(*) as count FROM crawler_templates WHERE user_id = ? GROUP BY page_type',
      [SYSTEM_USER_ID]
    );

    console.log('模板分类统计:');
    for (const row of stats as any[]) {
      console.log(`  ${row.page_type}: ${row.count} 个`);
    }

  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * 克隆系统模板到用户
 */
async function cloneSystemTemplatesToUser(userId: string, provinceCodes?: string[]) {
  console.log(`克隆系统模板到用户: ${userId}\n`);

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    let query = `
      SELECT * FROM crawler_templates
      WHERE user_id = ?
      AND auto_generated = TRUE
    `;
    const params: any[] = [SYSTEM_USER_ID];

    if (provinceCodes && provinceCodes.length > 0) {
      const tagsFilter = provinceCodes.map(() => 'JSON_CONTAINS(tags, ?)').join(' OR ');
      query += ` AND (${tagsFilter})`;
      params.push(...provinceCodes.map(code => JSON.stringify(code)));
    }

    const [templates] = await connection.execute(query, params);

    let cloneCount = 0;

    for (const tpl of templates as any[]) {
      // 检查用户是否已有该URL的模板
      const [existing] = await connection.execute(
        'SELECT id FROM crawler_templates WHERE user_id = ? AND url = ?',
        [userId, tpl.url]
      );

      if ((existing as any[]).length > 0) {
        console.log(`⊘ 跳过: ${tpl.name} (用户已有)`);
        continue;
      }

      // 克隆模板
      const newTemplateId = uuidv4();

      await connection.execute(
        `INSERT INTO crawler_templates (
          id, user_id, name, url, department, data_type,
          container_selector, page_type, auto_generated, tags
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newTemplateId,
          userId,
          tpl.name.replace(' (系统模板)', ''),
          tpl.url,
          tpl.department,
          tpl.data_type,
          tpl.container_selector,
          tpl.page_type,
          false, // 克隆的模板不算自动生成
          tpl.tags
        ]
      );

      // 克隆字段
      const [fields] = await connection.execute(
        'SELECT * FROM crawler_template_fields WHERE template_id = ?',
        [tpl.id]
      );

      for (const field of fields as any[]) {
        await connection.execute(
          `INSERT INTO crawler_template_fields (id, template_id, field_name, field_selector)
           VALUES (?, ?, ?, ?)`,
          [uuidv4(), newTemplateId, field.field_name, field.field_selector]
        );
      }

      console.log(`✓ ${tpl.name}`);
      cloneCount++;
    }

    await connection.commit();

    console.log(`\n克隆完成！共 ${cloneCount} 个模板\n`);

  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// ===== 主程序 =====

const args = process.argv.slice(2);
const command = args[0];

if (command === 'init' || command === undefined) {
  // 初始化系统模板
  bootstrapProvinceTemplates()
    .then(() => {
      console.log('✓ 初始化成功');
      process.exit(0);
    })
    .catch((error) => {
      console.error('✗ 初始化失败:', error);
      process.exit(1);
    });

} else if (command === 'clone') {
  // 克隆模板到指定用户
  const userId = args[1];
  const provinceCodes = args.slice(2);

  if (!userId) {
    console.error('错误: 请提供用户ID');
    console.log('\n用法: npm run bootstrap:clone <userId> [provinceCode1 provinceCode2 ...]');
    console.log('示例: npm run bootstrap:clone user-123 beijing shanghai');
    process.exit(1);
  }

  cloneSystemTemplatesToUser(userId, provinceCodes.length > 0 ? provinceCodes : undefined)
    .then(() => {
      console.log('✓ 克隆成功');
      process.exit(0);
    })
    .catch((error) => {
      console.error('✗ 克隆失败:', error);
      process.exit(1);
    });

} else if (command === '--help' || command === '-h') {
  console.log(`
省级爬虫模板初始化工具

用法:
  npm run bootstrap:templates         # 初始化系统模板
  npm run bootstrap:clone <userId>   # 克隆所有模板到用户
  npm run bootstrap:clone <userId> <code1> <code2>  # 克隆指定省份模板

示例:
  npm run bootstrap:templates
  npm run bootstrap:clone user-123
  npm run bootstrap:clone user-123 beijing shanghai guangdong
  `);
} else {
  console.error(`未知命令: ${command}`);
  console.log('使用 --help 查看帮助');
  process.exit(1);
}

export { bootstrapProvinceTemplates, cloneSystemTemplatesToUser };
