'use strict';
/**
 * Drop and recreate the Nectar database, then run migrations and seed.
 *
 * Run:  node scripts/reset-db.js
 *       npm run db:reset
 *
 * WARNING: This permanently deletes all data.
 */
require('dotenv').config();
const mysql  = require('mysql2/promise');
const { execSync } = require('child_process');

function resolveConfig() {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('://')) {
    const url = new URL(process.env.DATABASE_URL);
    return {
      host:     url.hostname,
      port:     Number(url.port || '3306'),
      user:     decodeURIComponent(url.username || ''),
      password: decodeURIComponent(url.password || ''),
      database: url.pathname.replace(/^\//, ''),
    };
  }
  return {
    host:     process.env.MYSQL_HOST     || '127.0.0.1',
    port:     Number(process.env.MYSQL_PORT || '3306'),
    user:     process.env.MYSQL_USER     || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'nectar',
  };
}

async function main() {
  const config = resolveConfig();
  const dbName = config.database;

  console.log(`⚠  Resetting database "${dbName}" on ${config.host}:${config.port}…`);

  // Connect without specifying a database so we can drop/create it
  const conn = await mysql.createConnection({
    host:     config.host,
    port:     config.port,
    user:     config.user,
    password: config.password,
  });

  try {
    await conn.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
    console.log(`  dropped database "${dbName}"`);

    await conn.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`  created database "${dbName}"`);
  } finally {
    await conn.end();
  }

  console.log('\nRunning migrations…');
  execSync('node scripts/migrate.js', { stdio: 'inherit' });

  console.log('\nRunning seed…');
  execSync('node scripts/seed.js', { stdio: 'inherit' });

  console.log('\n✓ Database reset complete');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
