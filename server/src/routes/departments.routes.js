'use strict';
const { Router } = require('express');
const { z }      = require('zod');
const { eq, asc, count } = require('drizzle-orm');
const { db } = require('../db/client');
const { departments, users, tasks } = require('../db/schema');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const { writeAuditLog, AUDIT_ACTIONS } = require('../lib/audit');
const asyncHandler = require('../utils/asyncHandler');

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

async function deptWithCounts(dept) {
  const [{ n: taskCount }] = await db.select({ n: count() }).from(tasks)
    .where(eq(tasks.departmentId, dept.id));
  const [{ n: memberCount }] = await db.select({ n: count() }).from(users)
    .where(eq(users.departmentId, dept.id));
  return { ...dept, taskCount: Number(taskCount), memberCount: Number(memberCount) };
}

// ── GET /api/departments ──────────────────────────────────────────────────────

router.get('/', requireAuth, requireRole('ADMIN'), asyncHandler(async (_req, res) => {
  const rows = await db.select().from(departments).orderBy(asc(departments.name));
  const enriched = await Promise.all(rows.map(deptWithCounts));
  return res.json({ departments: enriched });
}));

// ── POST /api/departments ─────────────────────────────────────────────────────

const createSchema = z.object({
  name: z.string().min(1).max(100),
});

router.post('/', requireAuth, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { name } = parsed.data;
  const [existing] = await db.select().from(departments).where(eq(departments.name, name)).limit(1);
  if (existing) {
    return res.status(409).json({ error: `Department "${name}" already exists` });
  }

  const dept = await db.transaction(async (tx) => {
    const result = await tx.insert(departments).values({ name });
    const [row] = await tx.select().from(departments).where(eq(departments.id, result.insertId));
    await writeAuditLog({
      actorUserId: req.user.id,
      action:      AUDIT_ACTIONS.DEPT_CREATED,
      entityType:  'DEPARTMENT',
      entityId:    row.id,
      after:       { name },
    }, tx);
    return row;
  });

  return res.status(201).json(await deptWithCounts(dept));
}));

// ── PATCH /api/departments/:id ────────────────────────────────────────────────

const updateSchema = z.object({
  name: z.string().min(1).max(100),
});

router.patch('/:id', requireAuth, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const deptId = parseInt(req.params.id, 10);
  if (isNaN(deptId)) return res.status(400).json({ error: 'Invalid department id' });

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { name } = parsed.data;
  const [conflict] = await db.select().from(departments)
    .where(eq(departments.name, name)).limit(1);
  if (conflict && conflict.id !== deptId) {
    return res.status(409).json({ error: `Department "${name}" already exists` });
  }

  await db.update(departments).set({ name }).where(eq(departments.id, deptId));
  const [dept] = await db.select().from(departments).where(eq(departments.id, deptId)).limit(1);
  if (!dept) return res.status(404).json({ error: 'Department not found' });

  return res.json(await deptWithCounts(dept));
}));

// ── GET /api/departments/:id ──────────────────────────────────────────────────

router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const actor  = req.user;
  const deptId = parseInt(req.params.id, 10);
  if (isNaN(deptId)) return res.status(400).json({ error: 'Invalid department id' });

  // SUPER can only access their own department
  if (actor.role === 'SUPER' && actor.departmentId !== deptId) {
    return res.status(404).json({ error: 'Department not found' });
  }
  // USER can only access their own department
  if (actor.role === 'USER' && actor.departmentId !== deptId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const [dept] = await db.select().from(departments).where(eq(departments.id, deptId)).limit(1);
  if (!dept) return res.status(404).json({ error: 'Department not found' });

  return res.json(await deptWithCounts(dept));
}));

module.exports = router;
