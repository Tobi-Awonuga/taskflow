'use strict';
const { Router }  = require('express');
const { z }       = require('zod');
const { and, eq, count, desc, sql, or, isNull } = require('drizzle-orm');
const { db, sqlite } = require('../db/client');
const { tasks, users, taskCollaborators } = require('../db/schema');
const requireAuth = require('../middleware/requireAuth');
const { canAssign, canView, canChangePriority } = require('../lib/rbac');
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

  // Visibility — ADMIN sees all; others see own dept, org-wide (null dept), or tasks
  // where they are an invited collaborator (cross-department access).
  if (actor.role !== 'ADMIN') {
    conditions.push(
      or(
        eq(tasks.departmentId, actor.departmentId),
        isNull(tasks.departmentId),
        sql`EXISTS (SELECT 1 FROM task_collaborators tc WHERE tc.task_id = ${tasks.id} AND tc.user_id = ${actor.id})`
      )
    );
  }

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

  if (q.overdue === 'true') {
    const today = new Date().toISOString().slice(0, 10);
    conditions.push(sql`${tasks.dueAt} IS NOT NULL`);
    conditions.push(sql`${tasks.dueAt} < ${today}`);
    conditions.push(or(
      eq(tasks.status, 'TODO'),
      eq(tasks.status, 'IN_PROGRESS'),
      eq(tasks.status, 'BLOCKED'),
    ));
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

// ── GET /api/tasks/stats ────────────────────────────────────────────────────
// Returns aggregate counts for visible tasks. Respects same visibility rules.
// Supports ?assignedToUserId=X for scope=mine.

router.get('/stats', requireAuth, (req, res) => {
  const actor = req.user;
  const q     = req.query;

  const conditions = [];

  if (actor.role !== 'ADMIN') {
    conditions.push(
      or(
        eq(tasks.departmentId, actor.departmentId),
        isNull(tasks.departmentId),
        sql`EXISTS (SELECT 1 FROM task_collaborators tc WHERE tc.task_id = ${tasks.id} AND tc.user_id = ${actor.id})`
      )
    );
  }

  if (q.assignedToUserId !== undefined) {
    const uid = parseInt(q.assignedToUserId, 10);
    if (isNaN(uid)) return res.status(400).json({ error: '"assignedToUserId" must be an integer' });
    conditions.push(eq(tasks.assignedToUserId, uid));
  }

  const base = conditions.length ? and(...conditions) : undefined;

  function countWhere(extra) {
    const w = base ? and(base, extra) : extra;
    return (db.select({ n: count() }).from(tasks).where(w).get()).n;
  }

  const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'

  return res.json({
    todo:       countWhere(eq(tasks.status, 'TODO')),
    inProgress: countWhere(eq(tasks.status, 'IN_PROGRESS')),
    blocked:    countWhere(eq(tasks.status, 'BLOCKED')),
    done:       countWhere(eq(tasks.status, 'DONE')),
    cancelled:  countWhere(eq(tasks.status, 'CANCELLED')),
    overdue:    countWhere(and(
      sql`${tasks.dueAt} IS NOT NULL`,
      sql`${tasks.dueAt} < ${today}`,
      or(
        eq(tasks.status, 'TODO'),
        eq(tasks.status, 'IN_PROGRESS'),
        eq(tasks.status, 'BLOCKED'),
      ),
    )),
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

  const taskDeptId = actor.role === 'ADMIN' ? (departmentId ?? null) : actor.departmentId;

  // Validate assignment
  if (assignedToUserId != null) {
    const assignee = db.select().from(users).where(eq(users.id, assignedToUserId)).get();
    if (!assignee) {
      return res.status(400).json({ error: `User ${assignedToUserId} not found` });
    }
    if (!assignee.isActive) {
      return res.status(400).json({ error: `User ${assignedToUserId} is inactive and cannot be assigned tasks` });
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
  const isCollaborator = task
    ? db.select({ n: count() }).from(taskCollaborators)
        .where(and(eq(taskCollaborators.taskId, taskId), eq(taskCollaborators.userId, req.user.id)))
        .get().n > 0
    : false;
  if (!task || (!canView(req.user, task) && !isCollaborator)) {
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
  const isCollabPatch = task
    ? db.select({ n: count() }).from(taskCollaborators)
        .where(and(eq(taskCollaborators.taskId, taskId), eq(taskCollaborators.userId, actor.id)))
        .get().n > 0
    : false;
  if (!task || (!canView(actor, task) && !isCollabPatch)) {
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
      if (!assignee.isActive) {
        return res.status(400).json({ error: `User ${assignedToUserId} is inactive and cannot be assigned tasks` });
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
    if (!canChangePriority(actor, task)) {
      return res.status(403).json({ error: 'Only the task creator can change priority' });
    }
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

// ── GET /api/tasks/:id/collaborators ───────────────────────────────────────────
// Returns all collaborators on a task with basic user info.

router.get('/:id/collaborators', requireAuth, (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  if (isNaN(taskId)) return res.status(400).json({ error: 'Invalid task id' });

  const task = db.select().from(tasks).where(eq(tasks.id, taskId)).get();
  const isCollab = task
    ? db.select({ n: count() }).from(taskCollaborators)
        .where(and(eq(taskCollaborators.taskId, taskId), eq(taskCollaborators.userId, req.user.id)))
        .get().n > 0
    : false;
  if (!task || (!canView(req.user, task) && !isCollab)) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const rows = db.select({
    id:            taskCollaborators.id,
    userId:        taskCollaborators.userId,
    addedByUserId: taskCollaborators.addedByUserId,
    createdAt:     taskCollaborators.createdAt,
    userName:      users.name,
    userEmail:     users.email,
    userRole:      users.role,
    userDeptId:    users.departmentId,
  })
    .from(taskCollaborators)
    .leftJoin(users, eq(taskCollaborators.userId, users.id))
    .where(eq(taskCollaborators.taskId, taskId))
    .all();

  return res.json({ collaborators: rows });
});

// ── POST /api/tasks/:id/collaborators ──────────────────────────────────────────
// Invite a user to collaborate. Only task creator, ADMIN, or SUPER may invite.

router.post('/:id/collaborators', requireAuth, (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  if (isNaN(taskId)) return res.status(400).json({ error: 'Invalid task id' });

  const parsed = z.object({ userId: z.number().int().positive() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { userId } = parsed.data;
  const actor = req.user;

  const task = db.select().from(tasks).where(eq(tasks.id, taskId)).get();
  if (!task || !canView(actor, task)) {
    return res.status(404).json({ error: 'Task not found' });
  }

  // Only creator, ADMIN, or SUPER can manage collaborators
  const canManage = actor.role === 'ADMIN' || actor.role === 'SUPER' || task.createdByUserId === actor.id;
  if (!canManage) {
    return res.status(403).json({ error: 'Only the task creator or an admin can invite collaborators' });
  }

  // Target user must exist and be active
  const target = db.select().from(users).where(eq(users.id, userId)).get();
  if (!target) return res.status(400).json({ error: `User ${userId} not found` });
  if (!target.isActive) return res.status(400).json({ error: `User ${userId} is inactive` });

  // Prevent adding the primary assignee or creator as a collaborator (they already have access)
  // — we allow it silently rather than erroring, to keep UX simple

  // Upsert-safe: check for existing record
  const existing = db.select({ n: count() }).from(taskCollaborators)
    .where(and(eq(taskCollaborators.taskId, taskId), eq(taskCollaborators.userId, userId)))
    .get().n;
  if (existing > 0) {
    return res.status(409).json({ error: 'User is already a collaborator on this task' });
  }

  const addWithAudit = sqlite.transaction(() => {
    const row = db.insert(taskCollaborators).values({
      taskId,
      userId,
      addedByUserId: actor.id,
    }).returning().get();

    writeAuditLog({
      actorUserId:  actor.id,
      action:       AUDIT_ACTIONS.TASK_COLLABORATOR_ADDED,
      entityType:   'TASK',
      entityId:     taskId,
      departmentId: task.departmentId,
      after:        { collaboratorUserId: userId, collaboratorName: target.name },
    });

    return row;
  });

  return res.status(201).json({ collaborator: addWithAudit() });
});

// ── DELETE /api/tasks/:id/collaborators/:userId ────────────────────────────────
// Remove a collaborator. Creator, ADMIN, SUPER, or the collaborator themselves.

router.delete('/:id/collaborators/:userId', requireAuth, (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(taskId) || isNaN(userId)) return res.status(400).json({ error: 'Invalid id' });

  const actor = req.user;

  const task = db.select().from(tasks).where(eq(tasks.id, taskId)).get();
  if (!task || !canView(actor, task)) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const canManage =
    actor.role === 'ADMIN' ||
    actor.role === 'SUPER' ||
    task.createdByUserId === actor.id ||
    actor.id === userId; // collaborator may remove themselves

  if (!canManage) {
    return res.status(403).json({ error: 'You cannot remove this collaborator' });
  }

  const existing = db.select({ n: count() }).from(taskCollaborators)
    .where(and(eq(taskCollaborators.taskId, taskId), eq(taskCollaborators.userId, userId)))
    .get().n;
  if (existing === 0) {
    return res.status(404).json({ error: 'Collaborator not found on this task' });
  }

  const removeWithAudit = sqlite.transaction(() => {
    db.delete(taskCollaborators)
      .where(and(eq(taskCollaborators.taskId, taskId), eq(taskCollaborators.userId, userId)))
      .run();

    writeAuditLog({
      actorUserId:  actor.id,
      action:       AUDIT_ACTIONS.TASK_COLLABORATOR_REMOVED,
      entityType:   'TASK',
      entityId:     taskId,
      departmentId: task.departmentId,
      before:       { collaboratorUserId: userId },
    });
  });

  removeWithAudit();
  return res.status(204).end();
});

// DELETE task — not yet implemented
router.delete('/:id', requireAuth, (_req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

module.exports = router;
