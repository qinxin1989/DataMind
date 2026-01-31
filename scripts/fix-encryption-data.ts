/**
 * 修复加密数据问题
 * 清理无法解密的旧数据，让用户重新配置
 */

import { pool } from '../src/admin/core/database';

async function fixEncryptionData() {
  const connection = await pool.getConnection();
  
  try {
    console.log('开始修复加密数据问题...\n');

    // 1. 检查 AI 配置表中的加密数据
    const [aiConfigs] = await connection.execute(
      'SELECT id, name, provider FROM sys_ai_configs'
    );
    
    console.log(`找到 ${(aiConfigs as any[]).length} 个 AI 配置`);
    
    if ((aiConfigs as any[]).length > 0) {
      console.log('\n选项 1: 删除所有 AI 配置（需要重新配置）');
      console.log('选项 2: 保留配置但清空 API Key（需要重新输入 API Key）\n');
      
      // 这里我们选择清空 API Key，保留其他配置
      await connection.execute(
        `UPDATE sys_ai_configs SET api_key = '' WHERE api_key IS NOT NULL`
      );
      console.log('✓ 已清空所有 AI 配置的 API Key');
    }

    // 2. 检查数据源配置表
    const [datasources] = await connection.execute(
      'SELECT id, name FROM datasource_config'
    );
    
    console.log(`\n找到 ${(datasources as any[]).length} 个数据源配置`);
    
    if ((datasources as any[]).length > 0) {
      // 清空加密的配置字段
      await connection.execute(
        `UPDATE datasource_config SET config = '{}' WHERE config IS NOT NULL`
      );
      console.log('✓ 已清空所有数据源的加密配置');
    }

    // 3. 检查加密的上传文件（如果表存在）
    try {
      const [files] = await connection.execute(
        'SELECT COUNT(*) as count FROM datasource_files WHERE encrypted = TRUE'
      );
      
      const fileCount = (files as any[])[0]?.count || 0;
      console.log(`\n找到 ${fileCount} 个加密文件`);
      
      if (fileCount > 0) {
        console.log('建议：删除这些无法解密的文件记录');
        await connection.execute(
          'DELETE FROM datasource_files WHERE encrypted = TRUE'
        );
        console.log('✓ 已删除加密文件记录');
      }
    } catch (error: any) {
      if (error.code === 'ER_NO_SUCH_TABLE') {
        console.log('\n数据源文件表不存在，跳过');
      } else {
        throw error;
      }
    }

    console.log('\n✅ 加密数据修复完成！');
    console.log('\n后续步骤：');
    console.log('1. 重启后端服务');
    console.log('2. 在 UI 中重新配置 AI 模型的 API Key');
    console.log('3. 重新配置数据源连接信息');
    console.log('4. 重新上传需要的文件\n');

  } catch (error) {
    console.error('修复失败:', error);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

fixEncryptionData().catch(console.error);
