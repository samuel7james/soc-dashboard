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
  observability/ Custom OTel metric instruments (WS connections, ingestion lag, queue depth/failures)
  config/       Shared base tsconfig
deploy/
  helm/         Kubernetes Helm chart (soc-platform)
  terraform/    AWS reference module (ECS Fargate, RDS, ElastiCache, S3)
  observability/ OTel Collector, Prometheus, Tempo, Loki, Promtail, Grafana, Alertmanager configs
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

## Observability

API and worker are instrumented with OpenTelemetry (traces + metrics),
exported to an OTel Collector that fans out to Prometheus (metrics) and Tempo
(traces); Promtail ships Pino logs to Loki; Grafana ties all three together
with pre-provisioned dashboards, and Prometheus Alertmanager handles SLO
alerts. Bring the whole stack up alongside the app:

```bash
docker compose --profile full --profile observability up --build
```

- Grafana: <http://localhost:3001> (anonymous viewer access; dashboards under the "SOC Platform" folder)
- Prometheus: <http://localhost:9090>
- Alertmanager: <http://localhost:9093>
- Tempo: <http://localhost:3200>

See [`docs/observability.md`](docs/observability.md) for the full pipeline, dashboard list, and alerting rules.

## Infrastructure

Two deployment paths, both consuming the same Docker images — see
[`docs/deployment.md`](docs/deployment.md):

- **Kubernetes**: `deploy/helm/soc-platform` — a Helm chart, live-tested end
  to end on a real local cluster (login round-trip, a Postgres-outage
  readiness-probe test, and a broken-rollout/`helm rollback` cycle).
- **AWS (no Kubernetes)**: `deploy/terraform` — VPC, RDS Postgres,
  ElastiCache Redis, ECR, ECS Fargate, ALB, S3. `init`/`validate`/`plan`'d
  successfully (no AWS account available to `apply` against).

## Status

Phase 9 (Observability) is complete, on top of a fully functional core platform (Phases 4-8): the full frontend (dashboard, alert triage, incident workboard, asset inventory, vulnerability management, threat intel + MITRE ATT&CK matrix, threat hunting, audit logs, notifications, reports, advanced analytics) is wired up to the real API, the platform ingests real telemetry through a dedicated BullMQ worker app, and CI/security pipelines are live on GitHub (dependency scanning: zero known vulnerabilities, down from 11 at the Phase 1 baseline — see `docs/ci-cd.md` for the `pnpm audit` → OSV-Scanner switch forced by npm's registry retiring the legacy audit endpoint). Building the Kubernetes/Terraform deployment configs surfaced and fixed two real bugs no earlier phase had caught: the API's `/ready` endpoint didn't actually check its dependencies despite claiming to, and the worker crashed its entire process (not just the affected request) on any transient database hiccup. Both are fixed and live-verified — including watching the worker survive a real Postgres outage and self-recover with zero restarts. The OpenTelemetry/Prometheus/Tempo/Loki/Grafana stack was brought up end to end against real traffic (an actual login, file upload, WebSocket connection, and a deliberately-injected job failure) to confirm traces, metrics, and logs all genuinely flow rather than just being configured on paper. See `TASKS.md` for the live checklist.

## License

MIT — see [LICENSE](LICENSE).
