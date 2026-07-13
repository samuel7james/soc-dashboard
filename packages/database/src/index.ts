import { PrismaClient } from "@prisma/client";

// Next.js dev / tsx watch reload modules on every change; without caching the
// client on `globalThis` each reload would open a fresh pool of Postgres
// connections until the database refuses new ones.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "@prisma/client";
