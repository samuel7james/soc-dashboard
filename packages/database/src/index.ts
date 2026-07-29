import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/prisma/client.js";

// Prisma 7 requires an explicit driver adapter (or an Accelerate URL) — the
// bundled Rust query engine is gone, so the client reaches Postgres through
// `pg` instead. Prisma no longer reads DATABASE_URL itself for the client, so
// it is resolved and asserted here at the one place the client is constructed.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to initialise the Prisma client");
}

// Next.js dev / tsx watch reload modules on every change; without caching the
// client on `globalThis` each reload would open a fresh pool of Postgres
// connections until the database refuses new ones.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "./generated/prisma/client.js";
