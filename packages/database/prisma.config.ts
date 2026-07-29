import { defineConfig } from "prisma/config";

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
// it is only needed by CLI commands that actually talk to a database (migrate,
// db seed, studio). The runtime client gets its connection separately, through
// the `@prisma/adapter-pg` driver adapter constructed in src/index.ts.
//
// It is therefore declared only when it exists. `prisma generate` runs from
// `postinstall` in every environment, including ones with no database at all —
// CI's lint/typecheck and build jobs, and the Docker image build. Prisma's
// `env()` helper throws while *loading* this config when the variable is
// unset, which would fail `pnpm install` in all of them for a value that
// command never reads.
const url = process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  ...(url ? { datasource: { url } } : {}),
});
