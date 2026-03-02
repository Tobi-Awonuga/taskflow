// server/prisma/seed.js
// Run with: node prisma/seed.js

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // 1) Clear existing data (order matters because of relations)
  await prisma.task.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();

  // 2) Create departments
  const ops = await prisma.department.create({ data: { name: "Operations" } });
  const it = await prisma.department.create({ data: { name: "IT" } });

  // 3) Create users (dev password hash)
  const defaultPassword = "Taskflow123!"; // dev only
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  const admin = await prisma.user.create({
    data: {
      email: "admin@taskflow.local",
      name: "Admin User",
      role: "ADMIN",
      passwordHash,
      departmentId: it.id,
    },
  });

  const superUser = await prisma.user.create({
    data: {
      email: "super@taskflow.local",
      name: "Super User",
      role: "SUPER",
      passwordHash,
      departmentId: it.id,
    },
  });

  const regularUser = await prisma.user.create({
    data: {
      email: "user@taskflow.local",
      name: "Regular User",
      role: "USER",
      passwordHash,
      departmentId: ops.id,
    },
  });

  // 4) Create tasks (aligned to architecture rules)
  // Rules enforced here:
  // - departmentId required
  // - createdByUserId required
  // - assignedToUserId optional (TODO can be unassigned)
  // - IN_PROGRESS must be assigned
  // - DONE should set completedAt

  await prisma.task.createMany({
    data: [
      {
        title: "Set up TaskFlow auth",
        description: "Implement session-based auth routes",
        status: "TODO",
        priority: "HIGH",
        departmentId: it.id,
        createdByUserId: admin.id,
        assignedToUserId: null,
      },
      {
        title: "Draft Ops dashboard layout",
        description: "Sketch initial layout and task filters",
        status: "IN_PROGRESS",
        priority: "MEDIUM",
        departmentId: ops.id,
        createdByUserId: superUser.id,
        assignedToUserId: regularUser.id, // must match same department
      },
      {
        title: "Create initial task list UI",
        description: "Build task list rendering + empty states",
        status: "DONE",
        priority: "LOW",
        departmentId: it.id,
        createdByUserId: admin.id,
        assignedToUserId: superUser.id,
        completedAt: new Date(),
      },
    ],
  });

  console.log("Seed complete ✅");
  console.log("Departments:", ops.name, it.name);
  console.log("Users:", admin.email, superUser.email, regularUser.email);
  console.log(`Dev password for all users (dev only): ${defaultPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });