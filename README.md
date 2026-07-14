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
pnpm build          # production build
pnpm lint           # ESLint
pnpm typecheck      # tsc --noEmit
pnpm test           # Vitest
pnpm test:coverage  # Vitest with coverage thresholds (apps/api, apps/worker, packages/auth, packages/connectors)
pnpm format         # Prettier
```

## Docker

A single multi-stage root `Dockerfile` builds all three apps via `--target`:

```bash
docker build --target api    -t soc-platform/api    .
docker build --target worker -t soc-platform/worker .
docker build --target web    -t soc-platform/web    .
```

`docker compose up -d` still only starts Postgres + Redis (the everyday
local-dev command, apps run via `pnpm dev` on the host for fast reload). To
run the entire platform containerized instead:

```bash
docker compose --profile full up --build
```

See [`docs/ci-cd.md`](docs/ci-cd.md) for the CI/security pipeline this feeds into.

## Status

Phase 7 (DevSecOps) is complete, on top of a fully functional core platform (Phases 4-6): the full frontend (dashboard, alert triage, incident workboard, asset inventory, vulnerability management, threat intel + MITRE ATT&CK matrix, threat hunting, audit logs, notifications, reports, advanced analytics) is wired up to the real API, and the platform ingests real telemetry through a dedicated BullMQ worker app. All three apps now have verified, working multi-stage Docker images (building one and stopping there turned up a real bug — the production `build`/`start` path had never actually been exercised end-to-end, since dev always ran through `tsx`; that's fixed, not just papered over in the Dockerfile) plus a `docker compose --profile full` path to run the whole platform containerized. GitHub Actions workflows for CI (lint/typecheck/test-with-coverage/build/docker-build) and security scanning (CodeQL, Semgrep, gitleaks, dependency audit, Trivy, SBOM) are written and ready for the first push — `pnpm audit` is at zero known vulnerabilities, down from 11 at the Phase 1 baseline. See `TASKS.md` for the live checklist.

## License

MIT — see [LICENSE](LICENSE).
