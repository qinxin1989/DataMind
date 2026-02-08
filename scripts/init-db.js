
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function init() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.CONFIG_DB_HOST || 'localhost',
      port: parseInt(process.env.CONFIG_DB_PORT || '3306'),
      user: process.env.CONFIG_DB_USER || 'root',
      password: process.env.CONFIG_DB_PASSWORD || 'qinxin'
    });

    console.log('Connected to MySQL server.');

    const dbName = process.env.CONFIG_DB_NAME || 'datamind';
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    console.log(`Database \`${dbName}\` created or already exists.`);

    await connection.query(`USE \`${dbName}\``);

    const sqlPath = path.join(__dirname, 'init.sql');
    if (fs.existsSync(sqlPath)) {
      const sql = fs.readFileSync(sqlPath, 'utf8');
      // Simple split by semicolon (not perfect but works for most standard init.sql)
      const statements = sql.split(/; \r?\n/);
      for (let statement of statements) {
        if (statement.trim()) {
          try {
            await connection.query(statement);
          } catch (err) {
            // Ignore some errors like table already exists if needed
            if (!err.message.includes('already exists')) {
              console.warn('Execution warning:', err.message);
            }
          }
        }
      }
      console.log('init.sql executed.');
    }

    await connection.end();
    console.log('Initialization complete.');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }
}

init();
