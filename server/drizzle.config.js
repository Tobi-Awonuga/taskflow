/** @type {import('drizzle-kit').Config} */
module.exports = {
  schema:      './src/db/schema.js',
  out:         './drizzle',
  dialect:     'sqlite',
  dbCredentials: {
    url: './db/dev.sqlite',
  },
};
