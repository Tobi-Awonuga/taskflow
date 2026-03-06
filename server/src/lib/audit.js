'use strict';

const AUDIT_ACTIONS = {
  LOGIN_SUCCESS:       'LOGIN_SUCCESS',
  LOGOUT:              'LOGOUT',
  TASK_CREATED:        'TASK_CREATED',
  TASK_STATUS_CHANGED: 'TASK_STATUS_CHANGED',
  TASK_CANCELLED:      'TASK_CANCELLED',
  TASK_REOPENED:       'TASK_REOPENED',
  TASK_ASSIGNED:       'TASK_ASSIGNED',
  TASK_UNASSIGNED:     'TASK_UNASSIGNED',
  USER_CREATED:        'USER_CREATED',
  USER_UPDATED:        'USER_UPDATED',
  USER_DEACTIVATED:    'USER_DEACTIVATED',
  DEPT_CREATED:          'DEPT_CREATED',
  TASK_PRIORITY_CHANGED:       'TASK_PRIORITY_CHANGED',
  TASK_UPDATED:                'TASK_UPDATED',
  TASK_COLLABORATOR_ADDED:     'TASK_COLLABORATOR_ADDED',
  TASK_COLLABORATOR_REMOVED:   'TASK_COLLABORATOR_REMOVED',
};

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
async function writeAuditLog({
  actorUserId = null,
  action,
  entityType,
  entityId    = null,
  departmentId = null,
  before      = null,
  after       = null,
  reason      = null,
}, client = db) {
  await client.insert(auditLogs).values({
    actorUserId,
    action,
    entityType,
    entityId,
    departmentId,
    beforeJson: before ? JSON.stringify(before) : null,
    afterJson:  after  ? JSON.stringify(after)  : null,
    reason,
  });
}

module.exports = { writeAuditLog, AUDIT_ACTIONS };
