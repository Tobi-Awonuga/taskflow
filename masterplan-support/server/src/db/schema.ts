import {
  pgTable,
  serial,
  text,
  varchar,
  boolean,
  timestamp,
  integer,
  real,
  unique,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  password: text('password').notNull(),
  role: varchar('role', { length: 50 }).notNull(), // admin | approver | qa | warehouse | production | shipping | viewer
  department: varchar('department', { length: 100 }).notNull(), // purchasing | qa | warehouse | production | shipping | management | it
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  itemRequests: many(itemRequests),
  approvals: many(approvals),
  qaChecklists: many(qaChecklists),
  fgReleases: many(fgReleases),
  auditLogs: many(auditLogs),
  sopAcknowledgements: many(sopAcknowledgements),
  labelApprovals: many(labelApprovals),
}));

// ─────────────────────────────────────────────
// ITEM CREATION REQUEST & APPROVAL WORKFLOW
// ─────────────────────────────────────────────

export const itemRequests = pgTable('item_requests', {
  id: serial('id').primaryKey(),
  requestNumber: varchar('request_number', { length: 50 }).notNull().unique(), // ITM-2024-0001
  requesterId: integer('requester_id').notNull().references(() => users.id),

  // Item details
  proposedCode: varchar('proposed_code', { length: 100 }).notNull(),
  proposedName: text('proposed_name').notNull(),
  itemType: varchar('item_type', { length: 50 }).notNull(), // raw_material | packaging | finished_good | consumable | other
  category: varchar('category', { length: 100 }).notNull(),
  uom: varchar('uom', { length: 20 }).notNull(),
  supplier: varchar('supplier', { length: 255 }),
  supplierCode: varchar('supplier_code', { length: 100 }),
  estimatedCost: varchar('estimated_cost', { length: 50 }),
  allergenFlags: text('allergen_flags').notNull().default('[]'), // JSON array
  storageLocation: varchar('storage_location', { length: 255 }),
  shelfLife: varchar('shelf_life', { length: 100 }),
  certifications: varchar('certifications', { length: 255 }),

  // Justification
  businessReason: text('business_reason').notNull(),
  urgency: varchar('urgency', { length: 20 }).notNull().default('routine'), // routine | urgent | critical
  neededByDate: timestamp('needed_by_date'),

  // Status
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  // pending | under_review | approved | rejected | cancelled | created_in_erp

  // Post-approval
  masterplanCode: varchar('masterplan_code', { length: 100 }),
  approvedTemplate: text('approved_template'), // JSON

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const itemRequestsRelations = relations(itemRequests, ({ one, many }) => ({
  requester: one(users, { fields: [itemRequests.requesterId], references: [users.id] }),
  approvals: many(approvals),
}));

export const approvals = pgTable('approvals', {
  id: serial('id').primaryKey(),
  itemRequestId: integer('item_request_id').notNull().references(() => itemRequests.id),
  approverId: integer('approver_id').notNull().references(() => users.id),
  decision: varchar('decision', { length: 20 }).notNull(), // approved | rejected | needs_info
  comments: text('comments'),
  round: integer('round').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const approvalsRelations = relations(approvals, ({ one }) => ({
  itemRequest: one(itemRequests, { fields: [approvals.itemRequestId], references: [itemRequests.id] }),
  approver: one(users, { fields: [approvals.approverId], references: [users.id] }),
}));

// ─────────────────────────────────────────────
// QA RECEIVING CHECKLISTS
// ─────────────────────────────────────────────

export const qaChecklists = pgTable('qa_checklists', {
  id: serial('id').primaryKey(),
  checklistNumber: varchar('checklist_number', { length: 50 }).notNull().unique(),
  poNumber: varchar('po_number', { length: 50 }).notNull(),
  supplierName: varchar('supplier_name', { length: 255 }).notNull(),
  itemCode: varchar('item_code', { length: 100 }).notNull(),
  itemDescription: text('item_description').notNull(),
  quantityReceived: real('quantity_received').notNull(),
  uom: varchar('uom', { length: 20 }).notNull(),
  lotNumber: varchar('lot_number', { length: 100 }),
  bestByDate: timestamp('best_by_date'),
  deliveryDate: timestamp('delivery_date').notNull().defaultNow(),

  // Inspection
  temperatureAtReceipt: real('temperature_at_receipt'),
  temperatureRequired: real('temperature_required'),
  coaPresent: boolean('coa_present').notNull().default(false),
  coaMatchesLot: boolean('coa_matches_lot').notNull().default(false),
  packagingIntact: boolean('packaging_intact').notNull().default(false),
  noForeignMaterial: boolean('no_foreign_material').notNull().default(false),
  labelingCorrect: boolean('labeling_correct').notNull().default(false),
  allergenVerified: boolean('allergen_verified').notNull().default(false),
  pesticideTestRequired: boolean('pesticide_test_required').notNull().default(false),
  pesticideTestPassed: boolean('pesticide_test_passed'),

  // Overall
  disposition: varchar('disposition', { length: 50 }).notNull(), // accepted | rejected | conditional_accept | on_hold
  holdReason: text('hold_reason'),
  notes: text('notes'),

  // QA sign-off
  qaUserId: integer('qa_user_id').notNull().references(() => users.id),
  signedOffAt: timestamp('signed_off_at'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const qaChecklistsRelations = relations(qaChecklists, ({ one }) => ({
  qaUser: one(users, { fields: [qaChecklists.qaUserId], references: [users.id] }),
}));

// ─────────────────────────────────────────────
// FINISHED GOODS RELEASE
// ─────────────────────────────────────────────

export const fgReleases = pgTable('fg_releases', {
  id: serial('id').primaryKey(),
  releaseNumber: varchar('release_number', { length: 50 }).notNull().unique(),
  productionOrderNum: varchar('production_order_num', { length: 100 }).notNull(),
  itemCode: varchar('item_code', { length: 100 }).notNull(),
  itemDescription: text('item_description').notNull(),
  lotNumber: varchar('lot_number', { length: 100 }).notNull(),
  quantityProduced: real('quantity_produced').notNull(),
  uom: varchar('uom', { length: 20 }).notNull(),
  productionDate: timestamp('production_date').notNull(),

  // QA test results
  weightCheck: boolean('weight_check').notNull().default(false),
  metalDetectorPass: boolean('metal_detector_pass').notNull().default(false),
  visualInspection: boolean('visual_inspection').notNull().default(false),
  labResultsPass: boolean('lab_results_pass'),
  allergenSwabPass: boolean('allergen_swab_pass'),
  microTestPass: boolean('micro_test_pass'),
  labNotes: text('lab_notes'),

  // Status
  status: varchar('status', { length: 50 }).notNull().default('pending_qa'),
  // pending_qa | on_hold | released | rejected | destroyed
  holdReason: text('hold_reason'),
  releaseComments: text('release_comments'),

  qaUserId: integer('qa_user_id').notNull().references(() => users.id),
  releasedAt: timestamp('released_at'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const fgReleasesRelations = relations(fgReleases, ({ one }) => ({
  qaUser: one(users, { fields: [fgReleases.qaUserId], references: [users.id] }),
}));

// ─────────────────────────────────────────────
// SOP / TRAINING PORTAL
// ─────────────────────────────────────────────

export const sopDocuments = pgTable('sop_documents', {
  id: serial('id').primaryKey(),
  docNumber: varchar('doc_number', { length: 50 }).notNull().unique(),
  title: varchar('title', { length: 255 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  department: varchar('department', { length: 100 }).notNull(),
  content: text('content').notNull(),
  version: varchar('version', { length: 20 }).notNull().default('1.0'),
  effectiveDate: timestamp('effective_date').notNull(),
  reviewDate: timestamp('review_date'),
  approvedBy: varchar('approved_by', { length: 255 }),
  active: boolean('active').notNull().default(true),
  filePath: varchar('file_path', { length: 500 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const sopDocumentsRelations = relations(sopDocuments, ({ many }) => ({
  acknowledgements: many(sopAcknowledgements),
}));

export const sopAcknowledgements = pgTable('sop_acknowledgements', {
  id: serial('id').primaryKey(),
  sopId: integer('sop_id').notNull().references(() => sopDocuments.id),
  userId: integer('user_id').notNull().references(() => users.id),
  version: varchar('version', { length: 20 }).notNull(),
  acknowledgedAt: timestamp('acknowledged_at').notNull().defaultNow(),
}, (t) => ({
  uniq: unique().on(t.sopId, t.userId, t.version),
}));

export const sopAcknowledgementsRelations = relations(sopAcknowledgements, ({ one }) => ({
  sop: one(sopDocuments, { fields: [sopAcknowledgements.sopId], references: [sopDocuments.id] }),
  user: one(users, { fields: [sopAcknowledgements.userId], references: [users.id] }),
}));

// ─────────────────────────────────────────────
// LABEL VERSION REGISTRY
// ─────────────────────────────────────────────

export const labelVersions = pgTable('label_versions', {
  id: serial('id').primaryKey(),
  itemCode: varchar('item_code', { length: 100 }).notNull(),
  itemDescription: text('item_description').notNull(),
  labelType: varchar('label_type', { length: 50 }).notNull(), // retail | case | pallet | ingredient | inner
  version: varchar('version', { length: 20 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('draft'),
  // draft | pending_approval | approved | superseded | archived
  effectiveDate: timestamp('effective_date'),
  supersededDate: timestamp('superseded_date'),
  changeReason: text('change_reason'),
  filePath: varchar('file_path', { length: 500 }),
  allergenStatement: text('allergen_statement'),
  netWeight: varchar('net_weight', { length: 100 }),
  upcCode: varchar('upc_code', { length: 50 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const labelVersionsRelations = relations(labelVersions, ({ many }) => ({
  approvals: many(labelApprovals),
}));

export const labelApprovals = pgTable('label_approvals', {
  id: serial('id').primaryKey(),
  labelVersionId: integer('label_version_id').notNull().references(() => labelVersions.id),
  approverId: integer('approver_id').notNull().references(() => users.id),
  decision: varchar('decision', { length: 20 }).notNull(), // approved | rejected | needs_revision
  comments: text('comments'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const labelApprovalsRelations = relations(labelApprovals, ({ one }) => ({
  labelVersion: one(labelVersions, { fields: [labelApprovals.labelVersionId], references: [labelVersions.id] }),
  approver: one(users, { fields: [labelApprovals.approverId], references: [users.id] }),
}));

// ─────────────────────────────────────────────
// MASTERPLAN DATA CACHE (from exports / Playwright)
// ─────────────────────────────────────────────

export const masterplanSnapshots = pgTable('masterplan_snapshots', {
  id: serial('id').primaryKey(),
  dataType: varchar('data_type', { length: 50 }).notNull(),
  // purchase_orders | inventory | production_orders | item_master | sales_orders
  data: text('data').notNull(), // JSON blob
  source: varchar('source', { length: 50 }).notNull().default('manual_upload'),
  // manual_upload | playwright_auto
  snapshotAt: timestamp('snapshot_at').notNull().defaultNow(),
});

// ─────────────────────────────────────────────
// AUDIT LOG
// ─────────────────────────────────────────────

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  action: varchar('action', { length: 50 }).notNull(),
  // created | updated | approved | rejected | deleted | signed_off | released
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  // item_request | qa_checklist | fg_release | sop | label | user
  entityId: integer('entity_id'),
  description: text('description').notNull(),
  metadata: text('metadata'), // JSON: before/after values
  ipAddress: varchar('ip_address', { length: 50 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
}));

// ─────────────────────────────────────────────
// TYPE EXPORTS
// ─────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type ItemRequest = typeof itemRequests.$inferSelect;
export type NewItemRequest = typeof itemRequests.$inferInsert;
export type Approval = typeof approvals.$inferSelect;
export type QaChecklist = typeof qaChecklists.$inferSelect;
export type NewQaChecklist = typeof qaChecklists.$inferInsert;
export type FgRelease = typeof fgReleases.$inferSelect;
export type NewFgRelease = typeof fgReleases.$inferInsert;
export type SopDocument = typeof sopDocuments.$inferSelect;
export type LabelVersion = typeof labelVersions.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type MasterplanSnapshot = typeof masterplanSnapshots.$inferSelect;
