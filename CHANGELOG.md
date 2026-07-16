# Changelog

This project is a from-scratch rebuild of a prototype SOC dashboard (a
single Express server + vanilla-JS frontend that fabricated its "live"
telemetry with `Math.random()`) into a real, working Security Operations
Center platform. There's no prior tagged release to diff against, so this
changelog reads as one continuous history, grouped by the phase each piece
of work landed in and dated from the actual commits — not backfilled.

## [1.0.0] — 2026-07-16 — Full platform rebuild

### Repository audit & planning — 2026-07-13

Full audit of the original codebase (architecture, security, performance,
scalability, accessibility, dependencies). Findings: no database, no auth,
no tests, no CI, no real telemetry source, unescaped `innerHTML`
interpolation of server data (a live XSS vector), and 11 known
vulnerabilities (6 high, 5 moderate) in a 3-dependency project. Full
findings and the resulting technology decisions are preserved in this
changelog and in [`docs/architecture.md`](docs/architecture.md); the
planning document itself was retired once every phase it scoped had
shipped.

### Architecture & foundation — 2026-07-13

pnpm workspace + Turborepo monorepo scaffolded from scratch: Next.js 16
(App Router, TypeScript strict) for the frontend, Fastify 5 for the API,
shared `packages/{types,ui,config}`. Tailwind v4 + shadcn-style components,
dark-default theme system, TanStack Query + Zustand for client state, full
lint/typecheck/test/build pipeline green from day one.

### Authentication & security — 2026-07-13

**Design deviation from the original plan, made deliberately:** API-owned
custom auth instead of Auth.js/NextAuth — see
[`docs/architecture.md`](docs/architecture.md#why-api-owned-auth-instead-of-authjsnextauth)
for why. Argon2id password hashing, JWT access tokens, rotating refresh
tokens with theft detection, RBAC (owner/admin/analyst/read_only), CSRF
double-submit cookies, `helmet` + strict CSP, rate limiting, and an
immutable audit log — see [`docs/security.md`](docs/security.md) for the
full design. Caught and fixed a real bug during live browser verification:
logout silently failed because `fetch` sent a JSON content-type header with
no body.

### Database & backend — 2026-07-14

Full Prisma schema (16 tables), a real migration, and idempotent seed data
(33 real MITRE ATT&CK techniques, a demo dataset referencing real public
CVEs). Full REST CRUD for alerts/incidents/assets/vulnerabilities/IOCs,
pagination/filtering/sorting on every list endpoint, an OpenAPI spec
generated straight from the Zod schemas (no hand-maintained copy). Redis
wired as a real shared cache (MITRE technique list, 1h TTL, fails open to
Postgres). Found and fixed a real TypeScript+Prisma pitfall where a generic
helper picked the wrong arm of Prisma's Checked/Unchecked create-input
union.

### Core SOC platform — 2026-07-14

The full product surface: Executive Dashboard, Alerts triage queue,
Incident management (timeline, assignment, status workflow), Asset
Inventory, Vulnerability Management, Threat Intelligence + MITRE ATT&CK
matrix, Threat Hunting, Audit Logs, Notifications, on-demand report export
— all wired to real data, zero mocks. Real ingestion connectors landed
here: a syslog UDP listener and a CSV/JSON multipart upload endpoint, both
live-verified end-to-end (packet/row → `RawEvent` → detection rule →
`Alert`). A synthetic "Demo Mode" generator exists alongside them, always
visibly labeled and off by default — never presented as real telemetry.
WebSocket live push for new alerts/incidents via Redis pub/sub, fanning out
from either the API (analyst-submitted) or the worker (ingestion-produced).
Resolved an `ioredis` dual-version conflict between the app and BullMQ via
a root `pnpm.overrides` entry (a root-cause fix, not per-call-site casts).
The legacy prototype was deleted once this phase reached and exceeded its
feature set.

### Advanced analytics — 2026-07-14

`/analytics` endpoints: real Postgres aggregates (`groupBy` + a few
`$queryRaw` time-bucketing queries) for alert trends, a day/hour heatmap,
MITRE technique frequency, detection effectiveness, a deterministic 0–100
asset risk score (formula documented in code, not an opaque model), and a
chronologically-merged alert+incident timeline. Table virtualization
(`@tanstack/react-virtual`) for the one genuinely unbounded list in the app.
A validated categorical + sequential chart-color system, checked for
contrast and color-vision-deficiency safety against the app's actual
surfaces.

### DevSecOps — 2026-07-14

**Found and fixed before it shipped, not after:** the API/worker's
production build path (`node dist/index.js`) never actually worked — the
shared `@soc/*` packages ship as raw TypeScript with no build step, so
plain Node couldn't resolve them. Fixed by bundling both apps with esbuild
(inlines first-party source, externalizes real npm dependencies so native
bindings and Prisma's engine are untouched — see
[`docs/architecture.md`](docs/architecture.md#why-esbuild-bundling-for-appsapi-and-appsworker)).
Multi-stage Docker images for all three apps, `docker-compose` profiles,
`ci.yml` (lint/typecheck/test/build/docker-build) and `security.yml`
(CodeQL/Semgrep/gitleaks/dependency-audit/Trivy/SBOM). Found and fixed two
real vulnerabilities in the process (`vitest` arbitrary-file-read,
`vite`/`postcss` path-restriction bypasses) — dependency audit went from 11
known vulnerabilities to zero.

### Infrastructure — 2026-07-14

**Found and fixed two real production-readiness bugs before writing any
manifests:** `/ready` always returned `200` regardless of actual dependency
health; the worker had no HTTP surface at all for a scheduler to probe.
Both fixed with real checks. **Found and fixed a serious crash bug while
live-testing that fix:** unhandled promise rejections in two unawaited call
sites could take down the entire worker process on a transient database
blip — reproduced live (stopped Postgres, watched it die), fixed, and
re-verified the process now self-recovers with zero restarts. Helm chart
and Terraform module, both live-verified against a real local Kubernetes
cluster and a real `terraform plan` respectively — not just
`helm template`/`terraform validate`. See
[`docs/deployment.md`](docs/deployment.md) for the full verification
record.

### Observability — 2026-07-15

OpenTelemetry SDK in API + worker (traces + metrics, preloaded via `node
--import` — see
[`docs/architecture.md`](docs/architecture.md#why-the-opentelemetry-sdk-loads-via-node---import-not-a-top-of-file-import)),
an OTel Collector → Prometheus + Tempo pipeline, Loki log aggregation,
Grafana dashboards, and Prometheus Alertmanager rules — every piece
verified against a real running stack with real traffic (a real login,
file upload, WebSocket connection, and a deliberately-injected job
failure), not written and assumed correct. See
[`docs/observability.md`](docs/observability.md).

### Testing & optimization — 2026-07-15

`apps/api` test coverage went from 70% to 93% statement coverage by writing
real integration tests for every previously-untested route. New Playwright
E2E + accessibility suites, component-test infrastructure for
`packages/ui`, and a bundle/N+1/Lighthouse performance pass. **This phase's
own testing work found and fixed three real bugs**, not just
written-and-assumed-correct:

- A CSRF race condition (a fire-and-forget cookie-prime that human typing
  speed always won, but a fast/scripted client wouldn't).
- All 14 filter/form dropdowns in the app were invisible to screen
  readers — Radix's `combobox` role doesn't support "accessible name from
  content" per the WAI-ARIA spec, despite the text being visually present.
- An N+1 query pattern in the analytics endpoint, collapsed into one query
  via Prisma's `distinct`.

Full record in [`docs/ci-cd.md`](docs/ci-cd.md) and the git history for
this phase.

### Documentation & release — 2026-07-16

Final documentation pass: [`docs/architecture.md`](docs/architecture.md),
[`docs/api.md`](docs/api.md), [`docs/security.md`](docs/security.md),
finalized [`docs/database-erd.md`](docs/database-erd.md) and
[`docs/deployment.md`](docs/deployment.md), this changelog,
[`CONTRIBUTING.md`](CONTRIBUTING.md), and a production release checklist.
`README.md` rewritten with accurate, scoped claims and real screenshots of
the running application. The planning document (`PROJECT_PLAN.md`) and
per-phase task tracker (`TASKS.md`) that drove development are retired —
their content lives on here and in `docs/architecture.md`.

---

### Dependency audit history

| Point in time                         | Known vulnerabilities   |
| ------------------------------------- | ----------------------- |
| Original prototype (repository audit) | 11 (6 high, 5 moderate) |
| After the DevSecOps phase's fixes     | 0                       |
| Current                               | 0                       |
