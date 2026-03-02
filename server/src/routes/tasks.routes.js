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

// TODO: POST   /api/tasks        – create task
router.post('/', requireAuth, (req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

// TODO: GET    /api/tasks/:id    – get single task
router.get('/:id', requireAuth, (req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

// PATCH /api/tasks/:id
// Handles status transitions and assignment changes with full Model B enforcement.
// Body fields (at least one required):
//   status            – string
//   assignedToUserId  – integer user id, or null to unassign
router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    if (isNaN(taskId)) {
      return res.status(400).json({ error: 'Invalid task id' });
    }

    let { status, assignedToUserId } = req.body;

    if (status === undefined && assignedToUserId === undefined) {
      return res.status(400).json({ error: 'Provide at least one field to update: status, assignedToUserId' });
    }

    // ── Input normalisation ──────────────────────────────────────────────────

    if (status !== undefined && typeof status !== 'string') {
      return res.status(400).json({ error: '"status" must be a string' });
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
      Object.assign(updates, result.updates); // completedAt side-effect
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
