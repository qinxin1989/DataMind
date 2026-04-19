import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

export interface IsolatedDatabaseOptions {
  envVarName: string;
  defaultSuffix: string;
}

function escapeIdentifier(identifier: string): string {
  return `\`${identifier.replace(/`/g, '``')}\``;
}

function resolvePrimaryDatabaseName(): string {
  dotenv.config();
  const primaryName = process.env.CONFIG_DB_MAIN_NAME || process.env.CONFIG_DB_NAME || 'datamind';
  process.env.CONFIG_DB_MAIN_NAME = primaryName;
  return primaryName;
}

export function resolveIsolatedDatabaseName(options: IsolatedDatabaseOptions): string {
  const primaryName = resolvePrimaryDatabaseName();
  return process.env[options.envVarName] || `${primaryName}_${options.defaultSuffix}`;
}

export async function recreateIsolatedDatabase(options: IsolatedDatabaseOptions): Promise<string> {
  dotenv.config();

  const databaseName = resolveIsolatedDatabaseName(options);
  process.env.NODE_ENV = 'test';
  process.env.CONFIG_DB_NAME = databaseName;

  const connection = await mysql.createConnection({
    host: process.env.CONFIG_DB_HOST || 'localhost',
    port: parseInt(process.env.CONFIG_DB_PORT || '3306', 10),
    user: process.env.CONFIG_DB_USER || 'root',
    password: process.env.CONFIG_DB_PASSWORD,
    charset: 'utf8mb4',
  });

  const escapedDatabaseName = escapeIdentifier(databaseName);
  await connection.execute(`DROP DATABASE IF EXISTS ${escapedDatabaseName}`);
  await connection.execute(
    `CREATE DATABASE ${escapedDatabaseName} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`
  );
  await connection.end();

  return databaseName;
}

export async function dropIsolatedDatabase(databaseName: string): Promise<void> {
  dotenv.config();

  const connection = await mysql.createConnection({
    host: process.env.CONFIG_DB_HOST || 'localhost',
    port: parseInt(process.env.CONFIG_DB_PORT || '3306', 10),
    user: process.env.CONFIG_DB_USER || 'root',
    password: process.env.CONFIG_DB_PASSWORD,
    charset: 'utf8mb4',
  });

  const escapedDatabaseName = escapeIdentifier(databaseName);
  await connection.execute(`DROP DATABASE IF EXISTS ${escapedDatabaseName}`);
  await connection.end();
}
