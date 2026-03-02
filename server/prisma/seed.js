// Seed the database with sample users, departments, and tasks
// Run with: node prisma/seed.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1) Clear existing data (safe for re-running)
  // Order matters if relations exist; with minimal schema it's fine.
  await prisma.task.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();

  // 2) Create departments
  const ops = await prisma.department.create({
    data: { name: 'Operations' },
  });

  const it = await prisma.department.create({
    data: { name: 'IT' },
  });

  // 3) Create users
  // NOTE: This matches what your Studio shows: id, email, name, role
  // If your schema later adds departmentId + passwordHash, we will update this.
  const admin = await prisma.user.create({
    data: {
      email: 'admin@taskflow.local',
      name: 'Admin User',
      role: 'ADMIN',
      // departmentId: ops.id  <-- we'll add this once schema supports it
    },
  });

  const superUser = await prisma.user.create({
    data: {
      email: 'super@taskflow.local',
      name: 'Super User',
      role: 'SUPER',
      // departmentId: ops.id
    },
  });

  const regularUser = await prisma.user.create({
    data: {
      email: 'user@taskflow.local',
      name: 'Regular User',
      role: 'USER',
      // departmentId: it.id
    },
  });

  // 4) Create sample tasks
  // NOTE: This assumes Task has at least: title, status
  // If your Task schema has more fields (assignedToUserId, departmentId, etc),
  // we will upgrade this in the next step.
  await prisma.task.createMany({
    data: [
      { title: 'Set up TaskFlow auth', status: 'ASSIGNED' },
      { title: 'Draft Ops dashboard layout', status: 'IN_PROGRESS' },
      { title: 'Create initial task list UI', status: 'BLOCKED' },
    ],
  });

  console.log('Seed complete.');
  console.log('Created departments:', ops.name, it.name);
  console.log('Created users:', admin.email, superUser.email, regularUser.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });