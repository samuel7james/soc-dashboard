import { defineConfig, env } from "prisma/config";

// Prisma 7 moved CLI configuration out of `package.json#prisma` into this
// file, and stopped loading `.env` implicitly — that has to happen here now.
// Node's built-in loader is used rather than adding `dotenv`, matching how
// apps/api and apps/worker already read their own env files.
try {
  process.loadEnvFile();
} catch {
  // No .env present (CI, Docker build) — fall through to the real environment.
}

// The connection URL also moved out of the schema's `datasource` block in v7:
// it is only needed by CLI commands (migrate, db seed, studio). The runtime
// client gets its connection separately, through the `@prisma/adapter-pg`
// driver adapter constructed in src/index.ts.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
