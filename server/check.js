const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('departments', await prisma.department.count());
  console.log('users', await prisma.user.count());
  console.log('tasks', await prisma.task.count());
  await prisma.$disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});