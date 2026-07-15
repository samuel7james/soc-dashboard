# TASKS

Tracks every implementation task grouped by phase, per `PROJECT_PLAN.md`. Checked off as completed; new tasks added as discovered. Work proceeds one phase at a time, each requiring explicit approval before the next begins.

---

## Phase 1 — Repository Audit & Planning

- [x] Full repository audit (architecture, security, performance, scalability, maintainability, UI/UX, accessibility, dependencies, dead code)
- [x] `npm audit` baseline captured (11 vulns: 6 high, 5 moderate)
- [x] `PROJECT_PLAN.md` authored
- [x] `TASKS.md` authored
- [x] **Approved by user — "Proceed with the further phases"**

## Phase 2 — Architecture & Foundation

- [x] Moved legacy Express/bash/vanilla-JS app to `legacy/` (kept runnable for reference)
- [x] Initialize pnpm workspace + Turborepo (`apps/*`, `packages/*`)
- [x] Scaffold `apps/web` (Next.js 16, App Router, TypeScript strict, Tailwind v4)
- [x] Scaffold `apps/api` (Fastify 5, TypeScript strict, Zod-validated env, Pino logging)
- [x] Scaffold `packages/config` (shared strict `tsconfig.base.json`)
- [x] Scaffold `packages/types` (Zod schemas: enums, `Alert`, pagination — shared by API and web)
- [x] Scaffold `packages/ui` (shared design tokens, `ThemeProvider`, `cn()`, `SeverityBadge`); shadcn-style primitives (`Button`, `Card`) hand-authored directly in `apps/web/src/components/ui` per shadcn's own convention (its CLI writes into the consuming app, not a shared package, due to Tailwind v4's CSS-based config)
- [x] Install and configure Tailwind CSS v4 + shadcn conventions (`components.json`, `new-york` style, lucide icons)
- [x] Build design tokens (OKLCH color scale, radius, sidebar tokens) + dark/light theme system (`next-themes`, dark default, toggle in topbar)
- [x] App routing skeleton for 9 core sections (Overview, Alerts, Incidents, Threat Intel, Assets, Vulnerabilities, Hunting, Audit Logs, Reports) under a `(dashboard)` route group with shared sidebar/topbar shell
- [x] Global state setup: TanStack Query (`Providers` + devtools) for server cache, Zustand (persisted) for UI state (sidebar collapse)
- [x] Environment/config management: `.env.example` in both apps, Zod-validated typed env loader in the API
- [x] Base ESLint (flat config, typescript-eslint) + Prettier (with Tailwind class sorting) + TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) enforced across every workspace package
- [x] Verified end-to-end: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` all pass; booted both dev servers and confirmed `/overview` renders, `/` redirects, and the web app's live API-status indicator successfully calls the Fastify `/health` endpoint cross-origin
- [x] Removed `legacy/` entirely after Phase 5 reached and exceeded feature parity (real alerts/incidents/assets/vulnerabilities/threat-intel/hunting/audit-logs/notifications/reports backed by a real ingestion pipeline, vs. the original bash-script `Math.random()` demo)

## Phase 3 — Authentication & Security

- [x] **Design deviation from the original plan, approved by user:** API-owned custom auth instead of Auth.js — Fastify is the single source of truth for sessions/RBAC/audit rather than splitting that state between the API and Next.js
- [x] Local Postgres + Redis via `docker-compose up -d` (approved by user), used for real (not mocked) integration testing
- [x] `packages/database`: Prisma schema — `User`, `Session`, `AuditLog` models, `UserRole` enum (mirrors `packages/types`), initial migration applied, seed script (creates a dev owner account)
- [x] `packages/auth`: Argon2id password hashing (`@node-rs/argon2`), JWT access tokens (`jose`, HS256, 15 min TTL), opaque rotating refresh tokens (SHA-256 hash stored, raw token never persisted) — each with its own unit test suite
- [x] `apps/api` auth service: login (constant-time even for unknown emails, via a real dummy-hash comparison), refresh-token rotation with theft detection (reusing a rotated token revokes every session for that user), logout
- [x] RBAC middleware (`requireAuth`, `requireRole(...roles)`) + roles owner/admin/analyst/read_only
- [x] Auth routes: `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`, `GET /csrf`; no public self-registration — `POST /api/v1/users` is owner/admin-only (internal security tool, not open sign-up)
- [x] Protected route wrapper on frontend: `AuthGuard` client component (TanStack Query `/me` check + redirect to `/login`) wrapping the `(dashboard)` route group
- [x] CSRF protection: double-submit cookie pattern, enforced on every mutating `/api/v1/*` request including login itself
- [x] Secure cookies: httpOnly + SameSite (`lax` access token, `strict` refresh token scoped to `/api/v1/auth`) + `secure` in production
- [x] Security headers via `helmet` with a strict CSP; rate limiting (global 100/min, login endpoint 10/min per IP) — disabled only under `NODE_ENV=test` so the test suite isn't rate-limited by its own volume of requests
- [x] `AuditLog` write-path wired into login/login-failed/logout/user-created; verified real rows land in Postgres during live testing
- [x] Auth test suite (26 tests total, run against the real local Postgres, not mocks): CSRF rejection, login success/failure (including the generic "wrong email or password" message), `/me`, refresh rotation, stolen-refresh-token theft detection, logout, RBAC boundaries (403 for non-admin, 201 + audit log for owner)
- [x] Live-verified in a real browser (Playwright): logged-out redirect to `/login`, login as the seeded owner, dashboard renders with user email/role in the topbar, logout redirects back to `/login` — this caught and fixed a real bug (logout silently failed because `fetch` was sent `Content-Type: application/json` with no body)

## Phase 4 — Database & Backend

- [x] Full Prisma schema: `Alert`, `Incident`, `IncidentTimelineEvent`, `Asset`, `Vulnerability`, `IOC`, `ThreatActor`, `MitreTechnique`, `AlertMitreMapping`, `Notification`, `IngestionSource`, `RawEvent` (16 tables total incl. Phase 3's `User`/`Session`/`AuditLog`; `Report` deferred to the Phase 5/6 reporting feature rather than modeled speculatively now)
- [x] Migration authored and applied (`20260713180321_domain_model`)
- [x] Seed data: 33 real MITRE ATT&CK (Enterprise) techniques across 12 tactics, plus a full demo dataset (6 assets, 5 vulnerabilities referencing real public CVEs, 1 threat actor, 3 IOCs, 8 alerts with technique mappings, 3 incidents with timelines) — idempotent, guarded against re-seeding on top of existing data
- [x] REST API v1: full CRUD for alerts, incidents (+ timeline sub-resource), assets, vulnerabilities, IOCs; read-only for MITRE techniques; users CRUD carried over from Phase 3
- [x] Pagination/filtering/sorting on every list endpoint (shared `paginatedQuerySchema`/`toSkipTake`/`toPaginatedResult` helpers)
- [x] Zod request validation on every route via `fastify-type-provider-zod` (global validator/serializer compilers), replacing the Phase 3 pattern of manual `.parse()` calls in route bodies (auth/users routes migrated too, for consistency)
- [x] Centralized error handling (unchanged from Phase 3, now also driving 400s for the new routes' schema validation failures)
- [x] Structured logging (Pino) — unchanged from Phase 3, no `console.log` in request-handling code (seed script's `console.log` is fine, it's a one-off CLI script)
- [x] OpenAPI spec generated from the same Zod schemas via `@fastify/swagger` + `fastify-type-provider-zod`'s `jsonSchemaTransform` (no hand-maintained spec, no separate `zod-to-openapi` wiring needed); Swagger UI at `/docs`, dev-only
- [x] Redis wired as a real shared cache: MITRE technique list (rarely-changing reference data) cached with a 1-hour TTL, verified live via `redis-cli`; fails open (falls through to Postgres) if Redis is unreachable rather than erroring the request
- [x] `docs/database-erd.md` — Mermaid ER diagram + notes on the non-obvious design choices (nullable `Alert.incidentId` vs. a join table, hashed refresh tokens, loose-schema `RawEvent.payload`)
- [x] Discovered mid-phase, fixed: a real TypeScript+Prisma pitfall where a generic helper function (`stripUndefined`) constructing `data:` objects made TS pick the wrong arm of Prisma's `Checked`/`Unchecked` create-input union; resolved with explicit `as Prisma.XUncheckedCreateInput` casts at each call site (documented in code, not just worked around silently)
- [x] Tests: 37 total across the API (up from 26 in Phase 3) — new coverage for asset CRUD/RBAC/pagination and alert CRUD with MITRE technique mapping replace-on-update semantics, all against the real local Postgres
- [x] Live-verified: booted the API, logged in as the seeded owner, and exercised filtered/paginated alerts, incidents, MITRE techniques (confirmed cached in Redis via `redis-cli GET`/`TTL`), and assets against the real seeded data; confirmed `/docs` serves a real 21-path OpenAPI document

## Phase 5 — Core SOC Platform

### Milestone 1 — frontend wired to real data (complete)

- [x] API additions needed by the UI: `GET /dashboard/summary` (real aggregates), `GET /audit-logs` (owner/admin), `GET/POST /notifications` (+ `/read-all`), `GET /hunting/raw-events` + `/hunting/sources`, `GET /reports/export` (on-demand CSV/JSON); relaxed `GET /users` from owner/admin-only to any authenticated role since assignee pickers need it
- [x] Frontend data layer: a `createResourceHooks` factory (list/detail/create/update/delete via TanStack Query) shared across alerts/incidents/assets/vulnerabilities/IOCs instead of six hand-written copies
- [x] Shared UI: Table/Select/Dialog/DropdownMenu/Tabs/Textarea/Badge/Skeleton primitives (Radix-based, shadcn conventions), `PaginationBar`, `StatusBadge`, empty/error/loading states
- [x] Executive Dashboard: real aggregate counts, severity breakdown bars, 5 most recent alerts — no mock data
- [x] Alerts: paginated/filterable queue, detail dialog (description, MITRE techniques), status/assignment actions gated by role (read_only view-only)
- [x] Incident Management: create (optionally linking existing alerts), detail dialog with editable status/assignee, linked-alerts list, timeline with note-adding
- [x] Asset Inventory: paginated list, create dialog, delete (owner/admin only)
- [x] Vulnerability Management: paginated list, create dialog (linked to an asset), inline status editing
- [x] Threat Intelligence: IOC list + create dialog, tabbed alongside the MITRE matrix below
- [x] MITRE ATT&CK matrix: tactics-as-columns view, techniques highlighted with a live alert-count badge (client-side aggregation over the alert list — a documented interim approach pending a dedicated aggregate endpoint at higher alert volume)
- [x] Threat Hunting: structured filters (source IP, ingestion source) over `RawEvent`; honest empty state pointing at ingestion/Demo Mode rather than fake data
- [x] Audit Logs viewer: owner/admin-gated, filterable by action, actor resolved to email
- [x] Notifications: bell dropdown in the topbar with unread badge, mark-one/mark-all-read; server-side hook fires on alert/incident assignment
- [x] Reports: on-demand CSV/JSON export (alerts/incidents/vulnerabilities/assets) — a real, working, simple implementation instead of a speculative persisted `Report` entity + scheduling UI built ahead of need
- [x] Fixed a Turbopack/Windows transient crash (cleared `.next` cache) hit during verification — unrelated to app code
- [x] Fixed a flaky test (`dashboard-notifications.test.ts`) caused by asserting exact equality against shared DB state read outside the request — replaced with a before/after bracket
- [x] Live-verified every new page in a real browser (Playwright): dashboard, alerts + detail dialog, incidents + detail dialog, assets, vulnerabilities, threat intel indicators + MITRE matrix, audit logs, notifications bell, hunting empty state, and a real CSV export download

### Milestone 2 — ingestion, worker, Demo Mode, realtime (complete)

- [x] Ingestion connector interface (`packages/connectors`): shared `NormalizedEvent`/`DetectionResult` types, RFC3164 syslog parser, hand-rolled RFC4180 CSV parser, pattern-based detection rules engine (3 rules: failed password → T1110/medium, `sudo COMMAND=` → T1548/low, ransomware/malware/trojan keyword → T1486/critical); 14 unit tests
- [x] **Real** ingestion connector #1: syslog UDP listener (`apps/worker`, `node:dgram`), parses each datagram, enqueues onto a BullMQ `ingestion` queue — live-verified end-to-end (packet → `RawEvent` → detection → `Alert`)
- [x] **Real** ingestion connector #2: JSON/CSV multipart upload (`POST /api/v1/ingest/upload`, `@fastify/multipart`, 5MB/1000-row limit) — live-verified via direct multipart POST
- [x] Synthetic "Demo Mode" generator (`apps/worker`): polls the `demo_generator` `IngestionSource.isActive` flag, generates clearly-labeled synthetic syslog-style messages every 4s only while enabled; off by default; toggle via `PATCH /api/v1/hunting/sources/:id` (owner/admin only, audit-logged); live-verified on/off via `RawEvent` count deltas across two polling windows
- [x] BullMQ worker app (`apps/worker`): `ingestion`, `notification-delivery`, `scheduled-reports` queues; a real repeatable `daily-summary` job registered (processor stubbed — no report content generation yet, deferred); notification-delivery processor stubbed (logs intended email/webhook delivery, no real transport — deferred to a later phase)
- [x] WebSocket live push for new alerts/incidents: `GET /ws` (`@fastify/websocket`, cookie-authenticated via the existing session), Redis pub/sub (`soc:realtime` channel) fans events from either process (API for analyst-submitted, worker for ingestion-produced) out to connected clients; frontend `useRealtimeUpdates` hook reconnects with backoff and invalidates the relevant TanStack Query caches — live-verified with a standalone WS client receiving `alert.created` the instant an alert was created, and visually in-browser (new alert appeared in the Alerts table with no manual refresh)
- [x] Resolved an `ioredis` dual-version conflict (`bullmq` pins `5.10.1` exactly; both apps had resolved to `5.11.1`, causing cascading structural type errors) via a root `pnpm.overrides` entry — a root-cause fix rather than per-call-site casts
- [x] Added a real integration test for the worker's `processIngestionJob` (`apps/worker`, against the live local Postgres): benign telemetry produces a `RawEvent` with no alert; telemetry matching the "failed password" rule produces both a `RawEvent` and an `Alert` with the expected severity and MITRE mapping
- [x] Live-verified via Playwright: Hunting page showing real ingested telemetry (syslog rows), Demo Mode enable/disable toggle, and the Alerts page picking up a newly-created alert via the WebSocket push without a manual refresh
- [x] Full workspace verification: `pnpm lint` / `typecheck` / `test` / `build` clean across all 9 packages (apps: api, web, worker; packages: types, ui, auth, database, config, connectors)

## Phase 6 — Advanced Analytics

- [x] New `/api/v1/analytics/*` endpoints, all real Postgres aggregates (Prisma `groupBy` + a few `$queryRaw` `date_trunc`/`EXTRACT` queries for time-bucketing) — no derived/mocked numbers: `alerts-trend`, `heatmap`, `mitre-frequency`, `detection-effectiveness`, `asset-risk`, `timeline`
- [x] Executive analytics dashboard: new `/analytics` page, 5 tabs (Trends, MITRE ATT&CK, Detection Effectiveness, Asset Risk, Attack Timeline) — trends over time, not just the point-in-time counts Overview already had
- [x] Interactive charts via Recharts 3.x (this project never had Chart.js/CDN usage to begin with — Phase 5's dashboard already used hand-rolled severity bars; those stay as-is, Recharts is additive for the new time-series/frequency views)
- [x] Attack timeline visualization: hand-built vertical timeline (not a Recharts type) merging alerts + incidents into one chronologically-sorted feed, severity-colored markers, MITRE tags
- [x] Heatmap: alerts by day-of-week x hour-of-day, hand-built 7x24 grid (Recharts has no heatmap primitive), sequential single-hue ramp, every cell a focusable button with the exact count in its label (color is never the only channel)
- [x] Risk analytics: deterministic 0-100 asset risk score from open vulnerabilities + unresolved alerts (by severity), scaled by the asset's declared criticality — documented formula in `analytics.ts`, not an opaque/ML score
- [x] Threat trend analysis: daily alert volume stacked by severity (7/30/90/180-day presets), real gaps where there's no data rather than interpolated/faked history
- [x] Detection analytics: per-ingestion-source conversion rate (raw events in vs. alerts out) and per-rule effectiveness (grouped by the title/severity each pattern-matching rule produces, honestly scoped to ingestion-sourced alerts only — rules aren't persisted DB entities in this architecture, documented in code)
- [x] Table virtualization (`@tanstack/react-virtual`) applied to the Threat Hunting raw-events table, the one genuinely large/unbounded list in the app (bumped its page-size cap to 500); built as a CSS grid rather than reusing the semantic `<table>` components, since absolutely-positioned virtualized `<tr>`s can't share column widths through the browser's table layout algorithm — caught via Playwright screenshot showing overlapping rows, fixed, re-verified
- [x] Chart color system: categorical 8-hue palette + a blue sequential ramp added as CSS custom properties (light/dark), validated with the dataviz skill's CVD/contrast/lightness-band checker against this app's actual card surfaces (not generic defaults); severity-coded charts reuse the existing `severityBadgeClasses` colors (`severityChartColor` in `@soc/ui`) rather than a second palette
- [x] Added 6 integration tests for the analytics endpoints (`apps/api`, against the real local Postgres) covering trend bucketing, heatmap day/hour extraction, MITRE frequency counting, source conversion-rate math, the asset-risk formula (exact expected score asserted), and timeline chronological merge/sort
- [x] Live-verified via Playwright: all 5 Analytics tabs with real seeded data, the 90-day trend range, and the Hunting page at both 100-row and 500-row page sizes
- [x] Full workspace verification: `pnpm lint` / `typecheck` / `test` / `build` clean across all 9 packages

## Phase 7 — DevSecOps

- [x] **Discovered mid-phase and fixed, not just worked around:** `apps/api`/`apps/worker`'s production path (`build` → `node dist/index.js`) never actually ran — the shared `@soc/*` packages ship as raw TypeScript with no build step, so plain Node couldn't resolve them at runtime (only ever exercised via `tsx`, which understands `.ts` directly). Fixed by switching both apps' `build` script to bundle with esbuild (`packages/config/build-node-app.mjs`), which inlines first-party workspace source and walks the dependency graph to externalize every real npm package (including ones several `@soc/*` packages deep, e.g. `@node-rs/argon2` via `@soc/auth`) so native bindings and dynamic-require mechanisms (Prisma's engine, pino transports, fastify plugin loading) are never touched by the bundler
- [x] Fixed a related dependency-graph misclassification surfaced by the same investigation: `packages/database` declared `@soc/auth` as a production dependency when it's only used by the dev-only seed script — moved to `devDependencies`, and added the still-genuinely-needed transitive runtime deps (`@node-rs/argon2`, `@prisma/client`, `jose`) directly to the apps that actually need them at runtime, since pnpm's strict per-package isolation doesn't hoist a workspace package's own dependencies into a consumer's `node_modules`
- [x] Added `apps/web/next.config.ts` `output: "standalone"` for a self-contained, traced production server bundle
- [x] Multi-stage root `Dockerfile`, three targets (`api`/`worker`/`web`) sharing one `deps`/`build` pipeline via `docker build --target <name>`; all three verified by actually building and running each image against real Postgres/Redis (not just a successful build) — including a full login round-trip (argon2 + JWT + cookies) through the containerized API
- [x] Fixed a real, non-obvious Prisma-in-monorepo bug hit while building the image: `@prisma/client`'s postinstall auto-detects the schema relative to wherever `pnpm install` was invoked from (repo root), not per-workspace-package — it was silently generating a non-functional stub client instead of erroring. Fixed at the root (`package.json#scripts.postinstall` explicitly runs `prisma generate` scoped to `@soc/database`) so it's correct on every fresh install — local dev, CI, and Docker alike — not papered over with a Docker-only workaround
- [x] `pnpm prune --prod` was tried for a leaner runtime image and rejected: it unexpectedly wiped every symlink out of the nested `apps/*/node_modules` in this workspace (a real pnpm quirk under investigation, not a config mistake) — the api/worker images ship the full `build`-stage `node_modules` (devDependencies included) instead, documented as a known tradeoff and a good target for the leaner-image follow-up
- [x] `docker-compose.yml` extended with `api`/`worker`/`web` services behind a `full` Compose profile — plain `docker compose up postgres redis` (the everyday local-dev command used throughout every prior phase) still works untouched; `docker compose --profile full up --build` brings up the entire stack. Verified end-to-end including a Playwright login/render check against the fully containerized platform. `NEXT_PUBLIC_API_URL` is threaded through as a Docker build ARG rather than a container env var, since Next inlines `NEXT_PUBLIC_*` values into the client bundle at build time — a runtime env var would have silently had no effect
- [x] GitHub Actions `ci.yml`: `lint-typecheck` (format/lint/typecheck), `test` (real Postgres+Redis service containers, `prisma migrate deploy`, `pnpm test:coverage`), `build`, and a `docker-build` matrix job building all 3 image targets
- [x] GitHub Actions `security.yml`: CodeQL, Semgrep (community ruleset, no account needed), gitleaks, `pnpm audit --audit-level=high`, a Trivy matrix job scanning all 3 built images, and SBOM generation (Syft → CycloneDX JSON) — CodeQL/Semgrep/Trivy findings all upload as SARIF to GitHub's Security tab
- [x] Coverage: `@vitest/coverage-v8` wired into `apps/api`, `apps/worker`, `packages/auth`, `packages/connectors` with per-package `vitest.config.ts` (scoped `include: ["src/**/*.ts"]` — v8's provider instruments every file touched during a run, including other workspace packages' raw-TS source pulled in transitively, so an unscoped config silently reports the wrong numbers) and conservative threshold gates set below each package's real measured baseline (a regression guard, not a blocker); `ci.yml` uploads the lcov/json-summary reports as a workflow artifact (no external service like Codecov is configured yet — swapping one in later is additive)
- [x] **Found and fixed real vulnerabilities, not just documented them:** `pnpm audit` surfaced a critical arbitrary-file-read in `vitest` <3.2.6 and a high-severity `vite` path-restriction bypass. Fixed by bumping `vitest`/`@vitest/coverage-v8` to `^3.2.6` everywhere and adding root `pnpm.overrides` forcing `vite >= 6.4.3` and `postcss >= 8.5.10` (a transitive Next.js dependency with its own moderate advisory) — `pnpm audit` now reports **zero** known vulnerabilities, down from the Phase 1 baseline of 11
- [x] Branch protection: required status checks documented in `docs/ci-cd.md` (exact job names, which should be required vs. advisory-only initially) — this is a GitHub repository _setting_, not a file, so it cannot be configured from this local-only environment; left as an explicit manual step for whoever pushes and administers the real repo
- [x] `.github/dependabot.yml`: weekly updates across `npm` (whole pnpm workspace, minor/patch grouped to cut noise, majors kept individual), `docker` (base images), and `github-actions` (workflow action versions)
- [x] Full workspace verification: `pnpm lint` / `typecheck` / `test:coverage` / `build` clean across all 9 packages; all 3 Docker images rebuilt and re-verified after the Prisma postinstall fix

## Phase 8 — Infrastructure

- [x] **Discovered and fixed two real production-readiness bugs before writing any K8s manifests, not after:** (1) `GET /ready` on the API always returned `200` regardless of actual dependency health — its own comment said it shouldn't, the code just didn't do it; now runs a real `SELECT 1` against Postgres and pings Redis, returning `503` when the database is unreachable. (2) The worker had no HTTP surface at all for K8s/ECS to probe — added a minimal `node:http` health server (`apps/worker/src/lib/health-server.ts`) checking the same real dependencies.
- [x] **Found and fixed a serious worker crash bug while live-testing the readiness fix**: the Demo Mode supervisor's polling tick and two `queue.add()` call sites had no error handling around their Prisma/BullMQ calls — since they run unawaited on a timer, a rejection (e.g. Postgres blip) became an unhandled promise rejection and **crashed the entire worker process**, taking every queue processor and the syslog listener down with it. Reproduced live (stopped local Postgres, watched the process die with an uncaught `PrismaClientKnownRequestError`), fixed with try/catch + `.catch()` at both sites, re-verified the process now survives and self-recovers with zero restarts once Postgres comes back
- [x] Kubernetes manifests (Deployments, Services, Ingress, ConfigMaps, Secrets) for web/api/worker — delivered as a Helm chart's templates rather than a parallel hand-maintained YAML tree (`helm template` IS the manifests; maintaining both would just be a second copy to keep in sync)
- [x] Helm chart (`deploy/helm/soc-platform`) with environment-specific values files (`values-dev.yaml`, `values-staging.yaml`, `values-prod.yaml`), HPA, ServiceAccount, both `existingSecret` and inline-secret modes, and real liveness/readiness probes wired to the endpoints above
- [x] **Live-verified on a real Kubernetes cluster, not just `helm template`/`helm lint`**: spun up a local `kind` cluster (hit and fixed a real cgroup v1/v2 incompatibility with kind's default node image along the way — pinned to `kindest/node:v1.29.2`), built and loaded all 3 images, deployed real Postgres/Redis fixtures, `helm install`'d the chart, and confirmed: all 3 Deployments reach `1/1 Running`; a full login round-trip (argon2 + JWT + cookies) through a `kubectl port-forward` to the cluster-deployed API; stopping Postgres correctly flips `api`/`worker` pods to `0/1` (not crash-looping) within one failed probe and they self-recover with zero restarts once it's back; a deliberately broken `helm upgrade` (nonexistent image tag) leaves the previous revision's pods serving traffic throughout, and `helm rollback` cleanly restores service
- [x] Fixed a real chart bug caught by that live test: `runAsNonRoot: true` alone caused `CreateContainerConfigError` on every pod, because the Dockerfile's `USER node` is a symbolic name kubelet can't verify as non-root without a numeric UID — added explicit `runAsUser`/`runAsGroup: 1000` (verified against the actual built image, not assumed)
- [x] Terraform reference module (`deploy/terraform`): VPC (community module, 2 AZs, public/private/database subnets), RDS Postgres (encrypted, autoscaling storage), ElastiCache Redis, ECR repositories, ECS Fargate cluster + task definitions + services for all 3 apps, an ALB, an S3 bucket for report artifacts, and IAM roles scoped to exactly what ECS execution needs (image pull, logs, Secrets Manager read) — secrets (DB password, JWT secret) are generated/stored in Secrets Manager, never written to `.tfvars`
- [x] Documented (not silently assumed) a real architectural constraint found while wiring up the ALB: `apps/web` calls the API via an absolute `NEXT_PUBLIC_API_URL` baked into the client bundle at image-build time, not a same-origin relative path — so host-based ALB routing to the API genuinely requires a real domain, and the Terraform module simply doesn't create that listener rule when `domain_name` is unset rather than faking a rule that would never match
- [x] `deploy/terraform` validated with `terraform fmt` / `init` / `validate` (fixed one real provider deprecation warning on the S3 lifecycle rule) and a `terraform plan` that built the complete resource graph and stopped only at "no AWS credentials in this environment" — no config errors, not applied against real AWS (no account available)
- [x] Documented rollback procedure for both paths (`helm rollback` / `aws ecs update-service --task-definition <previous>`) plus an honest discussion of database migration rollback: Prisma migrations are forward-only by convention, so an app rollback only stays safe if migrations followed the expand/contract pattern — documented as a discipline to apply _before_ writing a migration, not a magic `migrate down` that doesn't exist
- [x] `docs/deployment.md` — ties both paths together, states which one to use when, and cross-references `deploy/terraform/README.md` for the AWS-specific push/migrate/deploy sequence

## Phase 9 — Observability

- [x] OpenTelemetry SDK wired into API + worker (traces + metrics) via a plain `.mjs` preload (`apps/{api,worker}/otel/instrumentation.mjs`, loaded with `node --import`, not esbuild-bundled — bundling would inline `fastify`/`ioredis`/etc. before OTel's require-hook patching could intercept them) — `@opentelemetry/auto-instrumentations-node` + `@prisma/instrumentation`, plus a new `packages/observability` package for the metrics auto-instrumentation can't see (WS connections, ingestion lag, queue depth/failures)
- [x] OTel Collector → Prometheus + Tempo pipeline (`deploy/observability/otel-collector`, `.../prometheus`, `.../tempo`) — verified live: brought up the full `--profile full --profile observability` stack, generated real HTTP/WS/ingestion/queue-failure traffic, and confirmed actual trace data in Tempo (fastify HTTP spans, Prisma query spans, ioredis spans) and actual metric data in Prometheus (`http_server_duration_milliseconds_*`, `soc_ws_connections`, `soc_ingestion_lag_milliseconds_*`, `soc_queue_depth`, `soc_queue_job_failures_total`) — exact metric names/labels confirmed against the live stack rather than assumed from docs
- [x] Grafana dashboards (API latency p95, WS connections, ingestion lag, queue depth/failures) — `deploy/observability/grafana/dashboards/*.json`, auto-provisioned, verified rendering real (non-empty) data through Grafana's own datasource proxy, not just directly against Prometheus
- [x] Loki log aggregation for structured Pino logs — Promtail (`deploy/observability/promtail`) discovers containers via the Docker socket and ships stdout to Loki; verified real Pino JSON log lines queryable in Loki with `service`/`container`/`level` labels
- [x] `/health` (liveness) and `/ready` (readiness) endpoints — already satisfied by Phase 8 (`apps/api/src/routes/health.ts`, `apps/worker/src/lib/health-server.ts`)
- [x] Alerting rules for SLO breaches (Prometheus Alertmanager) — `deploy/observability/prometheus/rules/soc-platform-alerts.yml` (API p95 latency, API 5xx rate, ingestion backlog, queue depth, queue failure rate) + `deploy/observability/alertmanager/alertmanager.yml`; confirmed all 5 rules loaded with `health: ok` against the live Prometheus, including one alert (`QueueJobFailuresFiring`) actually observed transitioning off a real injected failure (a deliberately invalid `ingestionSourceId` enqueued straight to Redis to trigger a genuine Prisma FK violation)

## Phase 10 — Testing & Optimization

- [x] Unit tests (Vitest) for business logic across `apps/api` and `packages/*` — `apps/api` coverage went from 70.55%/77%/83.33%/70.55% (stmts/branches/funcs/lines) to 93.45%/78.05%/93.87%/93.45% by adding integration tests for every previously-untested/low-coverage route (see below)
- [x] Integration tests (Supertest + test-container Postgres/Redis) for API routes — implemented via Fastify's own `app.inject()` against the real local Postgres/Redis (the idiomatic Fastify equivalent of Supertest; this repo doesn't use Express) rather than adding a redundant second HTTP-testing layer. Added full CRUD + RBAC test suites for `hunting`, `incidents`, `ingest` (incl. a hand-built multipart body for the file-upload endpoint), `iocs`, `mitre`, `reports`, `users`, `vulnerabilities`, plus filled gaps in the existing `alerts` suite (DELETE was entirely untested) — 92 tests total, up from 39
- [x] Component tests (Testing Library) for shared UI — new `packages/ui` test infra (Vitest + jsdom + `@testing-library/react`), 100% coverage on `SeverityBadge` and `cn()`
- [x] E2E tests (Playwright): login → dashboard → triage alert → resolve incident — `apps/web/e2e/login-to-incident.spec.ts`, running against the real dev servers + real Postgres/Redis (Playwright's `webServer` boots both). **Found and fixed a real race condition**: `apps/web/src/lib/api/client.ts` primed the CSRF cookie via a fire-and-forget `useEffect` — human typing speed always won the race, but Playwright's instant fill+submit didn't, producing a real 403 any sufficiently fast client (autofill, scripted, or just a fast typist) could hit. Fixed by making `apiFetch`/`apiUpload` self-sufficient (await-and-prime-if-missing) rather than relying on the background prime alone.
- [x] Automated accessibility checks (axe via Playwright) in CI — `apps/web/e2e/accessibility.spec.ts`, WCAG 2/2.1 A+AA, scans login + 5 authenticated pages. **Found and fixed a real, spec-accurate a11y bug**: every filter/form `<Select>` across the app (14 instances across 7 files) used Radix's `role="combobox"` trigger with only visually-rendered text and no `aria-label`/associated `<label>` — per WAI-ARIA, `combobox` does not support "accessible name from content", so screen readers announced these controls with no name at all despite sighted users seeing the text fine. Fixed all 14 (aria-label where no visible label exists, `htmlFor`/`id` association where one does). Wired into `ci.yml` as a new `e2e` job (Postgres/Redis service containers, migrate, seed, `playwright install`, `playwright test`)
- [x] Coverage threshold ratcheted toward target — `apps/api` 55/70/75/55 → 90/75/90/90, `apps/worker` 15/25/25/15 → 18/30/30/18, `packages/auth` 75/75/80/75 → 90/85/95/90, `packages/connectors` 85/75/90/85 → 95/78/95/95, `packages/observability` and `packages/ui` → 95/85-90/95/95
- [x] Performance pass: bundle analysis, code-splitting audit, query N+1 audit — bundle analysis via Next 16's native Turbopack analyzer (`next experimental-analyze`; `@next/bundle-analyzer` doesn't support Turbopack and was removed after confirming that) confirmed the one genuinely heavy dependency (`recharts`, 386KB) is already correctly isolated to the `/analytics` route via Next's automatic per-route code splitting — no shared-bundle bloat, no action needed. **Found and fixed a real N+1**: `analytics.ts`'s `detection-effectiveness` endpoint ran one `findFirst` per rule group via `Promise.all` (parallelized, so not slow, but still N round trips) — replaced with a single `findMany` using Prisma's `distinct`
- [x] Lighthouse pass (target ≥ 90 Performance/Accessibility/Best Practices/SEO) — audited the real production build (`output: standalone`, the same artifact the Docker image ships) via the `lighthouse` CLI. Login page: 96/100/96/100 (Performance/Accessibility/Best Practices/SEO) — fixed the one real issue found (`landmark-one-main`: the login page had no `<main>` landmark; the dashboard layout already did). Authenticated dashboard pages are covered by the axe-core Playwright suite above (a more rigorous, page-by-page a11y check than a single Lighthouse run) rather than fighting Lighthouse's session-isolated Chrome instance for a redundant a11y signal.

## Phase 11 — Documentation & Release

- [ ] `README.md` rewritten with accurate, scoped claims
- [ ] `docs/architecture.md`
- [ ] `docs/api.md` (generated OpenAPI + narrative)
- [ ] `docs/database-erd.md` (finalized)
- [ ] `docs/deployment.md` (finalized)
- [ ] `docs/security.md`
- [ ] `docs/ci-cd.md`
- [ ] `CHANGELOG.md`
- [ ] `CONTRIBUTING.md`
- [ ] Production release checklist

---

### Discovered / backlog (not yet phase-assigned)

- [ ] (none yet — add here as work uncovers new tasks)
