const { Router } = require('express');
const prisma = require('../db');
const requireAuth = require('../middleware/requireAuth');
const { validateStatusTransition, validateAssignment } = require('../lib/taskValidation');

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const { role, departmentId } = req.user;

    const where = role === 'ADMIN'
      ? {}
      : { departmentId };

    const tasks = await prisma.task.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const actor = req.user;
    const { departmentId, id: createdByUserId } = actor;

    // ── Input normalisation ──────────────────────────────────────────────────

    const title = typeof req.body.title === 'string' ? req.body.title.trim() : undefined;
    if (!title) {
      return res.status(400).json({ error: '"title" is required and must be a non-empty string' });
    }

    const description = typeof req.body.description === 'string' ? req.body.description : '';

    const VALID_PRIORITIES = new Set(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
    const priority = req.body.priority !== undefined ? req.body.priority : 'MEDIUM';
    if (!VALID_PRIORITIES.has(priority)) {
      return res.status(400).json({ error: `"priority" must be one of: ${[...VALID_PRIORITIES].join(', ')}` });
    }

    const VALID_STATUSES = new Set(['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED']);
    const desiredStatus = req.body.status !== undefined ? req.body.status : 'TODO';
    if (!VALID_STATUSES.has(desiredStatus)) {
      return res.status(400).json({ error: `"status" must be one of: ${[...VALID_STATUSES].join(', ')}` });
    }

    let dueAt = undefined;
    if (req.body.dueAt !== undefined) {
      const d = new Date(req.body.dueAt);
      if (isNaN(d.getTime())) {
        return res.status(400).json({ error: '"dueAt" must be a valid ISO date string' });
      }
      dueAt = d;
    }

    let assignedToUserId = null;
    let newAssignee = null;
    if (req.body.assignedToUserId !== undefined && req.body.assignedToUserId !== null) {
      assignedToUserId = parseInt(req.body.assignedToUserId, 10);
      if (isNaN(assignedToUserId)) {
        return res.status(400).json({ error: '"assignedToUserId" must be an integer or null' });
      }
      newAssignee = await prisma.user.findUnique({ where: { id: assignedToUserId } });
      if (!newAssignee) {
        return res.status(400).json({ error: `User ${assignedToUserId} not found` });
      }
    }

    // ── Validate assignment ──────────────────────────────────────────────────
    // taskLike represents what the task will look like on creation.
    const taskLike = {
      departmentId,
      createdByUserId,
      assignedToUserId,
      status: 'TODO',
    };

    if (newAssignee !== null) {
      const assignResult = validateAssignment(taskLike, newAssignee, actor);
      if (!assignResult.ok) {
        return res.status(assignResult.status).json({ error: assignResult.error });
      }
    }

    // ── Validate status (if not TODO) ────────────────────────────────────────
    let completedAt = undefined;
    if (desiredStatus !== 'TODO') {
      const effectiveTaskLike = { ...taskLike, assignedToUserId };
      const statusResult = validateStatusTransition('TODO', desiredStatus, actor, effectiveTaskLike);
      if (!statusResult.ok) {
        return res.status(statusResult.status).json({ error: statusResult.error });
      }
      if (statusResult.updates && statusResult.updates.completedAt !== undefined) {
        completedAt = statusResult.updates.completedAt;
      }
    }

    // ── Create task ──────────────────────────────────────────────────────────
    const task = await prisma.task.create({
      data: {
        title,
        description,
        priority,
        status: desiredStatus,
        departmentId,
        createdByUserId,
        assignedToUserId,
        ...(dueAt !== undefined && { dueAt }),
        ...(completedAt !== undefined && { completedAt }),
      },
    });

    return res.status(201).json(task);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    if (isNaN(taskId)) {
      return res.status(400).json({ error: 'Invalid task id' });
    }

    const task = await prisma.task.findUnique({ where: { id: taskId } });

    // Not found (or not visible) should look the same to avoid leaking existence
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const { role, departmentId } = req.user;

    // Visibility enforcement: ADMIN sees all; others only own department
    if (role !== 'ADMIN' && task.departmentId !== departmentId) {
      return res.status(404).json({ error: 'Task not found' });
    }

    return res.json(task);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// PATCH /api/tasks/:id
// Handles status transitions and assignment changes with full Model B enforcement.
// Body fields (at least one required):
//   status            – string
//   assignedToUserId  – integer user id, or null to unassign
//   cancelReason      – string (only accepted when status === "CANCELLED")
router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    if (isNaN(taskId)) {
      return res.status(400).json({ error: 'Invalid task id' });
    }

    let { status, assignedToUserId, cancelReason } = req.body;

    if (status === undefined && assignedToUserId === undefined) {
      return res.status(400).json({ error: 'Provide at least one field to update: status, assignedToUserId' });
    }

    // ── Input normalisation ──────────────────────────────────────────────────

    if (status !== undefined && typeof status !== 'string') {
      return res.status(400).json({ error: '"status" must be a string' });
    }

    // cancelReason is only valid alongside status: CANCELLED
    if (cancelReason !== undefined && status !== 'CANCELLED') {
      return res.status(400).json({ error: '"cancelReason" is only accepted when setting status to "CANCELLED"' });
    }

    if (assignedToUserId !== undefined && assignedToUserId !== null) {
      const parsed = parseInt(assignedToUserId, 10);
      if (isNaN(parsed)) {
        return res.status(400).json({ error: '"assignedToUserId" must be an integer or null' });
      }
      assignedToUserId = parsed;
    }

    // ── Load task ────────────────────────────────────────────────────────────

    const actor = req.user; // populated by requireAuth

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const updates = {};

    // ── 1. Validate assignment change first ──────────────────────────────────
    // Processed before status so a same-request assign+transition sees the new assignee.
    if (assignedToUserId !== undefined) {
      let newAssignee = null;
      if (assignedToUserId !== null) {
        newAssignee = await prisma.user.findUnique({ where: { id: assignedToUserId } });
        if (!newAssignee) {
          return res.status(400).json({ error: `User ${assignedToUserId} not found` });
        }
      }

      const result = validateAssignment(task, newAssignee, actor);
      if (!result.ok) {
        return res.status(result.status).json({ error: result.error });
      }

      updates.assignedToUserId = assignedToUserId; // null = unassign
    }

    // ── 2. Validate status transition ────────────────────────────────────────
    // effectiveTask reflects any assignment change made in the same request,
    // so e.g. { assignedToUserId: X, status: "IN_PROGRESS" } works in one call.
    if (status !== undefined) {
      const effectiveTask = 'assignedToUserId' in updates
        ? { ...task, assignedToUserId: updates.assignedToUserId }
        : task;

      const result = validateStatusTransition(task.status, status, actor, effectiveTask);
      if (!result.ok) {
        return res.status(result.status).json({ error: result.error });
      }

      updates.status = status;
      Object.assign(updates, result.updates); // cancelledAt / cancelledByUserId / completedAt side-effects

      // Persist cancelReason only when cancelling and the field was explicitly provided
      if (status === 'CANCELLED' && cancelReason !== undefined) {
        const trimmed = typeof cancelReason === 'string' ? cancelReason.trim() : '';
        updates.cancelReason = trimmed.length ? trimmed : null;
      }
    }

    const updated = await prisma.task.update({ where: { id: taskId }, data: updates });
    return res.json(updated);

  } catch (err) {
    next(err);
  }
});

// TODO: DELETE /api/tasks/:id    – delete task
router.delete('/:id', requireAuth, (req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

module.exports = router;
