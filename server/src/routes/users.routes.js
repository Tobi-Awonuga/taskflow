'use strict';
const { Router } = require('express');
const { z } = require('zod');
const { and, count, desc, eq, inArray } = require('drizzle-orm');
const { db } = require('../db/client');
const { departments, users } = require('../db/schema');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const requireApproved = require('../middleware/requireApproved');
const { hashPassword } = require('../lib/password');
const { writeAuditLog, AUDIT_ACTIONS } = require('../lib/audit');
const asyncHandler = require('../utils/asyncHandler');
const { mysqlNow } = require('../utils/datetime');

const router = Router();

function safeUser(user) {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}

function now() {
  return mysqlNow();
}

async function departmentNameMap(ids) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();

  const rows = await db.select({
    id: departments.id,
    name: departments.name,
  }).from(departments)
    .where(inArray(departments.id, uniqueIds));

  return new Map(rows.map((row) => [row.id, row.name]));
}

function canReviewRequest(actor, requestedDepartmentId) {
  if (actor.role === 'ADMIN') return true;
  return actor.role === 'SUPER' && actor.departmentId && actor.departmentId === requestedDepartmentId;
}

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(['ADMIN', 'SUPER', 'USER']),
  password: z.string().min(8, 'password must be at least 8 characters'),
  departmentId: z.number().int().positive().optional(),
});

const adminPatchSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['ADMIN', 'SUPER', 'USER']).optional(),
  departmentId: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Provide at least one field to update' },
);

const selfPatchSchema = z.object({
  name: z.string().min(1),
});

const requestAccessSchema = z.object({
  requestedDepartmentId: z.number().int().positive(),
});

const reviewAccessSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
});

router.get('/me/access-request', requireAuth, asyncHandler(async (req, res) => {
  const [user] = await db.select().from(users).where(eq(users.id, req.user.id)).limit(1);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const deptMap = await departmentNameMap([user.requestedDepartmentId, user.departmentId]);

  return res.json({
    user: safeUser(user),
    requestedDepartment: user.requestedDepartmentId
      ? { id: user.requestedDepartmentId, name: deptMap.get(user.requestedDepartmentId) ?? null }
      : null,
    approvedDepartment: user.departmentId
      ? { id: user.departmentId, name: deptMap.get(user.departmentId) ?? null }
      : null,
  });
}));

router.post('/me/access-request', requireAuth, asyncHandler(async (req, res) => {
  const parsed = requestAccessSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const [currentUser] = await db.select().from(users).where(eq(users.id, req.user.id)).limit(1);
  if (!currentUser) return res.status(404).json({ error: 'User not found' });

  if (currentUser.authProvider !== 'MICROSOFT') {
    return res.status(400).json({ error: 'Access requests are only supported for Microsoft SSO accounts' });
  }

  if (currentUser.approvalStatus === 'APPROVED') {
    return res.status(400).json({ error: 'Your account is already approved' });
  }

  const [requestedDepartment] = await db.select({
    id: departments.id,
    name: departments.name,
  }).from(departments)
    .where(eq(departments.id, parsed.data.requestedDepartmentId))
    .limit(1);

  if (!requestedDepartment) {
    return res.status(404).json({ error: 'Department not found' });
  }

  const updated = await db.transaction(async (tx) => {
    await tx.update(users)
      .set({
        requestedDepartmentId: requestedDepartment.id,
        approvalStatus: 'PENDING',
        isActive: true,
        updatedAt: now(),
      })
      .where(eq(users.id, currentUser.id));

    await writeAuditLog({
      actorUserId: currentUser.id,
      action: AUDIT_ACTIONS.ACCESS_REQUEST_SUBMITTED,
      entityType: 'USER',
      entityId: currentUser.id,
      departmentId: requestedDepartment.id,
      after: {
        requestedDepartmentId: requestedDepartment.id,
        approvalStatus: 'PENDING',
      },
    }, tx);

    const [row] = await tx.select().from(users).where(eq(users.id, currentUser.id));
    return row;
  });

  return res.json({
    user: safeUser(updated),
    requestedDepartment,
  });
}));

router.get('/access-requests', requireAuth, requireApproved, requireRole('ADMIN', 'SUPER'), asyncHandler(async (req, res) => {
  const actor = req.user;
  const conditions = [eq(users.authProvider, 'MICROSOFT')];

  if (req.query.status !== undefined) {
    if (!['PENDING', 'APPROVED', 'REJECTED'].includes(req.query.status)) {
      return res.status(400).json({ error: '"status" must be PENDING, APPROVED, or REJECTED' });
    }
    conditions.push(eq(users.approvalStatus, req.query.status));
  } else {
    conditions.push(eq(users.approvalStatus, 'PENDING'));
  }

  if (actor.role === 'SUPER') {
    conditions.push(eq(users.requestedDepartmentId, actor.departmentId));
  }

  const rows = await db.select().from(users)
    .where(and(...conditions))
    .orderBy(desc(users.updatedAt));

  const deptMap = await departmentNameMap([
    ...rows.map((row) => row.requestedDepartmentId),
    ...rows.map((row) => row.departmentId),
  ]);

  return res.json({
    requests: rows.map((row) => ({
      ...safeUser(row),
      requestedDepartmentName: row.requestedDepartmentId ? (deptMap.get(row.requestedDepartmentId) ?? null) : null,
      approvedDepartmentName: row.departmentId ? (deptMap.get(row.departmentId) ?? null) : null,
    })),
  });
}));

router.patch('/:id/access-request', requireAuth, requireApproved, requireRole('ADMIN', 'SUPER'), asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user id' });

  const parsed = reviewAccessSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target) return res.status(404).json({ error: 'User not found' });

  if (!target.requestedDepartmentId) {
    return res.status(400).json({ error: 'This user has not requested a department yet' });
  }

  if (!canReviewRequest(req.user, target.requestedDepartmentId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const updated = await db.transaction(async (tx) => {
    const approvalTime = now();
    const updates = parsed.data.action === 'APPROVE'
      ? {
          approvalStatus: 'APPROVED',
          departmentId: target.requestedDepartmentId,
          approvedByUserId: req.user.id,
          approvedAt: approvalTime,
          isActive: true,
          updatedAt: approvalTime,
        }
      : {
          approvalStatus: 'REJECTED',
          approvedByUserId: req.user.id,
          approvedAt: approvalTime,
          isActive: false,
          updatedAt: approvalTime,
        };

    await tx.update(users).set(updates).where(eq(users.id, userId));
    const [row] = await tx.select().from(users).where(eq(users.id, userId));

    await writeAuditLog({
      actorUserId: req.user.id,
      action: parsed.data.action === 'APPROVE'
        ? AUDIT_ACTIONS.ACCESS_REQUEST_APPROVED
        : AUDIT_ACTIONS.ACCESS_REQUEST_REJECTED,
      entityType: 'USER',
      entityId: userId,
      departmentId: target.requestedDepartmentId,
      before: {
        approvalStatus: target.approvalStatus,
        requestedDepartmentId: target.requestedDepartmentId,
      },
      after: {
        approvalStatus: row.approvalStatus,
        departmentId: row.departmentId,
        approvedByUserId: row.approvedByUserId,
      },
    }, tx);

    return row;
  });

  return res.json(safeUser(updated));
}));

router.get('/', requireAuth, requireApproved, asyncHandler(async (req, res) => {
  const actor = req.user;
  const q = req.query;
  const page = parseInt(q.page ?? '1', 10);
  const pageSize = parseInt(q.pageSize ?? '20', 10);

  if (isNaN(page) || page < 1) {
    return res.status(400).json({ error: '"page" must be a positive integer' });
  }
  if (isNaN(pageSize) || pageSize < 1 || pageSize > 100) {
    return res.status(400).json({ error: '"pageSize" must be between 1 and 100' });
  }

  const conditions = [];

  if (actor.role !== 'ADMIN') {
    conditions.push(eq(users.departmentId, actor.departmentId));
    conditions.push(eq(users.isActive, true));
    conditions.push(eq(users.approvalStatus, 'APPROVED'));
  } else {
    if (q.role !== undefined) {
      if (!['ADMIN', 'SUPER', 'USER'].includes(q.role)) {
        return res.status(400).json({ error: '"role" must be ADMIN, SUPER, or USER' });
      }
      conditions.push(eq(users.role, q.role));
    }

    if (q.departmentId !== undefined) {
      const departmentId = parseInt(q.departmentId, 10);
      if (isNaN(departmentId)) {
        return res.status(400).json({ error: '"departmentId" must be an integer' });
      }
      conditions.push(eq(users.departmentId, departmentId));
    }

    if (q.isActive !== undefined) {
      if (q.isActive !== 'true' && q.isActive !== 'false') {
        return res.status(400).json({ error: '"isActive" must be true or false' });
      }
      conditions.push(eq(users.isActive, q.isActive === 'true'));
    }

    if (q.approvalStatus !== undefined) {
      if (!['PENDING', 'APPROVED', 'REJECTED'].includes(q.approvalStatus)) {
        return res.status(400).json({ error: '"approvalStatus" must be PENDING, APPROVED, or REJECTED' });
      }
      conditions.push(eq(users.approvalStatus, q.approvalStatus));
    }
  }

  const where = conditions.length ? and(...conditions) : undefined;
  const [{ n: total }] = await db.select({ n: count() }).from(users).where(where);
  const rows = await db.select().from(users).where(where)
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const totalNum = Number(total);

  return res.json({
    users: rows.map(safeUser),
    total: totalNum,
    page,
    pageSize,
    totalPages: Math.ceil(totalNum / pageSize) || 1,
  });
}));

router.post('/', requireAuth, requireApproved, requireRole('ADMIN'), asyncHandler(async (req, res) => {
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
      email: email.toLowerCase(),
      name,
      role,
      passwordHash: hashPassword(password),
      departmentId: departmentId ?? null,
      approvalStatus: 'APPROVED',
      isActive: true,
    });
    const [user] = await tx.select().from(users).where(eq(users.id, insertResult.insertId));

    await writeAuditLog({
      actorUserId: req.user.id,
      action: AUDIT_ACTIONS.USER_CREATED,
      entityType: 'USER',
      entityId: user.id,
      after: { email: user.email, name, role, departmentId: departmentId ?? null },
    }, tx);

    return user;
  });

  return res.status(201).json(safeUser(created));
}));

router.get('/all', requireAuth, requireApproved, asyncHandler(async (_req, res) => {
  const rows = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    role: users.role,
    departmentId: users.departmentId,
    isActive: users.isActive,
  }).from(users)
    .where(and(eq(users.isActive, true), eq(users.approvalStatus, 'APPROVED')))
    .orderBy(users.name);

  return res.json({ users: rows });
}));

router.get('/:id', requireAuth, requireApproved, asyncHandler(async (req, res) => {
  const actor = req.user;
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user id' });

  if (actor.role !== 'ADMIN' && actor.id !== userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return res.status(404).json({ error: 'User not found' });

  return res.json(safeUser(user));
}));

router.patch('/:id', requireAuth, requireApproved, asyncHandler(async (req, res) => {
  const actor = req.user;
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
      action: AUDIT_ACTIONS.USER_UPDATED,
      entityType: 'USER',
      entityId: userId,
      before,
      after,
    }, tx);
    return row;
  });

  return res.json(safeUser(updated));
}));

router.delete('/:id', requireAuth, requireApproved, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const actor = req.user;
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
      action: AUDIT_ACTIONS.USER_DEACTIVATED,
      entityType: 'USER',
      entityId: userId,
      before: { isActive: true },
      after: { isActive: false },
    }, tx);
  });

  return res.json({ ok: true });
}));

module.exports = router;
