import { Router } from 'express';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { fgReleases, users } from '../db/schema.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';
import { nextFgReleaseNumber } from '../lib/numberGenerator.js';
import { logAudit } from '../lib/auditLogger.js';

const router = Router();
router.use(authenticate);

// GET /api/fg-releases
router.get('/', async (_req, res) => {
  const rows = await db
    .select({
      id: fgReleases.id,
      releaseNumber: fgReleases.releaseNumber,
      productionOrderNum: fgReleases.productionOrderNum,
      itemCode: fgReleases.itemCode,
      itemDescription: fgReleases.itemDescription,
      lotNumber: fgReleases.lotNumber,
      quantityProduced: fgReleases.quantityProduced,
      uom: fgReleases.uom,
      status: fgReleases.status,
      releasedAt: fgReleases.releasedAt,
      createdAt: fgReleases.createdAt,
      qaUserName: users.name,
    })
    .from(fgReleases)
    .leftJoin(users, eq(fgReleases.qaUserId, users.id))
    .orderBy(desc(fgReleases.createdAt));

  return res.json(rows);
});

// GET /api/fg-releases/:id
router.get('/:id', async (req, res) => {
  const [row] = await db
    .select()
    .from(fgReleases)
    .where(eq(fgReleases.id, parseInt(req.params.id)));

  if (!row) return res.status(404).json({ error: 'Not found' });
  return res.json(row);
});

// POST /api/fg-releases
router.post('/', requireRole('admin', 'qa', 'production'), async (req: AuthRequest, res) => {
  const body = req.body as {
    productionOrderNum: string;
    itemCode: string;
    itemDescription: string;
    lotNumber: string;
    quantityProduced: number;
    uom: string;
    productionDate: string;
  };

  const releaseNumber = await nextFgReleaseNumber();

  const [created] = await db
    .insert(fgReleases)
    .values({
      releaseNumber,
      productionOrderNum: body.productionOrderNum,
      itemCode: body.itemCode,
      itemDescription: body.itemDescription,
      lotNumber: body.lotNumber,
      quantityProduced: body.quantityProduced,
      uom: body.uom,
      productionDate: new Date(body.productionDate),
      status: 'pending_qa',
      qaUserId: req.user!.userId,
    })
    .returning();

  await logAudit({
    userId: req.user!.userId,
    action: 'created',
    entityType: 'fg_release',
    entityId: created.id,
    description: `FG release ${releaseNumber} created for production order ${body.productionOrderNum}`,
    ipAddress: req.ip,
  });

  return res.status(201).json(created);
});

// PATCH /api/fg-releases/:id/results
router.patch('/:id/results', requireRole('admin', 'qa'), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const body = req.body as {
    weightCheck?: boolean;
    metalDetectorPass?: boolean;
    visualInspection?: boolean;
    labResultsPass?: boolean;
    allergenSwabPass?: boolean;
    microTestPass?: boolean;
    labNotes?: string;
  };

  const [updated] = await db
    .update(fgReleases)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(fgReleases.id, id))
    .returning();

  if (!updated) return res.status(404).json({ error: 'Not found' });

  await logAudit({
    userId: req.user!.userId,
    action: 'updated',
    entityType: 'fg_release',
    entityId: id,
    description: `QA test results updated for FG release ${updated.releaseNumber}`,
    ipAddress: req.ip,
  });

  return res.json(updated);
});

// POST /api/fg-releases/:id/release
router.post('/:id/release', requireRole('admin', 'approver', 'qa'), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const { comments } = req.body as { comments?: string };

  const [row] = await db.select().from(fgReleases).where(eq(fgReleases.id, id));
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (row.status !== 'pending_qa' && row.status !== 'on_hold') {
    return res.status(400).json({ error: `Cannot release from status "${row.status}"` });
  }

  const [updated] = await db
    .update(fgReleases)
    .set({
      status: 'released',
      releaseComments: comments,
      releasedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(fgReleases.id, id))
    .returning();

  await logAudit({
    userId: req.user!.userId,
    action: 'released',
    entityType: 'fg_release',
    entityId: id,
    description: `FG release ${row.releaseNumber} — product RELEASED for shipping`,
    metadata: { comments },
    ipAddress: req.ip,
  });

  return res.json(updated);
});

// POST /api/fg-releases/:id/hold
router.post('/:id/hold', requireRole('admin', 'approver', 'qa'), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const { holdReason } = req.body as { holdReason: string };

  if (!holdReason) return res.status(400).json({ error: 'Hold reason is required' });

  const [row] = await db.select().from(fgReleases).where(eq(fgReleases.id, id));
  if (!row) return res.status(404).json({ error: 'Not found' });

  const [updated] = await db
    .update(fgReleases)
    .set({ status: 'on_hold', holdReason, updatedAt: new Date() })
    .where(eq(fgReleases.id, id))
    .returning();

  await logAudit({
    userId: req.user!.userId,
    action: 'updated',
    entityType: 'fg_release',
    entityId: id,
    description: `FG release ${row.releaseNumber} placed ON HOLD: ${holdReason}`,
    ipAddress: req.ip,
  });

  return res.json(updated);
});

export default router;
