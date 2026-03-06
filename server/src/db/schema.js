/**
 * Drizzle schema — SQLite (Postgres-portable column types).
 *
 * Datetime convention: stored as ISO-8601 text "YYYY-MM-DDTHH:MM:SS.sssZ".
 * Use the now() helper in application code; SQLite default is datetime('now').
 *
 * updatedAt is set manually in every UPDATE — no trigger required.
 */

const {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} = require('drizzle-orm/sqlite-core');
const { sql } = require('drizzle-orm');

// ── departments ────────────────────────────────────────────────────────────────

const departments = sqliteTable('departments', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  name:      text('name').notNull().unique(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

// ── users ──────────────────────────────────────────────────────────────────────

const users = sqliteTable('users', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  email:        text('email').notNull().unique(),
  name:         text('name').notNull(),
  // CHECK constraint added in migration SQL; Drizzle validates at runtime via Zod
  role:         text('role').notNull().default('USER'),        // ADMIN | SUPER | USER
  passwordHash: text('password_hash').notNull(),
  departmentId: integer('department_id')
    .references(() => departments.id, { onDelete: 'set null' }),
  isActive:     integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt:    text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt:    text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  emailIdx: uniqueIndex('users_email_idx').on(t.email),
  deptIdx:  index('users_dept_idx').on(t.departmentId),
  roleIdx:  index('users_role_idx').on(t.role),
}));

// ── tasks ──────────────────────────────────────────────────────────────────────

const tasks = sqliteTable('tasks', {
  id:               integer('id').primaryKey({ autoIncrement: true }),
  title:            text('title').notNull(),
  description:      text('description'),
  status:           text('status').notNull().default('TODO'),   // TODO|IN_PROGRESS|DONE|BLOCKED|CANCELLED
  priority:         text('priority').notNull().default('MEDIUM'), // LOW|MEDIUM|HIGH|URGENT
  departmentId:     integer('department_id')
    .references(() => departments.id, { onDelete: 'set null' }),
  // RESTRICT: users are soft-deleted (isActive=false), never hard-deleted in normal ops.
  // This preserves task history. If a user must be hard-deleted, migrate tasks first.
  createdByUserId:  integer('created_by_user_id').notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  assignedToUserId: integer('assigned_to_user_id')
    .references(() => users.id, { onDelete: 'set null' }),
  dueAt:            text('due_at'),
  completedAt:      text('completed_at'),
  cancelledAt:      text('cancelled_at'),
  cancelledByUserId:integer('cancelled_by_user_id')
    .references(() => users.id, { onDelete: 'set null' }),
  cancelReason:     text('cancel_reason'),
  createdAt:        text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt:        text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  deptIdx:       index('tasks_dept_idx').on(t.departmentId),
  statusIdx:     index('tasks_status_idx').on(t.status),
  priorityIdx:   index('tasks_priority_idx').on(t.priority),
  assigneeIdx:   index('tasks_assignee_idx').on(t.assignedToUserId),
  creatorIdx:    index('tasks_creator_idx').on(t.createdByUserId),
  dueAtIdx:      index('tasks_due_at_idx').on(t.dueAt),
  deptStatusIdx: index('tasks_dept_status_idx').on(t.departmentId, t.status),
  deptAssignIdx: index('tasks_dept_assign_idx').on(t.departmentId, t.assignedToUserId),
}));

// ── sessions ───────────────────────────────────────────────────────────────────

const sessions = sqliteTable('sessions', {
  id:        text('id').primaryKey(),               // crypto.randomUUID()
  userId:    integer('user_id').notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  expiresAt: text('expires_at').notNull(),           // ISO string set at login
  revokedAt: text('revoked_at'),                     // set on logout
  ip:        text('ip'),
  userAgent: text('user_agent'),
}, (t) => ({
  userIdx:    index('sessions_user_idx').on(t.userId),
  expiresIdx: index('sessions_expires_idx').on(t.expiresAt),
}));

// ── audit_logs ─────────────────────────────────────────────────────────────────
//
// Append-only. Never UPDATE or DELETE rows here.
//
// before/after storage policy:
//   TASK_CREATED          → before=null,       after=full task snapshot
//   TASK_STATUS_CHANGED   → before={status},   after={status, completedAt?, cancelledAt?}
//   TASK_CANCELLED        → before={status},   after={status, cancelledAt, cancelledByUserId, cancelReason}
//   TASK_REOPENED         → before={status},   after={status: 'TODO'}
//   TASK_ASSIGNED         → before={assignedToUserId}, after={assignedToUserId}
//   TASK_UNASSIGNED       → before={assignedToUserId}, after={assignedToUserId: null}
//   LOGIN_SUCCESS         → before=null,       after={userId, ip}
//   LOGOUT                → before=null,       after=null

const auditLogs = sqliteTable('audit_logs', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  actorUserId: integer('actor_user_id')
    .references(() => users.id, { onDelete: 'set null' }),
  action:      text('action').notNull(),       // TASK_CREATED | TASK_STATUS_CHANGED | ...
  entityType:  text('entity_type').notNull(),  // TASK | USER | SESSION
  entityId:    integer('entity_id'),
  departmentId:integer('department_id')
    .references(() => departments.id, { onDelete: 'set null' }),
  beforeJson:  text('before_json'),
  afterJson:   text('after_json'),
  reason:      text('reason'),
  createdAt:   text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  actorIdx:  index('audit_actor_idx').on(t.actorUserId),
  entityIdx: index('audit_entity_idx').on(t.entityType, t.entityId),
  deptIdx:   index('audit_dept_idx').on(t.departmentId),
  timeIdx:   index('audit_time_idx').on(t.createdAt),
}));

// ── password_reset_tokens ──────────────────────────────────────────────────────

const passwordResetTokens = sqliteTable('password_reset_tokens', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  userId:    integer('user_id').notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token:     text('token').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  usedAt:    text('used_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  tokenIdx:  uniqueIndex('prt_token_idx').on(t.token),
  userIdx:   index('prt_user_idx').on(t.userId),
}));

// ── task_collaborators ────────────────────────────────────────────────────────
//
// Junction table: any authenticated user can be invited to collaborate on a task
// regardless of their department. Collaborators gain read + comment access.
// The task still owns a single departmentId (primary ownership).

const taskCollaborators = sqliteTable('task_collaborators', {
  id:            integer('id').primaryKey({ autoIncrement: true }),
  taskId:        integer('task_id').notNull()
    .references(() => tasks.id, { onDelete: 'cascade' }),
  userId:        integer('user_id').notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  addedByUserId: integer('added_by_user_id')
    .references(() => users.id, { onDelete: 'set null' }),
  createdAt:     text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  taskUserUniq: uniqueIndex('tc_task_user_uniq').on(t.taskId, t.userId),
  taskIdx:      index('tc_task_idx').on(t.taskId),
  userIdx:      index('tc_user_idx').on(t.userId),
}));

// ── task_comments ─────────────────────────────────────────────────────────────

const taskComments = sqliteTable('task_comments', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  taskId:    integer('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  userId:    integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  content:   text('content').notNull(),
  editedAt:  text('edited_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  taskIdx: index('comments_task_idx').on(t.taskId),
  userIdx: index('comments_user_idx').on(t.userId),
}));

module.exports = { departments, users, tasks, sessions, auditLogs, passwordResetTokens, taskComments, taskCollaborators };
