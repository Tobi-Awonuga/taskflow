import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db } from './index.js';
import {
  users,
  itemRequests,
  qaChecklists,
  fgReleases,
  sopDocuments,
} from './schema.js';

async function main() {
  console.log('🌱 Seeding CT Bakery support layer...');

  const password = await bcrypt.hash('CTBakery2024!', 10);

  // ── Users ────────────────────────────────────────
  const [admin] = await db
    .insert(users)
    .values({
      email: 'admin@ctbakery.com',
      name: 'System Admin',
      password,
      role: 'admin',
      department: 'it',
    })
    .onConflictDoNothing()
    .returning();

  const [qaManager] = await db
    .insert(users)
    .values({
      email: 'qa.manager@ctbakery.com',
      name: 'QA Manager',
      password,
      role: 'approver',
      department: 'qa',
    })
    .onConflictDoNothing()
    .returning();

  const [purchasingManager] = await db
    .insert(users)
    .values({
      email: 'purchasing@ctbakery.com',
      name: 'Purchasing Manager',
      password,
      role: 'approver',
      department: 'purchasing',
    })
    .onConflictDoNothing()
    .returning();

  const [warehouseLead] = await db
    .insert(users)
    .values({
      email: 'warehouse@ctbakery.com',
      name: 'Warehouse Lead',
      password,
      role: 'warehouse',
      department: 'warehouse',
    })
    .onConflictDoNothing()
    .returning();

  await db
    .insert(users)
    .values({
      email: 'production@ctbakery.com',
      name: 'Production Supervisor',
      password,
      role: 'production',
      department: 'production',
    })
    .onConflictDoNothing();

  const [qaInspector] = await db
    .insert(users)
    .values({
      email: 'qa.inspector@ctbakery.com',
      name: 'QA Inspector',
      password,
      role: 'qa',
      department: 'qa',
    })
    .onConflictDoNothing()
    .returning();

  await db
    .insert(users)
    .values({
      email: 'shipping@ctbakery.com',
      name: 'Shipping Clerk',
      password,
      role: 'shipping',
      department: 'shipping',
    })
    .onConflictDoNothing();

  console.log('  ✓ Users');

  // ── SOPs ────────────────────────────────────────
  await db
    .insert(sopDocuments)
    .values([
      {
        docNumber: 'SOP-WH-001',
        title: 'Raw Material Receiving Procedure',
        category: 'warehouse',
        department: 'warehouse',
        version: '2.1',
        effectiveDate: new Date('2024-01-15'),
        reviewDate: new Date('2025-01-15'),
        approvedBy: 'QA Manager',
        content: `# Raw Material Receiving Procedure

## Purpose
Ensure all raw materials are received, inspected, and stored per CT Bakery quality and food safety standards.

## Steps

### 1. Pre-Receiving
- Obtain open PO list from Masterplan or Purchasing.
- Verify delivery appointment.
- Prepare: thermometer, clipboard, QA checklist.

### 2. Driver Check-In
- Record driver name, carrier, trailer number.
- Inspect trailer: temperature (if cold chain), cleanliness, odors.
- If trailer fails → contact QA Manager before unloading.

### 3. Inspection
- Complete QA Receiving Checklist in the Support Layer portal.
- Check temperature vs. spec.
- Verify CoA present and matches lot number.
- Inspect packaging: no tears, moisture, pest signs.
- Confirm allergen labeling matches expected material.

### 4. QA Sign-Off
- QA Inspector completes and signs the digital checklist.
- ACCEPTED → Warehouse receives in Masterplan.
- REJECTED → Tag "DO NOT USE — QA HOLD", move to hold area. Contact QA Manager within 2 hours.

### 5. Putaway
- Complete Masterplan receiving transaction.
- Store per temperature + allergen segregation.
- FIFO: new stock behind existing stock.

## Records
- Digital checklist (Support Layer) — 3 years
- CoA on file — 3 years`,
      },
      {
        docNumber: 'SOP-QA-001',
        title: 'New Item Request Procedure',
        category: 'qa',
        department: 'qa',
        version: '1.0',
        effectiveDate: new Date('2024-03-01'),
        approvedBy: 'QA Manager',
        content: `# New Item Request Procedure

## Purpose
Control creation of new items in Masterplan ERP to ensure consistent naming, categorization, and documentation.

## Why This Matters
Uncontrolled item creation causes: duplicate items, UOM errors, missing allergen flags, and GL code issues.

## Naming Convention
Format: [TYPE]-[CATEGORY]-[DESCRIPTION]
- RM-FLOUR-ALL-PURPOSE-50LB
- PKG-CARTON-12OZ-RETAIL
- FG-BREAD-SANDWICH-WHITE-24OZ

## Steps

### 1. Check for Existing Item
Search Masterplan with multiple terms. Only request a new item if none suitable exists.

### 2. Submit Request
Portal → Item Requests → New Request.
Fill: proposed name, type/category, UOM, supplier, allergen flags, justification.

### 3. Approval
Reviewed by QA Manager and Purchasing Manager.
- Routine: 2 business days
- Urgent: same day

### 4. Item Creation
Once approved, you receive:
- Standardized name, UOM, category template
- Instructions to create in Masterplan exactly as specified

### 5. Confirmation
After creating in Masterplan, update the request with the actual item code.`,
      },
      {
        docNumber: 'SOP-QA-002',
        title: 'Finished Goods Hold & Release Procedure',
        category: 'qa',
        department: 'qa',
        version: '1.0',
        effectiveDate: new Date('2024-03-01'),
        approvedBy: 'QA Manager',
        content: `# Finished Goods Hold & Release Procedure

## Purpose
Ensure all finished goods undergo QA review before transfer to shipping.

## Steps

### 1. Production Close
Production Supervisor creates an FG Release record in the Support Layer portal when closing the production order in Masterplan.

### 2. QA Inspection
QA Inspector completes:
- Weight check (sample)
- Metal detector test
- Visual inspection (packaging, labeling, seal)
- Allergen swab (if applicable)
- Micro test (if applicable — allow 24–72 hours)

### 3. Release Decision

RELEASED: Status updated → Shipping authorized to move in Masterplan.

ON HOLD: Physically tag product. Document reason. Disposition within 24 hours.

REJECTED: Tag for destruction/return. Initiate non-conformance report. Root cause investigation required.

## Records
- FG Release record — 3 years
- Lab results attached — 3 years`,
      },
    ])
    .onConflictDoNothing();

  console.log('  ✓ SOPs');

  // ── Sample item request ──────────────────────────
  if (warehouseLead) {
    await db
      .insert(itemRequests)
      .values({
        requestNumber: 'ITM-2024-0001',
        requesterId: warehouseLead.id,
        proposedCode: 'RM-FLOUR-BREAD-50LB',
        proposedName: 'RM-FLOUR-BREAD-50LB — Bread Flour, 50 lb bag',
        itemType: 'raw_material',
        category: 'Flour & Grains',
        uom: 'BAG',
        supplier: 'General Mills',
        supplierCode: 'GM-BF50',
        estimatedCost: '22.50',
        allergenFlags: JSON.stringify(['wheat']),
        storageLocation: 'Dry Storage — Bay A',
        shelfLife: '6 months',
        businessReason:
          'New bread line launching Q2. Current flour items are AP flour only; need bread flour with higher protein content.',
        urgency: 'urgent',
        status: 'pending',
      })
      .onConflictDoNothing();

    console.log('  ✓ Sample item request');
  }

  // ── Sample QA checklist ──────────────────────────
  const qaUserId = qaInspector?.id ?? qaManager?.id;
  if (qaUserId) {
    await db
      .insert(qaChecklists)
      .values({
        checklistNumber: 'RCV-2024-0001',
        poNumber: 'PO-10042',
        supplierName: 'Allied Packaging Co.',
        itemCode: 'PKG-CARTON-12OZ',
        itemDescription: 'Retail Carton, 12oz, Printed',
        quantityReceived: 5000,
        uom: 'EA',
        lotNumber: 'APC-240315-A',
        deliveryDate: new Date(),
        temperatureAtReceipt: 68,
        coaPresent: true,
        coaMatchesLot: true,
        packagingIntact: true,
        noForeignMaterial: true,
        labelingCorrect: true,
        allergenVerified: false,
        pesticideTestRequired: false,
        disposition: 'accepted',
        qaUserId,
        signedOffAt: new Date(),
      })
      .onConflictDoNothing();

    console.log('  ✓ Sample QA checklist');
  }

  // ── Sample FG release ────────────────────────────
  const fgQaUserId = qaManager?.id ?? qaInspector?.id;
  if (fgQaUserId) {
    await db
      .insert(fgReleases)
      .values({
        releaseNumber: 'FGR-2024-0001',
        productionOrderNum: 'PRD-10087',
        itemCode: 'FG-MUFFIN-BLUEBERRY-4PK',
        itemDescription: 'Blueberry Muffin 4-Pack, Retail',
        lotNumber: 'PRD-240320-001',
        quantityProduced: 1200,
        uom: 'CS',
        productionDate: new Date(),
        weightCheck: true,
        metalDetectorPass: true,
        visualInspection: true,
        status: 'pending_qa',
        qaUserId: fgQaUserId,
      })
      .onConflictDoNothing();

    console.log('  ✓ Sample FG release');
  }

  console.log('\n✅ Seed complete!');
  console.log('\nDev credentials (password: CTBakery2024!):');
  const accounts = [
    ['admin@ctbakery.com', 'System Admin'],
    ['qa.manager@ctbakery.com', 'QA Manager (approver)'],
    ['purchasing@ctbakery.com', 'Purchasing Manager (approver)'],
    ['warehouse@ctbakery.com', 'Warehouse Lead'],
    ['production@ctbakery.com', 'Production Supervisor'],
    ['qa.inspector@ctbakery.com', 'QA Inspector'],
    ['shipping@ctbakery.com', 'Shipping Clerk'],
  ];
  for (const [email, label] of accounts) {
    console.log(`  ${email.padEnd(35)} ${label}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
