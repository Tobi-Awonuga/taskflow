'use strict';
const { Router } = require('express');
const { z }      = require('zod');
const { eq, and, count } = require('drizzle-orm');
const { db } = require('../db/client');
const { users }  = require('../db/schema');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const { hashPassword } = require('../lib/password');
const { writeAuditLog, AUDIT_ACTIONS } = require('../lib/audit');
const asyncHandler = require('../utils/asyncHandler');
const { mysqlNow } = require('../utils/datetime');

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeUser(u) {
  const { passwordHash: _h, ...rest } = u;
  return rest;
}

function now() { return mysqlNow(); }

// ── GET /api/users ────────────────────────────────────────────────────────────

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const actor    = req.user;
  const q        = req.query;
  const page     = parseInt(q.page     ?? '1',  10);
  const pageSize = parseInt(q.pageSize ?? '20', 10);

  if (isNaN(page) || page < 1) {
    return res.status(400).json({ error: '"page" must be a positive integer' });
  }
  if (isNaN(pageSize) || pageSize < 1 || pageSize > 100) {
    return res.status(400).json({ error: '"pageSize" must be between 1 and 100' });
  }

  const conditions = [];

  if (actor.role !== 'ADMIN') {
    // Non-ADMIN: always scoped to own department, active users only
    conditions.push(eq(users.departmentId, actor.departmentId));
    conditions.push(eq(users.isActive, true));
  } else {
    // ADMIN: optional filters
    if (q.role !== undefined) {
      if (!['ADMIN', 'SUPER', 'USER'].includes(q.role)) {
        return res.status(400).json({ error: '"role" must be ADMIN, SUPER, or USER' });
      }
      conditions.push(eq(users.role, q.role));
    }

    if (q.departmentId !== undefined) {
      const d = parseInt(q.departmentId, 10);
      if (isNaN(d)) return res.status(400).json({ error: '"departmentId" must be an integer' });
      conditions.push(eq(users.departmentId, d));
    }

    if (q.isActive !== undefined) {
      if (q.isActive !== 'true' && q.isActive !== 'false') {
        return res.status(400).json({ error: '"isActive" must be true or false' });
      }
      conditions.push(eq(users.isActive, q.isActive === 'true'));
    }
  }

  const where = conditions.length ? and(...conditions) : undefined;
  const [{ n: total }] = await db.select({ n: count() }).from(users).where(where);
  const rows  = await db.select().from(users).where(where)
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const totalNum = Number(total);

  return res.json({
    users:      rows.map(safeUser),
    total:      totalNum,
    page,
    pageSize,
    totalPages: Math.ceil(totalNum / pageSize) || 1,
  });
}));

// ── POST /api/users ───────────────────────────────────────────────────────────

const createSchema = z.object({
  email:        z.string().email(),
  name:         z.string().min(1),
  role:         z.enum(['ADMIN', 'SUPER', 'USER']),
  password:     z.string().min(8, 'password must be at least 8 characters'),
  departmentId: z.number().int().positive().optional(),
});

router.post('/', requireAuth, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { email, name, role, password, departmentId } = parsed.data;

  if ((role === 'SUPER' || role === 'USER') && !departmentId) {
    return res.status(400).json({ error: '"departmentId" is required for SUPER and USER roles' });
  }

  const [existing] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  if (existing) {
    return res.status(409).json({ error: `Email "${email}" is already in use` });
  }

  const created = await db.transaction(async (tx) => {
    const insertResult = await tx.insert(users).values({
      email:        email.toLowerCase(),
      name,
      role,
      passwordHash: hashPassword(password),
      departmentId: departmentId ?? null,
      isActive:     true,
    });
    const [user] = await tx.select().from(users).where(eq(users.id, insertResult.insertId));

    await writeAuditLog({
      actorUserId: req.user.id,
      action:      AUDIT_ACTIONS.USER_CREATED,
      entityType:  'USER',
      entityId:    user.id,
      after:       { email: user.email, name, role, departmentId: departmentId ?? null },
    }, tx);

    return user;
  });

  return res.status(201).json(safeUser(created));
}));

// ── GET /api/users/all ────────────────────────────────────────────────────────
// Returns all active users — no pagination. Used by assignee/collaborator dropdowns.

router.get('/all', requireAuth, asyncHandler(async (_req, res) => {
  const rows = await db.select({
    id:           users.id,
    name:         users.name,
    email:        users.email,
    role:         users.role,
    departmentId: users.departmentId,
    isActive:     users.isActive,
  }).from(users)
    .where(eq(users.isActive, true))
    .orderBy(users.name);

  return res.json({ users: rows });
}));

// ── GET /api/users/:id ────────────────────────────────────────────────────────

router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const actor  = req.user;
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user id' });

  if (actor.role !== 'ADMIN' && actor.id !== userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return res.status(404).json({ error: 'User not found' });

  return res.json(safeUser(user));
}));

// ── PATCH /api/users/:id ──────────────────────────────────────────────────────

const adminPatchSchema = z.object({
  name:         z.string().min(1).optional(),
  role:         z.enum(['ADMIN', 'SUPER', 'USER']).optional(),
  departmentId: z.number().int().positive().nullable().optional(),
  isActive:     z.boolean().optional(),
}).refine(
  (d) => Object.keys(d).length > 0,
  { message: 'Provide at least one field to update' },
);

const selfPatchSchema = z.object({
  name: z.string().min(1),
});

router.patch('/:id', requireAuth, asyncHandler(async (req, res) => {
  const actor  = req.user;
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user id' });

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (actor.role !== 'ADMIN' && actor.id !== userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  let updates;
  const before = {};

  if (actor.role === 'ADMIN') {
    const parsed = adminPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    // ADMIN cannot change their own role
    if (parsed.data.role !== undefined && actor.id === userId) {
      return res.status(403).json({ error: 'ADMIN cannot change their own role' });
    }

    if (parsed.data.isActive === false && actor.id === userId) {
      return res.status(400).json({ error: 'You cannot deactivate your own account' });
    }

    updates = { ...parsed.data, updatedAt: now() };
    for (const key of Object.keys(parsed.data)) {
      before[key] = user[key];
    }
  } else {
    const parsed = selfPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    updates = { name: parsed.data.name, updatedAt: now() };
    before.name = user.name;
  }

  const updated = await db.transaction(async (tx) => {
    await tx.update(users).set(updates).where(eq(users.id, userId));
    const [row] = await tx.select().from(users).where(eq(users.id, userId));
    const after = {};
    for (const key of Object.keys(before)) {
      after[key] = row[key];
    }
    await writeAuditLog({
      actorUserId: actor.id,
      action:      AUDIT_ACTIONS.USER_UPDATED,
      entityType:  'USER',
      entityId:    userId,
      before,
      after,
    }, tx);
    return row;
  });

  return res.json(safeUser(updated));
}));

// ── DELETE /api/users/:id — soft delete ───────────────────────────────────────

router.delete('/:id', requireAuth, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const actor  = req.user;
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user id' });

  if (actor.id === userId) {
    return res.status(403).json({ error: 'ADMIN cannot deactivate themselves' });
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return res.status(404).json({ error: 'User not found' });

  await db.transaction(async (tx) => {
    await tx.update(users).set({ isActive: false, updatedAt: now() }).where(eq(users.id, userId));
    await writeAuditLog({
      actorUserId: actor.id,
      action:      AUDIT_ACTIONS.USER_DEACTIVATED,
      entityType:  'USER',
      entityId:    userId,
      before:      { isActive: true },
      after:       { isActive: false },
    }, tx);
  });

  return res.json({ ok: true });
}));

module.exports = router;
