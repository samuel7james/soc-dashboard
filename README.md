# SOC Platform

An enterprise-grade Security Operations Center platform, in active rebuild. See [`PROJECT_PLAN.md`](PROJECT_PLAN.md) for the full architecture/audit and [`TASKS.md`](TASKS.md) for phase-by-phase progress.

The original bash-script-driven demo (Express + vanilla JS, `Math.random()`-backed "live" data) has been moved to [`legacy/`](legacy/) and is being replaced incrementally by the monorepo below. It still runs standalone via `node legacy/api/api_server.js` if needed for reference.

## Monorepo layout

```text
apps/
  web/          Next.js (App Router, TypeScript strict, Tailwind, shadcn-style UI)
  api/          Fastify API (TypeScript strict, Zod validation, Pino logging, auth)
packages/
  types/        Shared Zod schemas + inferred types, consumed by both apps
  ui/           Shared design tokens, theme provider, and cross-cutting components
  auth/         Password hashing (argon2id) and JWT/refresh-token primitives
  database/     Prisma schema, migrations, seed script
  config/       Shared base tsconfig
legacy/         Pre-rebuild application (Express + bash scripts), kept for reference
```

## Requirements

- Node.js ≥ 20
- pnpm ≥ 10 (`corepack enable` or `npm i -g pnpm`)
- Docker (for local Postgres + Redis)

## Getting started

```bash
pnpm install

# start local Postgres + Redis
docker compose up -d

# copy env templates and fill in DATABASE_URL / JWT_ACCESS_SECRET
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env

# apply migrations and seed a dev owner account (owner@soc.local)
pnpm --filter @soc/database db:migrate
pnpm --filter @soc/database db:seed

pnpm dev          # runs all apps in parallel via Turborepo
```

- Web: <http://localhost:3000> (redirects to `/login`)
- API: <http://localhost:4000> (`/health`, `/ready`, `/api/v1`)

## Scripts

Run from the repo root (fanned out to every workspace package via Turborepo):

```bash
pnpm build       # production build
pnpm lint        # ESLint
pnpm typecheck   # tsc --noEmit
pnpm test        # Vitest
pnpm format      # Prettier
```

## Status

Phase 3 (Authentication & Security) is complete: real Postgres-backed accounts, argon2id password hashing, JWT access + rotating refresh tokens with theft detection, RBAC (owner/admin/analyst/read_only), CSRF protection, rate limiting, audit logging, and a working login/logout flow in the web app. No domain data (alerts, incidents, etc.) yet — that lands in Phases 4–5. See `TASKS.md` for the live checklist.

## License

MIT — see [LICENSE](LICENSE).
