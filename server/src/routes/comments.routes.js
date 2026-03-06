'use strict';
const { Router } = require('express');
const { z }      = require('zod');
const { eq, and, count } = require('drizzle-orm');
const { db }     = require('../db/client');
const { tasks, taskComments, users, taskCollaborators } = require('../db/schema');
const requireAuth = require('../middleware/requireAuth');
const { canView } = require('../lib/rbac');
const asyncHandler = require('../utils/asyncHandler');
const { mysqlNow } = require('../utils/datetime');

const router = Router();

const commentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(5000, 'Comment cannot exceed 5000 characters'),
});

// ── GET /api/tasks/:taskId/comments ──────────────────────────────────────────

router.get('/:taskId/comments', requireAuth, asyncHandler(async (req, res) => {
  const taskId = parseInt(req.params.taskId, 10);
  if (isNaN(taskId)) return res.status(400).json({ error: 'Invalid task ID' });

  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  let isCollab = false;
  if (!canView(req.user, task)) {
    const [{ n }] = await db.select({ n: count() }).from(taskCollaborators)
      .where(and(eq(taskCollaborators.taskId, taskId), eq(taskCollaborators.userId, req.user.id)));
    isCollab = Number(n) > 0;
    if (!isCollab) return res.status(403).json({ error: 'Forbidden' });
  }

  const rows = await db
    .select({
      id:        taskComments.id,
      content:   taskComments.content,
      editedAt:  taskComments.editedAt,
      createdAt: taskComments.createdAt,
      userId:    taskComments.userId,
      userName:  users.name,
    })
    .from(taskComments)
    .leftJoin(users, eq(taskComments.userId, users.id))
    .where(eq(taskComments.taskId, taskId))
    .orderBy(taskComments.createdAt);

  const comments = rows.map(r => ({
    id:        r.id,
    content:   r.content,
    editedAt:  r.editedAt,
    createdAt: r.createdAt,
    user:      r.userId ? { id: r.userId, name: r.userName } : null,
  }));

  return res.json({ comments });
}));

// ── POST /api/tasks/:taskId/comments ─────────────────────────────────────────

router.post('/:taskId/comments', requireAuth, asyncHandler(async (req, res) => {
  const taskId = parseInt(req.params.taskId, 10);
  if (isNaN(taskId)) return res.status(400).json({ error: 'Invalid task ID' });

  const parsed = commentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  let isCollab = false;
  if (!canView(req.user, task)) {
    const [{ n }] = await db.select({ n: count() }).from(taskCollaborators)
      .where(and(eq(taskCollaborators.taskId, taskId), eq(taskCollaborators.userId, req.user.id)));
    isCollab = Number(n) > 0;
    if (!isCollab) return res.status(403).json({ error: 'Forbidden' });
  }

  const { content } = parsed.data;
  const now = mysqlNow();

  const insertResult = await db.insert(taskComments)
    .values({ taskId, userId: req.user.id, content, createdAt: now, updatedAt: now });
  const commentId = insertResult.insertId;

  // Parse @mentions and resolve to userIds
  const mentionWords = [...content.matchAll(/\B@(\w+)/g)].map(m => m[1].toLowerCase());
  let mentionedUserIds = [];
  if (mentionWords.length > 0) {
    const activeUsers = await db.select({ id: users.id, name: users.name }).from(users)
      .where(eq(users.isActive, true));
    mentionedUserIds = activeUsers
      .filter(u => mentionWords.some(w => u.name.toLowerCase().startsWith(w)))
      .map(u => u.id);
  }

  const comment = {
    id:        commentId,
    content,
    editedAt:  null,
    createdAt: now,
    user:      { id: req.user.id, name: req.user.name },
  };

  return res.status(201).json({ comment, mentionedUserIds });
}));

// ── PATCH /api/tasks/:taskId/comments/:id ────────────────────────────────────

router.patch('/:taskId/comments/:id', requireAuth, asyncHandler(async (req, res) => {
  const taskId    = parseInt(req.params.taskId, 10);
  const commentId = parseInt(req.params.id, 10);
  if (isNaN(taskId) || isNaN(commentId)) return res.status(400).json({ error: 'Invalid ID' });

  const parsed = commentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const [comment] = await db.select().from(taskComments)
    .where(and(eq(taskComments.id, commentId), eq(taskComments.taskId, taskId)))
    .limit(1);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });

  if (req.user.role !== 'ADMIN' && comment.userId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const now = mysqlNow();
  await db.update(taskComments)
    .set({ content: parsed.data.content, editedAt: now, updatedAt: now })
    .where(eq(taskComments.id, commentId));

  return res.json({
    comment: {
      id:        commentId,
      content:   parsed.data.content,
      editedAt:  now,
      createdAt: comment.createdAt,
      user:      { id: req.user.id, name: req.user.name },
    },
  });
}));

// ── DELETE /api/tasks/:taskId/comments/:id ───────────────────────────────────

router.delete('/:taskId/comments/:id', requireAuth, asyncHandler(async (req, res) => {
  const taskId    = parseInt(req.params.taskId, 10);
  const commentId = parseInt(req.params.id, 10);
  if (isNaN(taskId) || isNaN(commentId)) return res.status(400).json({ error: 'Invalid ID' });

  const [comment] = await db.select().from(taskComments)
    .where(and(eq(taskComments.id, commentId), eq(taskComments.taskId, taskId)))
    .limit(1);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });

  if (req.user.role !== 'ADMIN' && comment.userId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  await db.delete(taskComments).where(eq(taskComments.id, commentId));
  return res.json({ ok: true });
}));

module.exports = router;
