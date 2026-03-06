'use strict';
/**
 * Test database helpers.
 * Call setupTestDb() in beforeAll — it drops/creates nectar_test and runs migrations.
 * Call teardownTestDb() in afterAll to close the pool.
 */
const mysql   = require('mysql2/promise');
const path    = require('path');
const { drizzle }  = require('drizzle-orm/mysql2');
const { migrate }  = require('drizzle-orm/mysql2/migrator');

function resolveConfig() {
  return {
    host:     process.env.MYSQL_HOST     || '127.0.0.1',
    port:     Number(process.env.MYSQL_PORT || '3306'),
    user:     process.env.MYSQL_USER     || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'nectar_test',
  };
}

async function setupTestDb() {
  const cfg    = resolveConfig();
  const dbName = cfg.database;

  // Drop & recreate
  const admin = await mysql.createConnection({ host: cfg.host, port: cfg.port, user: cfg.user, password: cfg.password });
  await admin.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
  await admin.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await admin.end();

  // Migrate
  const pool = mysql.createPool({ ...cfg, waitForConnections: true, connectionLimit: 5 });
  const db   = drizzle(pool);
  await migrate(db, { migrationsFolder: path.resolve(__dirname, '../../drizzle') });
  await pool.end();
}

async function teardownTestDb() {
  // nothing — pool is per-test; DB stays for inspection
}

module.exports = { setupTestDb, teardownTestDb, resolveConfig };
