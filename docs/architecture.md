# Architecture

## System overview

```text
                       ┌───────────────────────────┐
                       │        Next.js Web         │  apps/web
                       │  App Router · RSC-shell ·   │  :3000
                       │  TanStack Query · Zustand   │
                       └───────────┬────────────────┘
                                   │ HTTPS (REST) + WSS
                       ┌───────────▼────────────────┐
                       │        Fastify API          │  apps/api
                       │  REST /api/v1 + /ws         │  :4000
                       │  Zod validation · RBAC ·     │
                       │  Pino logs · OTel traces     │
                       └───┬───────────────┬─────────┘
                           │               │
                 ┌─────────▼───┐   ┌───────▼────────┐
                 │  PostgreSQL │   │      Redis       │
                 │  (Prisma)   │   │ cache/pubsub/queue│
                 └─────────────┘   └───────┬──────────┘
                                            │
                                   ┌────────▼─────────┐
                                   │  BullMQ Worker     │  apps/worker
                                   │  ingestion ·        │
                                   │  scheduled reports · │
                                   │  notification delivery│
                                   └────────┬────────────┘
                                            │
                       ┌────────────────────▼────────────────────┐
                       │           Ingestion Connectors            │
                       │  syslog UDP listener · CSV/JSON upload ·  │
                       │  Demo Mode synthetic generator (labeled)  │
                       └────────────────────────────────────────────┘

Cross-cutting: OpenTelemetry → OTel Collector → Prometheus + Tempo · Loki (logs)
· Grafana · GitHub Actions CI/CD · Docker/Compose (dev) · Kubernetes+Helm /
Terraform (reference prod deploy)
```

Three deployable processes share two data stores. The web app never talks to
Postgres/Redis directly — everything goes through the API, including the
WebSocket channel used for live push.

## Monorepo layout

pnpm workspaces + Turborepo (cached, parallel builds; a single lockfile
across everything).

```text
apps/
  web/            Next.js 16 (App Router, TypeScript strict, Tailwind v4, shadcn-style UI)
  api/            Fastify 5 (TypeScript strict, Zod validation, Pino logging)
  worker/         BullMQ background processor + ingestion listeners
packages/
  types/          Shared Zod schemas + inferred types — the one place a shape is defined
  ui/             Cross-cutting design tokens/components consumed by apps/web
  auth/           Password hashing (argon2id) + JWT/refresh-token primitives
  database/       Prisma schema, migrations, seed script
  connectors/     Ingestion parsers (syslog, CSV) + the detection-rules engine
  observability/  Custom OpenTelemetry metric instruments
  config/         Shared base tsconfig
deploy/
  helm/           Kubernetes Helm chart
  terraform/      AWS reference module (ECS Fargate)
  observability/  OTel Collector, Prometheus, Tempo, Loki, Grafana, Alertmanager configs
```

`packages/types` is the load-bearing one: both `apps/web` and `apps/api`
import the same Zod schemas, so a request/response shape is defined exactly
once and both sides stay in sync by construction, not by convention.

## Why API-owned auth instead of Auth.js/NextAuth

The original plan called for Auth.js. It was dropped in favor of Fastify
owning sessions/RBAC/audit directly: splitting that state between Next.js
and the API would mean two systems need to agree on what "logged in" means,
and the worker (a third process with no HTTP framework at all) would need a
way to participate too. A single source of truth — the API issues and
validates every session — means the worker's queue processors can trust
`req.user` was validated once, upstream, rather than re-implementing auth
checks themselves.

See [`docs/security.md`](security.md) for the actual auth flow (JWT access +
rotating refresh tokens, CSRF, RBAC).

## Why a separate worker process

Ingestion (syslog UDP, file upload parsing, detection-rule evaluation),
scheduled jobs, and notification delivery are queue-driven (BullMQ) rather
than handled inline in an API request handler. Two reasons:

- **Backpressure.** A burst of syslog traffic or a large CSV upload
  shouldn't block the request/response cycle of unrelated API calls — they
  get enqueued and processed independently.
- **Independent scaling.** The API is request-driven (scale on concurrent
  HTTP/WS connections); the worker is throughput-driven (scale on queue
  depth). Coupling them into one process would mean scaling one for the
  other's bottleneck.

Both apps/api and apps/worker publish to the same Redis pub/sub channel
(`soc:realtime`) so a WebSocket-connected browser gets pushed an update
regardless of which process produced it (an analyst-submitted alert from the
API, or an ingestion-pipeline-produced alert from the worker).

## Data flow: ingestion → alert

```text
syslog UDP datagram / CSV upload row
        │
        ▼
apps/worker (or apps/api for uploads) enqueues an IngestionJobData
        │ BullMQ "ingestion" queue
        ▼
apps/worker ingestion-processor
        │  1. writes a RawEvent (the landing-zone, schema-loose record)
        │  2. runs it through packages/connectors' detection rules
        ▼
  rule match?
   ├─ no  → done (RawEvent persisted, no Alert)
   └─ yes → creates an Alert + AlertMitreMapping rows,
            publishes "alert.created" to Redis pub/sub
                    │
                    ▼
        apps/api's WS layer fans it out to every
        connected browser subscribed to /ws
```

`RawEvent.payload` is intentionally schema-loose (`Json`) — it's what a
connector produced before normalization. `Alert` is the normalized,
correlated output the rest of the platform (dashboard, analytics, MITRE
mapping) actually queries against. See
[`docs/database-erd.md`](database-erd.md) for the full schema.

Detection rules are pattern-matchers in `packages/connectors`, not persisted
database entities — there's no `Rule` table to administer through the UI.
This is a deliberate, documented scope boundary (see
[`docs/api.md`](api.md)'s note on the analytics `detection-effectiveness`
endpoint), not an oversight.

## Why esbuild bundling for apps/api and apps/worker

`packages/*` ship as raw TypeScript with no build step of their own — Node
can't `import` a `.ts` file directly in production. Rather than adding a
build step to every shared package (more moving parts, more places for a
stale build to drift from source), `apps/api` and `apps/worker` bundle at
their own boundary: `packages/config/build-node-app.mjs` walks the
workspace dependency graph, inlines first-party `@soc/*` source directly
into the output bundle, and externalizes every real npm dependency so
native bindings (Prisma's query engine, `@node-rs/argon2`) and
dynamic-require mechanisms are never touched by the bundler.

## Why the OpenTelemetry SDK loads via `node --import`, not a top-of-file import

`apps/{api,worker}/otel/instrumentation.mjs` is a plain `.mjs` file, not
bundled by the esbuild step above and not TypeScript. OpenTelemetry's
auto-instrumentation patches a package's exports via require-hooks the
moment Node loads it — that only works if the SDK's hooks are registered
_before_ the app's own `import "fastify"` (etc.) runs. Bundling would inline
everything into one file before those hooks could intercept anything;
even an unbundled top-of-file import can't guarantee ordering under ESM's
static import hoisting. Node's `--import` preload flag is the mechanism
OpenTelemetry's own docs recommend for exactly this reason — see the
`dev`/`start` scripts in `apps/{api,worker}/package.json`.

## Frontend data layer

`apps/web` never manages server state by hand — every list/detail/create/
update/delete flow for alerts, incidents, assets, vulnerabilities, and IOCs
goes through one shared `createResourceHooks` factory (TanStack Query)
rather than six hand-written copies of the same fetch/cache/invalidate
logic. Real-time pushes (`useRealtimeUpdates`) invalidate the relevant query
keys on `alert.created`/`incident.created`, so a live update and a manual
refresh converge on the same code path.

## Observability

See [`docs/observability.md`](observability.md) for the full pipeline
(OpenTelemetry → Collector → Prometheus/Tempo, Loki, Grafana, Alertmanager)
— it's cross-cutting infrastructure, not part of the request-handling
architecture above, so it's documented separately.

## Deployment topology

See [`docs/deployment.md`](deployment.md) for the two supported paths
(Kubernetes/Helm, Terraform/ECS Fargate) — both consume the same three
Docker images built from the root `Dockerfile`.
