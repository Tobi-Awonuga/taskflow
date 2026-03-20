import { Router } from 'express';
import { eq, desc, and, gte, lte } from 'drizzle-orm';
import { db } from '../db/index.js';
import { auditLogs, users } from '../db/schema.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticate, requireRole('admin', 'approver'));

// GET /api/audit-logs
router.get('/', async (req, res) => {
  const { entityType, action, userId, from, to } = req.query as Record<string, string>;

  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      description: auditLogs.description,
      metadata: auditLogs.metadata,
      ipAddress: auditLogs.ipAddress,
      createdAt: auditLogs.createdAt,
      userName: users.name,
      userEmail: users.email,
      userDept: users.department,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(500);

  let filtered = rows;
  if (entityType) filtered = filtered.filter((r) => r.entityType === entityType);
  if (action) filtered = filtered.filter((r) => r.action === action);
  if (userId) filtered = filtered.filter((r) => r.userEmail?.includes(userId));
  if (from) filtered = filtered.filter((r) => new Date(r.createdAt) >= new Date(from));
  if (to) filtered = filtered.filter((r) => new Date(r.createdAt) <= new Date(to));

  return res.json(filtered);
});

export default router;
