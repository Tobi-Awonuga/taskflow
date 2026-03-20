import { Router } from 'express';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { qaChecklists, users } from '../db/schema.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';
import { nextQaChecklistNumber } from '../lib/numberGenerator.js';
import { logAudit } from '../lib/auditLogger.js';

const router = Router();
router.use(authenticate);

// GET /api/qa-checklists
router.get('/', async (_req, res) => {
  const rows = await db
    .select({
      id: qaChecklists.id,
      checklistNumber: qaChecklists.checklistNumber,
      poNumber: qaChecklists.poNumber,
      supplierName: qaChecklists.supplierName,
      itemCode: qaChecklists.itemCode,
      itemDescription: qaChecklists.itemDescription,
      lotNumber: qaChecklists.lotNumber,
      disposition: qaChecklists.disposition,
      signedOffAt: qaChecklists.signedOffAt,
      createdAt: qaChecklists.createdAt,
      qaUserName: users.name,
    })
    .from(qaChecklists)
    .leftJoin(users, eq(qaChecklists.qaUserId, users.id))
    .orderBy(desc(qaChecklists.createdAt));

  return res.json(rows);
});

// GET /api/qa-checklists/:id
router.get('/:id', async (req, res) => {
  const [row] = await db
    .select()
    .from(qaChecklists)
    .where(eq(qaChecklists.id, parseInt(req.params.id)));

  if (!row) return res.status(404).json({ error: 'Not found' });
  return res.json(row);
});

// POST /api/qa-checklists
router.post('/', requireRole('admin', 'qa', 'warehouse'), async (req: AuthRequest, res) => {
  const body = req.body as {
    poNumber: string;
    supplierName: string;
    itemCode: string;
    itemDescription: string;
    quantityReceived: number;
    uom: string;
    lotNumber?: string;
    bestByDate?: string;
    temperatureAtReceipt?: number;
    temperatureRequired?: number;
    coaPresent: boolean;
    coaMatchesLot: boolean;
    packagingIntact: boolean;
    noForeignMaterial: boolean;
    labelingCorrect: boolean;
    allergenVerified: boolean;
    pesticideTestRequired: boolean;
    pesticideTestPassed?: boolean;
    disposition: string;
    holdReason?: string;
    notes?: string;
  };

  const checklistNumber = await nextQaChecklistNumber();

  const [created] = await db
    .insert(qaChecklists)
    .values({
      checklistNumber,
      poNumber: body.poNumber,
      supplierName: body.supplierName,
      itemCode: body.itemCode,
      itemDescription: body.itemDescription,
      quantityReceived: body.quantityReceived,
      uom: body.uom,
      lotNumber: body.lotNumber,
      bestByDate: body.bestByDate ? new Date(body.bestByDate) : undefined,
      deliveryDate: new Date(),
      temperatureAtReceipt: body.temperatureAtReceipt,
      temperatureRequired: body.temperatureRequired,
      coaPresent: body.coaPresent,
      coaMatchesLot: body.coaMatchesLot,
      packagingIntact: body.packagingIntact,
      noForeignMaterial: body.noForeignMaterial,
      labelingCorrect: body.labelingCorrect,
      allergenVerified: body.allergenVerified,
      pesticideTestRequired: body.pesticideTestRequired,
      pesticideTestPassed: body.pesticideTestPassed,
      disposition: body.disposition,
      holdReason: body.holdReason,
      notes: body.notes,
      qaUserId: req.user!.userId,
      signedOffAt: body.disposition !== 'on_hold' ? new Date() : undefined,
    })
    .returning();

  await logAudit({
    userId: req.user!.userId,
    action: 'created',
    entityType: 'qa_checklist',
    entityId: created.id,
    description: `QA receiving checklist ${checklistNumber} created for PO ${body.poNumber}`,
    ipAddress: req.ip,
  });

  return res.status(201).json(created);
});

// PATCH /api/qa-checklists/:id/sign-off
router.patch('/:id/sign-off', requireRole('admin', 'qa'), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const { disposition, holdReason } = req.body as { disposition: string; holdReason?: string };

  const [updated] = await db
    .update(qaChecklists)
    .set({
      disposition,
      holdReason,
      signedOffAt: new Date(),
      qaUserId: req.user!.userId,
      updatedAt: new Date(),
    })
    .where(eq(qaChecklists.id, id))
    .returning();

  if (!updated) return res.status(404).json({ error: 'Not found' });

  await logAudit({
    userId: req.user!.userId,
    action: 'signed_off',
    entityType: 'qa_checklist',
    entityId: id,
    description: `QA receiving checklist signed off — disposition: ${disposition}`,
    ipAddress: req.ip,
  });

  return res.json(updated);
});

export default router;
