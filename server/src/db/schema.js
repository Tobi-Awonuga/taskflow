'use strict';
const {
  mysqlTable,
  serial,
  int,
  bigint,
  varchar,
  text,
  timestamp,
  datetime,
  mysqlEnum,
  tinyint,
  index,
  uniqueIndex,
} = require('drizzle-orm/mysql-core');

// ── departments ────────────────────────────────────────────────────────────────

const departments = mysqlTable('departments', {
  id:        serial('id').primaryKey(),
  name:      varchar('name', { length: 191 }).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).notNull().defaultNow().onUpdateNow(),
}, (t) => ({
  nameIdx: uniqueIndex('departments_name_idx').on(t.name),
}));

// ── users ──────────────────────────────────────────────────────────────────────

const roleEnum = mysqlEnum('role', ['ADMIN', 'SUPER', 'USER']);

const users = mysqlTable('users', {
  id:           serial('id').primaryKey(),
  email:        varchar('email', { length: 191 }).notNull(),
  name:         varchar('name', { length: 191 }).notNull(),
  role:         roleEnum.notNull().default('USER'),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  departmentId: bigint('department_id', { mode: 'number', unsigned: true }).references(() => departments.id, { onDelete: 'set null' }),
  isActive:     tinyint('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt:    timestamp('created_at', { mode: 'string' }).notNull().defaultNow(),
  updatedAt:    timestamp('updated_at', { mode: 'string' }).notNull().defaultNow().onUpdateNow(),
}, (t) => ({
  emailIdx: uniqueIndex('users_email_idx').on(t.email),
  deptIdx:  index('users_dept_idx').on(t.departmentId),
  roleIdx:  index('users_role_idx').on(t.role),
}));

// ── tasks ──────────────────────────────────────────────────────────────────────

const statusEnum   = mysqlEnum('status', ['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED', 'CANCELLED']);
const priorityEnum = mysqlEnum('priority', ['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

const tasks = mysqlTable('tasks', {
  id:               serial('id').primaryKey(),
  title:            varchar('title', { length: 255 }).notNull(),
  description:      text('description'),
  status:           statusEnum.notNull().default('TODO'),
  priority:         priorityEnum.notNull().default('MEDIUM'),
  departmentId:     bigint('department_id',      { mode: 'number', unsigned: true }).references(() => departments.id, { onDelete: 'set null' }),
  createdByUserId:  bigint('created_by_user_id', { mode: 'number', unsigned: true }).notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  assignedToUserId: bigint('assigned_to_user_id', { mode: 'number', unsigned: true })
    .references(() => users.id, { onDelete: 'set null' }),
  dueAt:            datetime('due_at',    { mode: 'string', fsp: 3 }),
  completedAt:      datetime('completed_at', { mode: 'string', fsp: 3 }),
  cancelledAt:      datetime('cancelled_at', { mode: 'string', fsp: 3 }),
  cancelledByUserId:bigint('cancelled_by_user_id', { mode: 'number', unsigned: true })
    .references(() => users.id, { onDelete: 'set null' }),
  cancelReason:     text('cancel_reason'),
  createdAt:        timestamp('created_at', { mode: 'string' }).notNull().defaultNow(),
  updatedAt:        timestamp('updated_at', { mode: 'string' }).notNull().defaultNow().onUpdateNow(),
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

const sessions = mysqlTable('sessions', {
  id:        varchar('id', { length: 36 }).primaryKey(),
  userId:    bigint('user_id', { mode: 'number', unsigned: true }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { mode: 'string' }).notNull().defaultNow(),
  expiresAt: datetime('expires_at', { mode: 'string', fsp: 3 }).notNull(),
  revokedAt: datetime('revoked_at', { mode: 'string', fsp: 3 }),
  ip:        varchar('ip', { length: 45 }),
  userAgent: varchar('user_agent', { length: 255 }),
}, (t) => ({
  userIdx:    index('sessions_user_idx').on(t.userId),
  expiresIdx: index('sessions_expires_idx').on(t.expiresAt),
}));

// ── audit_logs ─────────────────────────────────────────────────────────────────

const auditLogs = mysqlTable('audit_logs', {
  id:          serial('id').primaryKey(),
  actorUserId: bigint('actor_user_id', { mode: 'number', unsigned: true }).references(() => users.id, { onDelete: 'set null' }),
  action:      varchar('action', { length: 64 }).notNull(),
  entityType:  varchar('entity_type', { length: 32 }).notNull(),
  entityId:    int('entity_id'),
  departmentId:bigint('department_id', { mode: 'number', unsigned: true }).references(() => departments.id, { onDelete: 'set null' }),
  beforeJson:  text('before_json'),
  afterJson:   text('after_json'),
  reason:      text('reason'),
  createdAt:   timestamp('created_at', { mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  actorIdx:  index('audit_actor_idx').on(t.actorUserId),
  entityIdx: index('audit_entity_idx').on(t.entityType, t.entityId),
  deptIdx:   index('audit_dept_idx').on(t.departmentId),
  timeIdx:   index('audit_time_idx').on(t.createdAt),
}));

// ── password_reset_tokens ─────────────────────────────────────────────────────

const passwordResetTokens = mysqlTable('password_reset_tokens', {
  id:        serial('id').primaryKey(),
  userId:    bigint('user_id', { mode: 'number', unsigned: true }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  token:     varchar('token', { length: 128 }).notNull(),
  expiresAt: datetime('expires_at', { mode: 'string', fsp: 3 }).notNull(),
  usedAt:    datetime('used_at', { mode: 'string', fsp: 3 }),
  createdAt: timestamp('created_at', { mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  tokenIdx: uniqueIndex('prt_token_idx').on(t.token),
  userIdx:  index('prt_user_idx').on(t.userId),
}));

// ── task_collaborators ────────────────────────────────────────────────────────

const taskCollaborators = mysqlTable('task_collaborators', {
  id:            serial('id').primaryKey(),
  taskId:        bigint('task_id',         { mode: 'number', unsigned: true }).notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  userId:        bigint('user_id',          { mode: 'number', unsigned: true }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  addedByUserId: bigint('added_by_user_id', { mode: 'number', unsigned: true }).references(() => users.id, { onDelete: 'set null' }),
  createdAt:     timestamp('created_at', { mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  taskUserUniq: uniqueIndex('tc_task_user_uniq').on(t.taskId, t.userId),
  taskIdx:      index('tc_task_idx').on(t.taskId),
  userIdx:      index('tc_user_idx').on(t.userId),
}));

// ── task_comments ─────────────────────────────────────────────────────────────

const taskComments = mysqlTable('task_comments', {
  id:        serial('id').primaryKey(),
  taskId:    bigint('task_id', { mode: 'number', unsigned: true }).notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  userId:    bigint('user_id', { mode: 'number', unsigned: true }).references(() => users.id, { onDelete: 'set null' }),
  content:   text('content').notNull(),
  editedAt:  datetime('edited_at', { mode: 'string', fsp: 3 }),
  createdAt: timestamp('created_at', { mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).notNull().defaultNow().onUpdateNow(),
}, (t) => ({
  taskIdx: index('comments_task_idx').on(t.taskId),
  userIdx: index('comments_user_idx').on(t.userId),
}));

module.exports = {
  departments,
  users,
  tasks,
  sessions,
  auditLogs,
  passwordResetTokens,
  taskComments,
  taskCollaborators,
};
