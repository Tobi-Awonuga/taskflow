'use strict';
require('dotenv').config();
const path   = require('path');
const mysql  = require('mysql2/promise');
const { drizzle } = require('drizzle-orm/mysql2');
const { migrate } = require('drizzle-orm/mysql2/migrator');

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
  const pool = mysql.createPool({
    ...config,
    waitForConnections: true,
    connectionLimit: Number(process.env.MYSQL_POOL_SIZE || '10'),
  });

  try {
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: path.resolve(__dirname, '../drizzle') });
    console.log('✓ Migrations applied successfully');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
