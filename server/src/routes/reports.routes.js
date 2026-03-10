'use strict';
const { Router } = require('express');
const { and, eq, count, inArray, isNull, isNotNull, lt, sql } = require('drizzle-orm');
const { db }          = require('../db/client');
const { tasks, users, departments, auditLogs } = require('../db/schema');
const requireAuth     = require('../middleware/requireAuth');
const requireRole     = require('../middleware/requireRole');
const asyncHandler    = require('../utils/asyncHandler');

const router = Router();

// All reports routes require ADMIN
router.use(requireAuth, requireRole('ADMIN'));

// ── Helper ────────────────────────────────────────────────────────────────────

const ACTIVE_STATUSES  = ['TODO', 'IN_PROGRESS', 'BLOCKED'];
const OVERDUE_STATUSES = ['TODO', 'IN_PROGRESS', 'BLOCKED'];

function todayIsoStr() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

// ── GET /api/reports/overview ─────────────────────────────────────────────────

router.get('/overview', asyncHandler(async (_req, res) => {
  // 1. Status breakdown — one query grouping by status
  const statusRows = await db
    .select({ status: tasks.status, n: count() })
    .from(tasks)
    .groupBy(tasks.status);

  const statusBreakdown = { TODO: 0, IN_PROGRESS: 0, DONE: 0, BLOCKED: 0, CANCELLED: 0 };
  for (const row of statusRows) {
    if (row.status in statusBreakdown) statusBreakdown[row.status] = Number(row.n);
  }

  const totalTasks = Object.values(statusBreakdown).reduce((a, b) => a + b, 0);
  const done       = statusBreakdown.DONE;
  const completionRate = totalTasks > 0 ? parseFloat((done / totalTasks).toFixed(4)) : 0;

  // 2. Overdue count — dueAt < NOW and status in active statuses
  const now = todayIsoStr();
  const [{ n: overdueN }] = await db
    .select({ n: count() })
    .from(tasks)
    .where(and(
      inArray(tasks.status, OVERDUE_STATUSES),
      lt(tasks.dueAt, now),
    ));
  const overdueCount = Number(overdueN);

  // 3. Avg cycle time — raw SQL: for each DONE task, find most recent IN_PROGRESS
  //    audit event before the DONE audit event, compute diff, then average.
  const [cycleRow] = await db.execute(sql`
    SELECT AVG(cycle_ms) AS avg_cycle_ms
    FROM (
      SELECT
        done_log.entity_id,
        TIMESTAMPDIFF(
          SECOND,
          ip_log.created_at,
          done_log.created_at
        ) * 1000 AS cycle_ms
      FROM audit_logs AS done_log
      INNER JOIN audit_logs AS ip_log
        ON ip_log.entity_type = 'TASK'
        AND ip_log.entity_id  = done_log.entity_id
        AND ip_log.action     = 'TASK_STATUS_CHANGED'
        AND JSON_UNQUOTE(JSON_EXTRACT(ip_log.after_json,  '$.status')) = 'IN_PROGRESS'
        AND ip_log.created_at = (
          SELECT MAX(inner_ip.created_at)
          FROM audit_logs AS inner_ip
          WHERE inner_ip.entity_type = 'TASK'
            AND inner_ip.entity_id   = done_log.entity_id
            AND inner_ip.action      = 'TASK_STATUS_CHANGED'
            AND JSON_UNQUOTE(JSON_EXTRACT(inner_ip.after_json, '$.status')) = 'IN_PROGRESS'
            AND inner_ip.created_at < done_log.created_at
        )
      WHERE done_log.entity_type = 'TASK'
        AND done_log.action      = 'TASK_STATUS_CHANGED'
        AND JSON_UNQUOTE(JSON_EXTRACT(done_log.after_json, '$.status')) = 'DONE'
    ) AS cycle_data
  `);

  // db.execute returns [rows, fields] for mysql2
  const rawAvg = Array.isArray(cycleRow) ? cycleRow[0]?.avg_cycle_ms : cycleRow?.avg_cycle_ms;
  const avgCycleTimeMs = rawAvg != null ? Math.round(Number(rawAvg)) : null;

  return res.json({
    totalTasks,
    completionRate,
    overdueCount,
    avgCycleTimeMs,
    statusBreakdown,
  });
}));

// ── GET /api/reports/by-department ────────────────────────────────────────────

router.get('/by-department', asyncHandler(async (_req, res) => {
  const now = todayIsoStr();

  // Fetch all departments
  const deptRows = await db
    .select({ id: departments.id, name: departments.name })
    .from(departments);

  // All task status+dueAt+deptId in one pass (avoids N+1)
  const taskRows = await db
    .select({
      departmentId: tasks.departmentId,
      status:       tasks.status,
      dueAt:        tasks.dueAt,
    })
    .from(tasks);

  // Group task rows by departmentId (null = org-wide)
  function buildStats(rows) {
    const stats = { total: 0, done: 0, inProgress: 0, overdue: 0 };
    for (const t of rows) {
      stats.total++;
      if (t.status === 'DONE')        stats.done++;
      if (t.status === 'IN_PROGRESS') stats.inProgress++;
      if (
        OVERDUE_STATUSES.includes(t.status) &&
        t.dueAt &&
        t.dueAt < now
      ) {
        stats.overdue++;
      }
    }
    stats.completionRate = stats.total > 0
      ? parseFloat((stats.done / stats.total).toFixed(4))
      : 0;
    return stats;
  }

  // Build per-dept map
  const deptTaskMap = {};
  for (const row of taskRows) {
    const key = row.departmentId ?? 'null';
    if (!deptTaskMap[key]) deptTaskMap[key] = [];
    deptTaskMap[key].push(row);
  }

  const result = [];

  // Named departments
  for (const dept of deptRows) {
    const rows  = deptTaskMap[dept.id] ?? [];
    const stats = buildStats(rows);
    result.push({ id: dept.id, name: dept.name, ...stats });
  }

  // Org-wide (null dept)
  const nullRows  = deptTaskMap['null'] ?? [];
  const nullStats = buildStats(nullRows);
  result.push({ id: null, name: 'Org-wide (no dept)', ...nullStats });

  return res.json({ departments: result });
}));

// ── GET /api/reports/by-user ──────────────────────────────────────────────────

router.get('/by-user', asyncHandler(async (_req, res) => {
  const now = todayIsoStr();

  // Fetch active users
  const userRows = await db
    .select({
      id:    users.id,
      name:  users.name,
      email: users.email,
    })
    .from(users)
    .where(eq(users.isActive, true));

  if (userRows.length === 0) return res.json({ users: [] });

  // All tasks that are assigned to someone
  const taskRows = await db
    .select({
      assignedToUserId: tasks.assignedToUserId,
      status:           tasks.status,
      dueAt:            tasks.dueAt,
    })
    .from(tasks)
    .where(isNotNull(tasks.assignedToUserId));

  // Group tasks by userId
  const userTaskMap = {};
  for (const t of taskRows) {
    const uid = t.assignedToUserId;
    if (!userTaskMap[uid]) userTaskMap[uid] = [];
    userTaskMap[uid].push(t);
  }

  const result = [];
  for (const u of userRows) {
    const rows = userTaskMap[u.id];
    if (!rows || rows.length === 0) continue; // skip users with no tasks

    let done = 0, inProgress = 0, overdue = 0;
    for (const t of rows) {
      if (t.status === 'DONE')        done++;
      if (t.status === 'IN_PROGRESS') inProgress++;
      if (
        OVERDUE_STATUSES.includes(t.status) &&
        t.dueAt &&
        t.dueAt < now
      ) {
        overdue++;
      }
    }
    const assigned        = rows.length;
    const completionRate  = parseFloat((done / assigned).toFixed(4));

    result.push({ id: u.id, name: u.name, email: u.email, assigned, done, inProgress, overdue, completionRate });
  }

  // Order by assigned DESC
  result.sort((a, b) => b.assigned - a.assigned);

  return res.json({ users: result });
}));

module.exports = router;
