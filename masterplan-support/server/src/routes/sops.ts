import { Router } from 'express';
import { eq, desc, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { sopDocuments, sopAcknowledgements, users } from '../db/schema.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';
import { logAudit } from '../lib/auditLogger.js';

const router = Router();
router.use(authenticate);

// GET /api/sops
router.get('/', async (req: AuthRequest, res) => {
  const { category, department } = req.query as Record<string, string>;

  const rows = await db
    .select()
    .from(sopDocuments)
    .where(eq(sopDocuments.active, true))
    .orderBy(desc(sopDocuments.updatedAt));

  let filtered = rows;
  if (category) filtered = filtered.filter((r) => r.category === category);
  if (department) filtered = filtered.filter((r) => r.department === department);

  return res.json(filtered);
});

// GET /api/sops/:id
router.get('/:id', async (req: AuthRequest, res) => {
  const [sop] = await db
    .select()
    .from(sopDocuments)
    .where(eq(sopDocuments.id, parseInt(req.params.id)));

  if (!sop) return res.status(404).json({ error: 'Not found' });

  // Check if current user has acknowledged this version
  const [ack] = await db
    .select()
    .from(sopAcknowledgements)
    .where(
      and(
        eq(sopAcknowledgements.sopId, sop.id),
        eq(sopAcknowledgements.userId, req.user!.userId),
        eq(sopAcknowledgements.version, sop.version)
      )
    );

  return res.json({ ...sop, acknowledgedByMe: !!ack, myAcknowledgement: ack ?? null });
});

// POST /api/sops
router.post('/', requireRole('admin', 'approver'), async (req: AuthRequest, res) => {
  const body = req.body as {
    docNumber: string;
    title: string;
    category: string;
    department: string;
    content: string;
    version?: string;
    effectiveDate: string;
    reviewDate?: string;
    approvedBy?: string;
  };

  const [created] = await db
    .insert(sopDocuments)
    .values({
      docNumber: body.docNumber,
      title: body.title,
      category: body.category,
      department: body.department,
      content: body.content,
      version: body.version ?? '1.0',
      effectiveDate: new Date(body.effectiveDate),
      reviewDate: body.reviewDate ? new Date(body.reviewDate) : undefined,
      approvedBy: body.approvedBy,
    })
    .returning();

  await logAudit({
    userId: req.user!.userId,
    action: 'created',
    entityType: 'sop',
    entityId: created.id,
    description: `SOP ${body.docNumber} "${body.title}" created`,
    ipAddress: req.ip,
  });

  return res.status(201).json(created);
});

// POST /api/sops/:id/acknowledge
router.post('/:id/acknowledge', async (req: AuthRequest, res) => {
  const sopId = parseInt(req.params.id);
  const [sop] = await db.select().from(sopDocuments).where(eq(sopDocuments.id, sopId));
  if (!sop) return res.status(404).json({ error: 'Not found' });

  await db
    .insert(sopAcknowledgements)
    .values({
      sopId,
      userId: req.user!.userId,
      version: sop.version,
    })
    .onConflictDoNothing();

  await logAudit({
    userId: req.user!.userId,
    action: 'signed_off',
    entityType: 'sop',
    entityId: sopId,
    description: `User acknowledged SOP ${sop.docNumber} v${sop.version}`,
    ipAddress: req.ip,
  });

  return res.json({ acknowledged: true, version: sop.version });
});

// GET /api/sops/:id/acknowledgements
router.get('/:id/acknowledgements', requireRole('admin', 'approver'), async (req, res) => {
  const sopId = parseInt(req.params.id);

  const rows = await db
    .select({
      id: sopAcknowledgements.id,
      version: sopAcknowledgements.version,
      acknowledgedAt: sopAcknowledgements.acknowledgedAt,
      userName: users.name,
      userEmail: users.email,
      userDept: users.department,
    })
    .from(sopAcknowledgements)
    .leftJoin(users, eq(sopAcknowledgements.userId, users.id))
    .where(eq(sopAcknowledgements.sopId, sopId))
    .orderBy(desc(sopAcknowledgements.acknowledgedAt));

  return res.json(rows);
});

export default router;
