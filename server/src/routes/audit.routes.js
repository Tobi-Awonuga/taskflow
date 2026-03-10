'use strict';
const { Router } = require('express');
const { and, eq, count, desc, inArray, sql } = require('drizzle-orm');
const { db } = require('../db/client');
const { auditLogs, users, tasks } = require('../db/schema');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const asyncHandler = require('../utils/asyncHandler');

const router = Router();

router.get('/', requireAuth, requireRole('ADMIN'), asyncHandler(async (req, res) => {
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
  const [{ n: total }] = await db.select({ n: count() }).from(auditLogs).where(where);
  const totalNum = Number(total);

  const rows = await db
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
    .offset((page - 1) * pageSize);

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

  // ── Enrich: entity names ─────────────────────────────────────────────────────

  const taskEntityIds = [...new Set(
    logs.filter(l => l.entityType === 'TASK' && l.entityId).map(l => l.entityId),
  )];
  const userEntityIds = [...new Set(
    logs.filter(l => l.entityType === 'USER' && l.entityId).map(l => l.entityId),
  )];

  const taskNameMap = {};
  if (taskEntityIds.length > 0) {
    const taskRows = await db
      .select({ id: tasks.id, title: tasks.title })
      .from(tasks)
      .where(inArray(tasks.id, taskEntityIds));
    taskRows.forEach(t => { taskNameMap[t.id] = t.title; });
  }

  const userNameMap = {};
  if (userEntityIds.length > 0) {
    const userRows = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, userEntityIds));
    userRows.forEach(u => { userNameMap[u.id] = u.name; });
  }

  // ── Enrich: cycle time (IN_PROGRESS → DONE) ──────────────────────────────────

  const doneTransitions = logs.filter(l =>
    l.action === 'TASK_STATUS_CHANGED' && l.after?.status === 'DONE' && l.entityId,
  );

  const cycleTimeMap = {};
  await Promise.all(doneTransitions.map(async (log) => {
    const [ipRow] = await db
      .select({ createdAt: auditLogs.createdAt })
      .from(auditLogs)
      .where(and(
        eq(auditLogs.entityType, 'TASK'),
        eq(auditLogs.entityId,   log.entityId),
        eq(auditLogs.action,     'TASK_STATUS_CHANGED'),
        sql`JSON_EXTRACT(${auditLogs.afterJson}, '$.status') = 'IN_PROGRESS'`,
        sql`${auditLogs.createdAt} < ${log.createdAt}`,
      ))
      .orderBy(desc(auditLogs.createdAt))
      .limit(1);

    if (ipRow) {
      const ms = new Date(log.createdAt) - new Date(ipRow.createdAt);
      if (ms > 0) cycleTimeMap[log.id] = ms;
    }
  }));

  // ── Final response ────────────────────────────────────────────────────────────

  const enrichedLogs = logs.map(l => ({
    ...l,
    entityName: l.entityType === 'TASK' ? (taskNameMap[l.entityId] ?? null)
              : l.entityType === 'USER' ? (userNameMap[l.entityId] ?? null)
              : null,
    cycleTime: cycleTimeMap[l.id] ?? null,
  }));

  return res.json({
    logs:       enrichedLogs,
    total:      totalNum,
    page,
    pageSize,
    totalPages: Math.ceil(totalNum / pageSize) || 1,
  });
}));

module.exports = router;
