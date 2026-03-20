import { Router } from 'express';
import { eq, desc, sql, gte } from 'drizzle-orm';
import { db } from '../db/index.js';
import { itemRequests, qaChecklists, fgReleases, auditLogs, users } from '../db/schema.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// GET /api/dashboard/stats
router.get('/stats', async (_req, res) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    itemRequestCounts,
    qaCounts,
    fgCounts,
    recentActivity,
  ] = await Promise.all([
    // Item requests by status
    db
      .select({ status: itemRequests.status, count: sql<number>`count(*)` })
      .from(itemRequests)
      .groupBy(itemRequests.status),

    // QA checklists today
    db
      .select({ count: sql<number>`count(*)` })
      .from(qaChecklists)
      .where(gte(qaChecklists.createdAt, todayStart)),

    // FG releases by status
    db
      .select({ status: fgReleases.status, count: sql<number>`count(*)` })
      .from(fgReleases)
      .groupBy(fgReleases.status),

    // Recent audit log
    db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        description: auditLogs.description,
        createdAt: auditLogs.createdAt,
        userName: users.name,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(10),
  ]);

  const itemByStatus = itemRequestCounts.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = Number(row.count);
    return acc;
  }, {});

  const fgByStatus = fgCounts.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = Number(row.count);
    return acc;
  }, {});

  return res.json({
    itemRequests: {
      pending: itemByStatus['pending'] ?? 0,
      underReview: itemByStatus['under_review'] ?? 0,
      approved: itemByStatus['approved'] ?? 0,
      rejected: itemByStatus['rejected'] ?? 0,
      createdInErp: itemByStatus['created_in_erp'] ?? 0,
    },
    qaReceiving: {
      today: Number(qaCounts[0]?.count ?? 0),
    },
    finishedGoods: {
      pendingQa: fgByStatus['pending_qa'] ?? 0,
      onHold: fgByStatus['on_hold'] ?? 0,
      released: fgByStatus['released'] ?? 0,
      rejected: fgByStatus['rejected'] ?? 0,
    },
    recentActivity,
  });
});

// GET /api/dashboard/fg-holds
router.get('/fg-holds', async (_req, res) => {
  const rows = await db
    .select()
    .from(fgReleases)
    .where(eq(fgReleases.status, 'on_hold'))
    .orderBy(desc(fgReleases.createdAt));

  return res.json(rows);
});

// GET /api/dashboard/pending-item-requests
router.get('/pending-item-requests', async (_req, res) => {
  const rows = await db
    .select({
      id: itemRequests.id,
      requestNumber: itemRequests.requestNumber,
      proposedName: itemRequests.proposedName,
      urgency: itemRequests.urgency,
      createdAt: itemRequests.createdAt,
      requesterName: users.name,
    })
    .from(itemRequests)
    .leftJoin(users, eq(itemRequests.requesterId, users.id))
    .where(eq(itemRequests.status, 'pending'))
    .orderBy(desc(itemRequests.createdAt));

  return res.json(rows);
});

export default router;
