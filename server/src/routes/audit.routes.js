'use strict';
const { Router } = require('express');
const { and, eq, count, desc } = require('drizzle-orm');
const { db } = require('../db/client');
const { auditLogs, users } = require('../db/schema');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');

const router = Router();

router.get('/', requireAuth, requireRole('ADMIN'), (req, res) => {
  const q        = req.query;
  const page     = parseInt(q.page     ?? '1',  10);
  const pageSize = parseInt(q.pageSize ?? '50', 10);

  if (isNaN(page) || page < 1)
    return res.status(400).json({ error: '"page" must be a positive integer' });
  if (isNaN(pageSize) || pageSize < 1 || pageSize > 100)
    return res.status(400).json({ error: '"pageSize" must be between 1 and 100' });

  const conditions = [];
  if (q.action)     conditions.push(eq(auditLogs.action,     q.action));
  if (q.entityType) conditions.push(eq(auditLogs.entityType, q.entityType));
  if (q.actorUserId) {
    const uid = parseInt(q.actorUserId, 10);
    if (isNaN(uid)) return res.status(400).json({ error: '"actorUserId" must be an integer' });
    conditions.push(eq(auditLogs.actorUserId, uid));
  }

  const where = conditions.length ? and(...conditions) : undefined;
  const total = (db.select({ n: count() }).from(auditLogs).where(where).get()).n;

  const rows = db
    .select({
      id:           auditLogs.id,
      action:       auditLogs.action,
      entityType:   auditLogs.entityType,
      entityId:     auditLogs.entityId,
      departmentId: auditLogs.departmentId,
      beforeJson:   auditLogs.beforeJson,
      afterJson:    auditLogs.afterJson,
      reason:       auditLogs.reason,
      createdAt:    auditLogs.createdAt,
      actorId:      auditLogs.actorUserId,
      actorName:    users.name,
      actorEmail:   users.email,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorUserId, users.id))
    .where(where)
    .orderBy(desc(auditLogs.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all();

  const logs = rows.map(r => ({
    id:           r.id,
    action:       r.action,
    entityType:   r.entityType,
    entityId:     r.entityId,
    departmentId: r.departmentId,
    before:       r.beforeJson ? JSON.parse(r.beforeJson) : null,
    after:        r.afterJson  ? JSON.parse(r.afterJson)  : null,
    reason:       r.reason,
    createdAt:    r.createdAt,
    actor: r.actorId ? { id: r.actorId, name: r.actorName, email: r.actorEmail } : null,
  }));

  return res.json({ logs, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 });
});

module.exports = router;
