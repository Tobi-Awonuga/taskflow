'use strict';
/**
 * Seed the database with two departments, one user per role.
 *
 * Run:  node scripts/seed.js
 *
 * Safe to run multiple times — skips existing records.
 * Credentials (dev only):
 *   admin@taskflow.com  / admin123   (ADMIN, Engineering)
 *   super@taskflow.com  / super123   (SUPER, Engineering)
 *   user@taskflow.com   / user123    (USER,  Design)
 */
require('dotenv').config();
const path        = require('path');
const Database    = require('better-sqlite3');
const { drizzle } = require('drizzle-orm/better-sqlite3');
const { eq }      = require('drizzle-orm');
const { departments, users, tasks } = require('../src/db/schema');
const { hashPassword } = require('../src/lib/password');

const dbPath = path.resolve(__dirname, '../', process.env.DATABASE_URL || './db/dev.sqlite');
const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');
const db = drizzle(sqlite);

function upsertDept(name) {
  const existing = db.select().from(departments).where(eq(departments.name, name)).get();
  if (existing) return existing;
  return db.insert(departments).values({ name }).returning().get();
}

function upsertUser({ email, name, role, password, departmentId }) {
  const existing = db.select().from(users).where(eq(users.email, email)).get();
  if (existing) {
    console.log(`  skip user ${email} (already exists)`);
    return existing;
  }
  return db.insert(users).values({
    email,
    name,
    role,
    passwordHash: hashPassword(password),
    departmentId,
    isActive: true,
  }).returning().get();
}

// ── Departments ────────────────────────────────────────────────────────────────
console.log('Seeding departments…');
const eng    = upsertDept('Engineering');
const design = upsertDept('Design');
console.log(`  Engineering → id ${eng.id}`);
console.log(`  Design      → id ${design.id}`);

// ── Users ──────────────────────────────────────────────────────────────────────
console.log('Seeding users…');
const admin = upsertUser({
  email:        'admin@taskflow.com',
  name:         'Admin User',
  role:         'ADMIN',
  password:     'admin123',
  departmentId: eng.id,
});
const superUser = upsertUser({
  email:        'super@taskflow.com',
  name:         'Super User',
  role:         'SUPER',
  password:     'super123',
  departmentId: eng.id,
});
const regularUser = upsertUser({
  email:        'user@taskflow.com',
  name:         'Regular User',
  role:         'USER',
  password:     'user123',
  departmentId: design.id,
});

// ── Sample tasks ───────────────────────────────────────────────────────────────
console.log('Seeding sample tasks…');
const seedTasks = [
  { title: 'Set up CI pipeline',        priority: 'HIGH',   departmentId: eng.id,    createdByUserId: admin.id,    assignedToUserId: superUser.id },
  { title: 'Write API documentation',   priority: 'MEDIUM', departmentId: eng.id,    createdByUserId: superUser.id, assignedToUserId: null },
  { title: 'Redesign onboarding flow',  priority: 'HIGH',   departmentId: design.id, createdByUserId: admin.id,    assignedToUserId: regularUser.id },
  { title: 'Fix login page contrast',   priority: 'LOW',    departmentId: design.id, createdByUserId: regularUser.id, assignedToUserId: null },
  { title: 'Performance audit Q1',      priority: 'URGENT', departmentId: eng.id,    createdByUserId: admin.id,    assignedToUserId: superUser.id },
];

for (const t of seedTasks) {
  const exists = db.select().from(tasks)
    .where(eq(tasks.title, t.title))
    .get();
  if (exists) {
    console.log(`  skip task "${t.title}" (already exists)`);
    continue;
  }
  const row = db.insert(tasks).values({ ...t, status: 'TODO' }).returning().get();
  console.log(`  created task id ${row.id}: "${row.title}"`);
}

console.log('\n✓ Seed complete');
console.log('  admin@taskflow.com  / admin123');
console.log('  super@taskflow.com  / super123');
console.log('  user@taskflow.com   / user123');
sqlite.close();
