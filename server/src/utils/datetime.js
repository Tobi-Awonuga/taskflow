'use strict';

/**
 * Format a Date as a MySQL DATETIME/TIMESTAMP string.
 * MySQL rejects ISO 8601 'Z' suffix — use 'YYYY-MM-DD HH:MM:SS.mmm' instead.
 */
function toMysqlDatetime(date) {
  return date.toISOString().replace('T', ' ').replace('Z', '');
}

/** MySQL datetime string for right now. */
function mysqlNow() {
  return toMysqlDatetime(new Date());
}

module.exports = { toMysqlDatetime, mysqlNow };
