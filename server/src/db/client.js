'use strict';
const path  = require('path');
const mysql = require('mysql2/promise');
const { drizzle } = require('drizzle-orm/mysql2');
const schema = require('./schema');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

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

const baseConfig = resolveConfig();
const pool = mysql.createPool({
  ...baseConfig,
  waitForConnections: true,
  connectionLimit: Number(process.env.MYSQL_POOL_SIZE || '10'),
  maxIdle: Math.max(1, Math.floor(Number(process.env.MYSQL_POOL_SIZE || '10') / 2)),
  idleTimeout: 60000,
});

const db = drizzle(pool, {
  schema,
  mode: 'default',
});

module.exports = { db, pool };
