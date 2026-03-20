import { Router } from 'express';
import { eq, desc, or, ilike } from 'drizzle-orm';
import { db } from '../db/index.js';
import { itemRequests, approvals, users } from '../db/schema.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';
import { nextItemRequestNumber } from '../lib/numberGenerator.js';
import { logAudit } from '../lib/auditLogger.js';

const router = Router();

// ── PUBLIC: Extension validation endpoint ─────────────────────────────────
// Called by the browser extension — no auth required.
// Returns approved request details only if status === 'approved'.
// Used by the extension to validate a request number before allowing item creation.
router.get('/validate/:requestNumber', async (req, res) => {
  const { requestNumber } = req.params;

  const [request] = await db
    .select()
    .from(itemRequests)
    .where(eq(itemRequests.requestNumber, requestNumber.toUpperCase()));

  if (!request) {
    return res.status(404).json({ error: `No request found with number "${requestNumber}"` });
  }

  if (request.status !== 'approved') {
    const messages: Record<string, string> = {
      pending:        'This request is still pending approval.',
      under_review:   'This request is under review.',
      rejected:       'This request was rejected and cannot be used.',
      cancelled:      'This request has been cancelled.',
      created_in_erp: 'This request has already been used to create an item.',
    };
    return res.status(400).json({
      error: messages[request.status] ?? `Request status is "${request.status}" — must be "approved" to proceed.`,
    });
  }

  // Return only the fields the extension needs to display guidance
  return res.json({
    request: {
      id:            request.id,
      requestNumber: request.requestNumber,
      proposedCode:  request.proposedCode,
      proposedName:  request.proposedName,
      itemType:      request.itemType,
      category:      request.category,
      uom:           request.uom,
      supplier:      request.supplier,
      allergenFlags: JSON.parse(request.allergenFlags || '[]'),
      storageLocation: request.storageLocation,
      businessReason:  request.businessReason,
    },
  });
});

// All routes below this line require authentication
router.use(authenticate);

// GET /api/item-requests
router.get('/', async (req: AuthRequest, res) => {
  const { status, search } = req.query as Record<string, string>;

  let query = db
    .select({
      id: itemRequests.id,
      requestNumber: itemRequests.requestNumber,
      proposedCode: itemRequests.proposedCode,
      proposedName: itemRequests.proposedName,
      itemType: itemRequests.itemType,
      category: itemRequests.category,
      urgency: itemRequests.urgency,
      status: itemRequests.status,
      createdAt: itemRequests.createdAt,
      requesterName: users.name,
      requesterEmail: users.email,
      requesterDept: users.department,
    })
    .from(itemRequests)
    .leftJoin(users, eq(itemRequests.requesterId, users.id))
    .orderBy(desc(itemRequests.createdAt))
    .$dynamic();

  // Filters applied in-memory for simplicity (acceptable at this scale)
  const rows = await query;

  let filtered = rows;
  if (status) filtered = filtered.filter((r) => r.status === status);
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.proposedName.toLowerCase().includes(s) ||
        r.proposedCode.toLowerCase().includes(s) ||
        r.requestNumber.toLowerCase().includes(s)
    );
  }

  return res.json(filtered);
});

// GET /api/item-requests/:id
router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const [request] = await db
    .select()
    .from(itemRequests)
    .where(eq(itemRequests.id, id));

  if (!request) return res.status(404).json({ error: 'Not found' });

  const requestApprovals = await db
    .select({
      id: approvals.id,
      decision: approvals.decision,
      comments: approvals.comments,
      round: approvals.round,
      createdAt: approvals.createdAt,
      approverName: users.name,
      approverRole: users.role,
    })
    .from(approvals)
    .leftJoin(users, eq(approvals.approverId, users.id))
    .where(eq(approvals.itemRequestId, id))
    .orderBy(desc(approvals.createdAt));

  return res.json({ ...request, approvals: requestApprovals });
});

// POST /api/item-requests
router.post('/', async (req: AuthRequest, res) => {
  const body = req.body as {
    proposedCode: string;
    proposedName: string;
    itemType: string;
    category: string;
    uom: string;
    supplier?: string;
    supplierCode?: string;
    estimatedCost?: string;
    allergenFlags?: string[];
    storageLocation?: string;
    shelfLife?: string;
    certifications?: string;
    businessReason: string;
    urgency?: string;
    neededByDate?: string;
  };

  const requestNumber = await nextItemRequestNumber();

  const [created] = await db
    .insert(itemRequests)
    .values({
      requestNumber,
      requesterId: req.user!.userId,
      proposedCode: body.proposedCode,
      proposedName: body.proposedName,
      itemType: body.itemType,
      category: body.category,
      uom: body.uom,
      supplier: body.supplier,
      supplierCode: body.supplierCode,
      estimatedCost: body.estimatedCost,
      allergenFlags: JSON.stringify(body.allergenFlags ?? []),
      storageLocation: body.storageLocation,
      shelfLife: body.shelfLife,
      certifications: body.certifications,
      businessReason: body.businessReason,
      urgency: body.urgency ?? 'routine',
      neededByDate: body.neededByDate ? new Date(body.neededByDate) : undefined,
      status: 'pending',
    })
    .returning();

  await logAudit({
    userId: req.user!.userId,
    action: 'created',
    entityType: 'item_request',
    entityId: created.id,
    description: `Item request ${requestNumber} submitted: ${body.proposedName}`,
    ipAddress: req.ip,
  });

  return res.status(201).json(created);
});

// POST /api/item-requests/:id/approve
router.post('/:id/approve', requireRole('admin', 'approver'), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const { comments } = req.body as { comments?: string };

  const [request] = await db.select().from(itemRequests).where(eq(itemRequests.id, id));
  if (!request) return res.status(404).json({ error: 'Not found' });
  if (!['pending', 'under_review'].includes(request.status)) {
    return res.status(400).json({ error: `Cannot approve a request with status "${request.status}"` });
  }

  await db.insert(approvals).values({
    itemRequestId: id,
    approverId: req.user!.userId,
    decision: 'approved',
    comments,
  });

  // Build the approved template for the requester
  const approvedTemplate = {
    masterplanName: request.proposedName,
    itemType: request.itemType,
    uom: request.uom,
    category: request.category,
    allergenFlags: JSON.parse(request.allergenFlags || '[]'),
    supplier: request.supplier,
    storageLocation: request.storageLocation,
    instructions: [
      'Log in to Masterplan.',
      'Navigate to Inventory → Items → New Item.',
      'Enter the approved name exactly as shown above.',
      'Set UOM, category, and allergen flags as specified.',
      'Save the item and return here to update this request with the Masterplan code.',
    ],
  };

  const [updated] = await db
    .update(itemRequests)
    .set({
      status: 'approved',
      approvedTemplate: JSON.stringify(approvedTemplate),
      updatedAt: new Date(),
    })
    .where(eq(itemRequests.id, id))
    .returning();

  await logAudit({
    userId: req.user!.userId,
    action: 'approved',
    entityType: 'item_request',
    entityId: id,
    description: `Item request ${request.requestNumber} approved`,
    metadata: { comments },
    ipAddress: req.ip,
  });

  return res.json(updated);
});

// POST /api/item-requests/:id/reject
router.post('/:id/reject', requireRole('admin', 'approver'), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const { comments } = req.body as { comments: string };

  if (!comments) return res.status(400).json({ error: 'Rejection reason is required' });

  const [request] = await db.select().from(itemRequests).where(eq(itemRequests.id, id));
  if (!request) return res.status(404).json({ error: 'Not found' });

  await db.insert(approvals).values({
    itemRequestId: id,
    approverId: req.user!.userId,
    decision: 'rejected',
    comments,
  });

  const [updated] = await db
    .update(itemRequests)
    .set({ status: 'rejected', updatedAt: new Date() })
    .where(eq(itemRequests.id, id))
    .returning();

  await logAudit({
    userId: req.user!.userId,
    action: 'rejected',
    entityType: 'item_request',
    entityId: id,
    description: `Item request ${request.requestNumber} rejected`,
    metadata: { reason: comments },
    ipAddress: req.ip,
  });

  return res.json(updated);
});

// PATCH /api/item-requests/:id/erp-code
// Requester confirms the Masterplan code after creating the item
router.patch('/:id/erp-code', async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const { masterplanCode, creationPath } = req.body as { masterplanCode: string; creationPath?: string };

  const [request] = await db.select().from(itemRequests).where(eq(itemRequests.id, id));
  if (!request) return res.status(404).json({ error: 'Not found' });
  if (request.status !== 'approved') {
    return res.status(400).json({ error: 'Request must be approved before entering Masterplan code' });
  }
  if (req.user!.userId !== request.requesterId && req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Only the requester or admin can update this field' });
  }

  const [updated] = await db
    .update(itemRequests)
    .set({ masterplanCode, status: 'created_in_erp', updatedAt: new Date() })
    .where(eq(itemRequests.id, id))
    .returning();

  await logAudit({
    userId: req.user!.userId,
    action: 'updated',
    entityType: 'item_request',
    entityId: id,
    description: `Item ${request.requestNumber} created in Masterplan as ${masterplanCode}`,
    metadata: { creationPath: creationPath ?? 'unknown' },
    ipAddress: req.ip,
  });

  return res.json(updated);
});

export default router;
