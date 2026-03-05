'use strict';
const { Router } = require('express');
const { z }      = require('zod');
const { eq, asc, count } = require('drizzle-orm');
const { db, sqlite } = require('../db/client');
const { departments, users, tasks } = require('../db/schema');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const { writeAuditLog } = require('../lib/audit');

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function deptWithCounts(dept) {
  const taskCount   = (db.select({ n: count() }).from(tasks)
    .where(eq(tasks.departmentId, dept.id)).get()).n;
  const memberCount = (db.select({ n: count() }).from(users)
    .where(eq(users.departmentId, dept.id)).get()).n;
  return { ...dept, taskCount, memberCount };
}

// ── GET /api/departments ──────────────────────────────────────────────────────

router.get('/', requireAuth, requireRole('ADMIN'), (req, res) => {
  const rows = db.select().from(departments).orderBy(asc(departments.name)).all();
  return res.json({ departments: rows.map(deptWithCounts) });
});

// ── POST /api/departments ─────────────────────────────────────────────────────

const createSchema = z.object({
  name: z.string().min(1).max(100),
});

router.post('/', requireAuth, requireRole('ADMIN'), (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { name } = parsed.data;
  const existing = db.select().from(departments).where(eq(departments.name, name)).get();
  if (existing) {
    return res.status(409).json({ error: `Department "${name}" already exists` });
  }

  const doCreate = sqlite.transaction(() => {
    const dept = db.insert(departments).values({ name }).returning().get();
    writeAuditLog({
      actorUserId: req.user.id,
      action:      'DEPT_CREATED',
      entityType:  'DEPARTMENT',
      entityId:    dept.id,
      after:       { name },
    });
    return dept;
  });

  return res.status(201).json(deptWithCounts(doCreate()));
});

// ── GET /api/departments/:id ──────────────────────────────────────────────────

router.get('/:id', requireAuth, (req, res) => {
  const actor  = req.user;
  const deptId = parseInt(req.params.id, 10);
  if (isNaN(deptId)) return res.status(400).json({ error: 'Invalid department id' });

  // SUPER can only access their own department
  if (actor.role === 'SUPER' && actor.departmentId !== deptId) {
    return res.status(404).json({ error: 'Department not found' });
  }
  // USER cannot access departments
  if (actor.role === 'USER') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const dept = db.select().from(departments).where(eq(departments.id, deptId)).get();
  if (!dept) return res.status(404).json({ error: 'Department not found' });

  return res.json(deptWithCounts(dept));
});

module.exports = router;
