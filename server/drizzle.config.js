require('dotenv').config({ path: './.env' });

function resolveCredentials() {
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

/** @type {import('drizzle-kit').Config} */
module.exports = {
  schema:       './src/db/schema.js',
  out:          './drizzle',
  dialect:      'mysql',
  dbCredentials: resolveCredentials(),
};
