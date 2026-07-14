# SOC Platform

An enterprise-grade Security Operations Center platform, in active rebuild. See [`PROJECT_PLAN.md`](PROJECT_PLAN.md) for the full architecture/audit and [`TASKS.md`](TASKS.md) for phase-by-phase progress.

The original bash-script-driven demo (Express + vanilla JS, `Math.random()`-backed "live" data) has been fully replaced by the monorepo below, which now exceeds its feature set with real data end to end.

## Monorepo layout

```text
apps/
  web/          Next.js (App Router, TypeScript strict, Tailwind, shadcn-style UI)
  api/          Fastify API (TypeScript strict, Zod validation, Pino logging, auth)
  worker/       BullMQ worker: ingestion pipeline, Demo Mode, scheduled jobs
packages/
  types/        Shared Zod schemas + inferred types, consumed by both apps
  ui/           Shared design tokens, theme provider, and cross-cutting components
  auth/         Password hashing (argon2id) and JWT/refresh-token primitives
  database/     Prisma schema, migrations, seed script
  connectors/   Ingestion parsers (syslog, CSV) and detection rules, shared by api + worker
  config/       Shared base tsconfig
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
- API: <http://localhost:4000> (`/health`, `/ready`, `/api/v1`, OpenAPI docs at `/docs` in non-production)

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

Phase 6 (Advanced Analytics) is complete, on top of a fully functional Phase 5 core platform: the full frontend (dashboard, alert triage, incident workboard, asset inventory, vulnerability management, threat intel + MITRE ATT&CK matrix, threat hunting, audit logs, notifications, reports) is wired up to the real API, and the platform ingests real telemetry — a syslog UDP listener and a CSV/JSON file upload connector, both feeding a pattern-based detection engine that produces real alerts, running on a dedicated BullMQ worker app (`apps/worker`). A synthetic Demo Mode generator (off by default, clearly labeled) is available for demos without live telemetry. New alerts and incidents push to connected browsers over an authenticated WebSocket. A new `/analytics` page adds alert trend/heatmap charts, MITRE technique frequency, detection effectiveness, deterministic asset risk scoring, and an attack timeline — all backed by real Postgres aggregates. See `TASKS.md` for the live checklist.

## License

MIT — see [LICENSE](LICENSE).
