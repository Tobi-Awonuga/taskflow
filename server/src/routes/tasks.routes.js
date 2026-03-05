'use strict';
const { Router }  = require('express');
const { z }       = require('zod');
const { and, eq, count, desc, sql } = require('drizzle-orm');
const { db, sqlite } = require('../db/client');
const { tasks, users } = require('../db/schema');
const requireAuth = require('../middleware/requireAuth');
const { canAssign, canView, visibilityDeptId } = require('../lib/rbac');
const { validateStatusTransition, VALID_STATUSES, VALID_PRIORITIES } = require('../lib/taskValidation');
const { writeAuditLog, AUDIT_ACTIONS } = require('../lib/audit');

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function now() { return new Date().toISOString(); }

// ── Zod schemas ───────────────────────────────────────────────────────────────

const createSchema = z.object({
  title:            z.string().min(1, '"title" is required'),
  description:      z.string().optional().default(''),
  priority:         z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  dueAt:            z.string().datetime({ message: '"dueAt" must be a valid ISO datetime string' }).optional(),
  assignedToUserId: z.number().int().positive().nullable().optional(),
  departmentId:     z.number().int().positive().optional(),
});

const patchSchema = z.object({
  status:           z.enum([...VALID_STATUSES]).optional(),
  assignedToUserId: z.number().int().positive().nullable().optional(),
  cancelReason:     z.string().min(1).optional(),
  priority:         z.enum([...VALID_PRIORITIES]).optional(),
  title:            z.string().min(1).max(200).optional(),
  description:      z.string().optional(),
  dueAt:            z.string().datetime({ message: '"dueAt" must be a valid ISO datetime string' }).nullable().optional(),
}).refine(
  (d) =>
    d.status !== undefined ||
    d.assignedToUserId !== undefined ||
    d.priority !== undefined ||
    d.title !== undefined ||
    d.description !== undefined ||
    d.dueAt !== undefined,
  { message: 'Provide at least one field to update' },
);

// ── GET /api/tasks ─────────────────────────────────────────────────────────────

router.get('/', requireAuth, (req, res) => {
  const q    = req.query;
  const actor = req.user;

  // Pagination
  const page     = parseInt(q.page     ?? '1',  10);
  const pageSize = parseInt(q.pageSize ?? '20', 10);
  if (isNaN(page) || page < 1) {
    return res.status(400).json({ error: '"page" must be a positive integer' });
  }
  if (isNaN(pageSize) || pageSize < 1 || pageSize > 100) {
    return res.status(400).json({ error: '"pageSize" must be between 1 and 100' });
  }

  // Build WHERE conditions
  const conditions = [];

  // Visibility — ADMIN sees all; others restricted to own department
  const deptFilter = visibilityDeptId(actor);
  if (deptFilter !== null) conditions.push(eq(tasks.departmentId, deptFilter));

  // Optional: ADMIN may further filter by departmentId
  if (actor.role === 'ADMIN' && q.departmentId !== undefined) {
    const d = parseInt(q.departmentId, 10);
    if (isNaN(d)) return res.status(400).json({ error: '"departmentId" must be an integer' });
    conditions.push(eq(tasks.departmentId, d));
  }

  if (q.status !== undefined) {
    if (!VALID_STATUSES.has(q.status)) {
      return res.status(400).json({ error: `"status" must be one of: ${[...VALID_STATUSES].join(', ')}` });
    }
    conditions.push(eq(tasks.status, q.status));
  }

  if (q.priority !== undefined) {
    if (!VALID_PRIORITIES.has(q.priority)) {
      return res.status(400).json({ error: `"priority" must be one of: ${[...VALID_PRIORITIES].join(', ')}` });
    }
    conditions.push(eq(tasks.priority, q.priority));
  }

  if (q.assignedToUserId !== undefined) {
    const uid = parseInt(q.assignedToUserId, 10);
    if (isNaN(uid)) return res.status(400).json({ error: '"assignedToUserId" must be an integer' });
    conditions.push(eq(tasks.assignedToUserId, uid));
  }

  if (q.createdByUserId !== undefined) {
    const uid = parseInt(q.createdByUserId, 10);
    if (isNaN(uid)) return res.status(400).json({ error: '"createdByUserId" must be an integer' });
    conditions.push(eq(tasks.createdByUserId, uid));
  }

  if (q.q) {
    const escaped = q.q.replace(/%/g, '\\%').replace(/_/g, '\\_');
    conditions.push(sql`${tasks.title} LIKE ${'%' + escaped + '%'} ESCAPE '\\'`);
  }

  const where = conditions.length ? and(...conditions) : undefined;

  const total = (db.select({ n: count() }).from(tasks).where(where).get()).n;
  const rows  = db.select().from(tasks).where(where)
    .orderBy(desc(tasks.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all();

  return res.json({
    tasks:      rows,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  });
});

// ── POST /api/tasks ────────────────────────────────────────────────────────────

router.post('/', requireAuth, (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { title, description, priority, dueAt, assignedToUserId, departmentId } = parsed.data;
  const actor = req.user;

  // Cannot create a task directly as CANCELLED
  if (req.body.status === 'CANCELLED') {
    return res.status(400).json({ error: 'Cannot create a task as CANCELLED' });
  }

  // ADMIN must specify departmentId; others use their own
  if (actor.role === 'ADMIN' && !departmentId) {
    return res.status(400).json({ error: '"departmentId" is required for ADMIN users' });
  }
  const taskDeptId = actor.role === 'ADMIN' ? departmentId : actor.departmentId;

  // Validate assignment
  if (assignedToUserId != null) {
    const assignee = db.select().from(users).where(eq(users.id, assignedToUserId)).get();
    if (!assignee) {
      return res.status(400).json({ error: `User ${assignedToUserId} not found` });
    }
    if (!canAssign(actor, null, assignedToUserId)) {
      return res.status(403).json({ error: 'You can only assign tasks to yourself' });
    }
    if (assignee.departmentId !== taskDeptId && actor.role !== 'ADMIN') {
      return res.status(400).json({ error: 'Assignee must be in the same department as the task' });
    }
  }

  const insertWithAudit = sqlite.transaction(() => {
    const result = db.insert(tasks).values({
      title,
      description,
      priority,
      status:           'TODO',
      departmentId:     taskDeptId,
      createdByUserId:  actor.id,
      assignedToUserId: assignedToUserId ?? null,
      dueAt:            dueAt ?? null,
    }).returning().get();

    writeAuditLog({
      actorUserId:  actor.id,
      action:       AUDIT_ACTIONS.TASK_CREATED,
      entityType:   'TASK',
      entityId:     result.id,
      departmentId: taskDeptId,
      after:        { title, priority, status: 'TODO', assignedToUserId: assignedToUserId ?? null },
    });

    if (assignedToUserId != null) {
      writeAuditLog({
        actorUserId:  actor.id,
        action:       AUDIT_ACTIONS.TASK_ASSIGNED,
        entityType:   'TASK',
        entityId:     result.id,
        departmentId: taskDeptId,
        before:       { assignedToUserId: null },
        after:        { assignedToUserId },
      });
    }

    return result;
  });

  const result = insertWithAudit();
  return res.status(201).json(result);
});

// ── GET /api/tasks/:id ─────────────────────────────────────────────────────────

router.get('/:id', requireAuth, (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  if (isNaN(taskId)) return res.status(400).json({ error: 'Invalid task id' });

  const task = db.select().from(tasks).where(eq(tasks.id, taskId)).get();
  if (!task || !canView(req.user, task)) {
    return res.status(404).json({ error: 'Task not found' });
  }

  return res.json(task);
});

// ── PATCH /api/tasks/:id ───────────────────────────────────────────────────────
// Supports: status transitions (with cancelReason), assignment changes.

router.patch('/:id', requireAuth, (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  if (isNaN(taskId)) return res.status(400).json({ error: 'Invalid task id' });

  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  let { status, assignedToUserId, cancelReason, priority, title, description, dueAt } = parsed.data;
  const actor = req.user;

  const task = db.select().from(tasks).where(eq(tasks.id, taskId)).get();
  if (!task || !canView(actor, task)) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const updates   = { updatedAt: now() };
  const auditRows = [];

  // ── Assignment change ────────────────────────────────────────────────────────
  if (assignedToUserId !== undefined) {
    let assignee = null;
    if (assignedToUserId !== null) {
      assignee = db.select().from(users).where(eq(users.id, assignedToUserId)).get();
      if (!assignee) {
        return res.status(400).json({ error: `User ${assignedToUserId} not found` });
      }
      if (!canAssign(actor, task, assignedToUserId)) {
        return res.status(403).json({ error: 'You can only assign tasks to yourself' });
      }
      if (actor.role !== 'ADMIN' && assignee.departmentId !== task.departmentId) {
        return res.status(400).json({ error: 'Assignee must be in the same department as the task' });
      }
    }

    const prevId = task.assignedToUserId;
    updates.assignedToUserId = assignedToUserId;

    auditRows.push({
      action:       assignedToUserId === null ? AUDIT_ACTIONS.TASK_UNASSIGNED : AUDIT_ACTIONS.TASK_ASSIGNED,
      before:       { assignedToUserId: prevId },
      after:        { assignedToUserId },
    });
  }

  // ── Priority change ──────────────────────────────────────────────────────────
  if (priority !== undefined) {
    auditRows.push({
      action: AUDIT_ACTIONS.TASK_PRIORITY_CHANGED,
      before: { priority: task.priority },
      after:  { priority },
    });
    updates.priority = priority;
  }

  // ── Content edits (title, description, dueAt) ────────────────────────────
  // USER can only edit tasks they created or are assigned to
  const canEditContent =
    actor.role === 'ADMIN' ||
    actor.role === 'SUPER' ||
    task.createdByUserId === actor.id ||
    task.assignedToUserId === actor.id;

  if ((title !== undefined || description !== undefined || dueAt !== undefined) && !canEditContent) {
    return res.status(403).json({ error: 'You can only edit tasks you created or are assigned to' });
  }

  if (title !== undefined) {
    auditRows.push({
      action: AUDIT_ACTIONS.TASK_UPDATED,
      before: { title: task.title },
      after:  { title },
    });
    updates.title = title;
  }

  if (description !== undefined) {
    auditRows.push({
      action: AUDIT_ACTIONS.TASK_UPDATED,
      before: { description: task.description },
      after:  { description },
    });
    updates.description = description;
  }

  if (dueAt !== undefined) {
    auditRows.push({
      action: AUDIT_ACTIONS.TASK_UPDATED,
      before: { dueAt: task.dueAt },
      after:  { dueAt },
    });
    updates.dueAt = dueAt;
  }

  // ── Status transition ────────────────────────────────────────────────────────
  if (status !== undefined) {
    // Reflect any in-request assignment change so transitions see the new assignee
    const effectiveTask = assignedToUserId !== undefined
      ? { ...task, assignedToUserId: updates.assignedToUserId }
      : task;

    const result = validateStatusTransition(task.status, status, actor, effectiveTask, cancelReason);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    const prevStatus = task.status;
    updates.status = status;
    Object.assign(updates, result.updates);

    const auditAction = status === 'CANCELLED' ? AUDIT_ACTIONS.TASK_CANCELLED
      : (task.status === 'CANCELLED' && status === 'TODO') ? AUDIT_ACTIONS.TASK_REOPENED
      : AUDIT_ACTIONS.TASK_STATUS_CHANGED;

    auditRows.push({
      action: auditAction,
      before: { status: prevStatus },
      after:  { status, ...result.updates },
      reason: cancelReason ?? null,
    });
  }

  const updateWithAudit = sqlite.transaction(() => {
    const updated = db.update(tasks).set(updates).where(eq(tasks.id, taskId)).returning().get();
    for (const row of auditRows) {
      writeAuditLog({
        actorUserId:  actor.id,
        entityType:   'TASK',
        entityId:     taskId,
        departmentId: task.departmentId,
        ...row,
      });
    }
    return updated;
  });

  return res.json(updateWithAudit());
});

// DELETE — not yet implemented
router.delete('/:id', requireAuth, (_req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

module.exports = router;
