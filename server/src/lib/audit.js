'use strict';
const { db } = require('../db/client');
const { auditLogs } = require('../db/schema');

/**
 * Append an audit log entry.
 *
 * @param {object} opts
 * @param {number|null}  opts.actorUserId
 * @param {string}       opts.action        e.g. 'TASK_CREATED'
 * @param {string}       opts.entityType    e.g. 'TASK'
 * @param {number|null}  opts.entityId
 * @param {number|null}  opts.departmentId
 * @param {object|null}  opts.before        serialised to JSON
 * @param {object|null}  opts.after         serialised to JSON
 * @param {string|null}  opts.reason
 */
function writeAuditLog({
  actorUserId = null,
  action,
  entityType,
  entityId    = null,
  departmentId = null,
  before      = null,
  after       = null,
  reason      = null,
}) {
  db.insert(auditLogs).values({
    actorUserId,
    action,
    entityType,
    entityId,
    departmentId,
    beforeJson: before ? JSON.stringify(before) : null,
    afterJson:  after  ? JSON.stringify(after)  : null,
    reason,
  }).run();
}

module.exports = { writeAuditLog };
