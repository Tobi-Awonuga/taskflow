'use strict';
const path     = require('path');
const Database = require('better-sqlite3');
const { drizzle } = require('drizzle-orm/better-sqlite3');
const schema   = require('./schema');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const dbPath = path.resolve(__dirname, '../../', process.env.DATABASE_URL || './db/dev.sqlite');

const sqlite = new Database(dbPath);

// Recommended SQLite pragmas for reliability and performance
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');
sqlite.pragma('busy_timeout = 5000');

const db = drizzle(sqlite, { schema });

module.exports = { db, sqlite };
