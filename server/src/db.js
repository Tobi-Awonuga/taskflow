// Singleton Prisma client – import this wherever you need DB access
// TODO: Add connection error handling / logging

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = prisma;
