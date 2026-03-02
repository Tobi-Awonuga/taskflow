// TODO: Seed the database with sample users, departments, and tasks
// Run with: npx prisma db seed

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');
  // TODO: create sample departments
  // TODO: create sample users (admin, manager, member)
  // TODO: create sample tasks
  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
