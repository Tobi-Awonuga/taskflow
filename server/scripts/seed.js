'use strict';
/**
 * Seed the database with departments, sample users, and example tasks.
 *
 * Run:  node scripts/seed.js
 *
 * Safe to run multiple times — skips existing records.
 */
require('dotenv').config();
const mysql       = require('mysql2/promise');
const { drizzle } = require('drizzle-orm/mysql2');
const { eq }      = require('drizzle-orm');
const { departments, users, tasks } = require('../src/db/schema');
const { hashPassword } = require('../src/lib/password');

function resolveConfig() {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('://')) {
    const url = new URL(process.env.DATABASE_URL);
    return {
      host:     url.hostname,
      port:     Number(url.port || '3306'),
      user:     decodeURIComponent(url.username || ''),
      password: decodeURIComponent(url.password || ''),
      database: url.pathname.replace(/^\//, ''),
    };
  }
  return {
    host:     process.env.MYSQL_HOST     || '127.0.0.1',
    port:     Number(process.env.MYSQL_PORT || '3306'),
    user:     process.env.MYSQL_USER     || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'nectar',
  };
}

async function selectOne(query) {
  const rows = await query;
  return rows[0] ?? null;
}

async function main() {
  const pool = mysql.createPool({
    ...resolveConfig(),
    waitForConnections: true,
    connectionLimit: Number(process.env.MYSQL_POOL_SIZE || '10'),
  });
  const db = drizzle(pool);

  try {
    const upsertDept = async (name) => {
      const existing = await selectOne(
        db.select().from(departments).where(eq(departments.name, name)).limit(1),
      );
      if (existing) return existing;

      await db.insert(departments).values({ name });
      const [row] = await db.select().from(departments).where(eq(departments.name, name)).limit(1);
      return row;
    };

    const upsertUser = async ({ email, name, role, password, departmentId }) => {
      const existing = await selectOne(
        db.select().from(users).where(eq(users.email, email)).limit(1),
      );
      if (existing) {
        console.log(`  skip user ${email} (already exists)`);
        return existing;
      }
      await db.insert(users).values({
        email,
        name,
        role,
        passwordHash: hashPassword(password),
        departmentId,
        isActive: true,
      });
      const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      return row;
    };

    console.log('Seeding departments…');
    const eng    = await upsertDept('Engineering');
    const design = await upsertDept('Design');
    console.log(`  Engineering → id ${eng.id}`);
    console.log(`  Design      → id ${design.id}`);

    console.log('Seeding users…');
    const admin = await upsertUser({
      email:        'admin@taskflow.com',
      name:         'Admin User',
      role:         'ADMIN',
      password:     'admin123',
      departmentId: eng.id,
    });
    const superUser = await upsertUser({
      email:        'super@taskflow.com',
      name:         'Super User',
      role:         'SUPER',
      password:     'super123',
      departmentId: eng.id,
    });
    const regularUser = await upsertUser({
      email:        'user@taskflow.com',
      name:         'Regular User',
      role:         'USER',
      password:     'user123',
      departmentId: design.id,
    });

    console.log('Seeding sample tasks…');
    const seedTasks = [
      { title: 'Set up CI pipeline',        priority: 'HIGH',   departmentId: eng.id,    createdByUserId: admin.id,     assignedToUserId: superUser.id },
      { title: 'Write API documentation',   priority: 'MEDIUM', departmentId: eng.id,    createdByUserId: superUser.id, assignedToUserId: null },
      { title: 'Redesign onboarding flow',  priority: 'HIGH',   departmentId: design.id, createdByUserId: admin.id,     assignedToUserId: regularUser.id },
      { title: 'Fix login page contrast',   priority: 'LOW',    departmentId: design.id, createdByUserId: regularUser.id, assignedToUserId: null },
      { title: 'Performance audit Q1',      priority: 'URGENT', departmentId: eng.id,    createdByUserId: admin.id,     assignedToUserId: superUser.id },
    ];

    for (const task of seedTasks) {
      const exists = await selectOne(
        db.select().from(tasks).where(eq(tasks.title, task.title)).limit(1),
      );
      if (exists) {
        console.log(`  skip task "${task.title}" (already exists)`);
        continue;
      }
      await db.insert(tasks).values({ ...task, status: 'TODO' });
      const [row] = await db.select().from(tasks).where(eq(tasks.title, task.title)).limit(1);
      console.log(`  created task id ${row.id}: "${row.title}"`);
    }

    console.log('\n✓ Seed complete');
    console.log('  admin@taskflow.com  / admin123');
    console.log('  super@taskflow.com  / super123');
    console.log('  user@taskflow.com   / user123');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
