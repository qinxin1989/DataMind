/**
 * 测试 PostgreSQL 数据源连接
 */

import { Client } from 'pg';

async function testConnection() {
  const config = {
    host: '10.8.173.6',
    port: 11004,
    user: 'JJYX_JXSY_APP',
    password: 'JJYX_JXSY_APP',  // 请替换为实际密码
    database: 'JJYX_JXSY',
    connectionTimeoutMillis: 10000,
  };

  console.log('测试 PostgreSQL 连接...');
  console.log(`主机: ${config.host}:${config.port}`);
  console.log(`数据库: ${config.database}`);
  console.log(`用户: ${config.user}`);

  const client = new Client(config);

  try {
    console.log('\n正在连接...');
    await client.connect();
    console.log('✓ 连接成功！');

    // 获取版本信息
    const versionResult = await client.query('SELECT version()');
    console.log('\n数据库版本:');
    console.log(versionResult.rows[0]?.version);

    // 获取当前数据库
    const dbResult = await client.query('SELECT current_database(), current_user, current_schema()');
    console.log('\n当前连接信息:');
    console.log(`  数据库: ${dbResult.rows[0]?.current_database}`);
    console.log(`  用户: ${dbResult.rows[0]?.current_user}`);
    console.log(`  Schema: ${dbResult.rows[0]?.current_schema}`);

    // 获取表列表
    const tablesResult = await client.query(`
      SELECT table_schema, table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name
      LIMIT 20
    `);
    
    console.log(`\n表列表 (前20个):`);
    if (tablesResult.rows.length === 0) {
      console.log('  (没有找到表)');
    } else {
      for (const row of tablesResult.rows) {
        console.log(`  ${row.table_schema}.${row.table_name} (${row.table_type})`);
      }
    }

    // 获取 schema 列表
    const schemasResult = await client.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY schema_name
    `);
    
    console.log(`\nSchema 列表:`);
    for (const row of schemasResult.rows) {
      console.log(`  ${row.schema_name}`);
    }

    await client.end();
    console.log('\n✅ 测试完成，连接正常！');
  } catch (error: any) {
    console.error('\n❌ 连接失败:', error.message);
    
    // 提供更详细的错误信息
    if (error.code) {
      console.error(`错误代码: ${error.code}`);
    }
    
    // 常见错误提示
    if (error.code === 'ECONNREFUSED') {
      console.error('提示: 连接被拒绝，请检查主机地址和端口是否正确');
    } else if (error.code === '28P01' || error.code === '28000') {
      console.error('提示: 用户名或密码错误');
    } else if (error.code === '3D000') {
      console.error('提示: 数据库不存在');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('提示: 连接超时，请检查网络或防火墙设置');
    }
    
    try {
      await client.end();
    } catch (e) {
      // 忽略
    }
  }

  process.exit(0);
}

testConnection();
