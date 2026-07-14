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

- [ ] Multi-stage Dockerfiles per app (web, api, worker)
- [ ] `docker-compose.yml` for full local dev stack (web, api, worker, postgres, redis, optional observability profile)
- [ ] GitHub Actions `ci.yml`: lint, typecheck, unit+integration tests, build
- [ ] GitHub Actions `security.yml`: CodeQL, Semgrep, gitleaks, `pnpm audit`, Trivy image scan, SBOM (Syft/CycloneDX)
- [ ] Coverage report upload + threshold gate
- [ ] Branch protection: required status checks block merge on critical/high findings
- [ ] Dependabot/Renovate config

## Phase 8 — Infrastructure

- [ ] Kubernetes manifests (Deployments, Services, Ingress, ConfigMaps/Secrets) for web/api/worker
- [ ] Helm chart packaging the above, with environment-specific values files (dev/staging/prod)
- [ ] Terraform reference module (AWS: ECS or EKS, RDS Postgres, ElastiCache Redis, S3 for artifacts)
- [ ] Documented rollback procedure (`helm rollback`, migration down-scripts)
- [ ] `docs/deployment.md`

## Phase 9 — Observability

- [ ] OpenTelemetry SDK wired into API + worker (traces + metrics)
- [ ] OTel Collector → Prometheus + Tempo/Jaeger pipeline
- [ ] Grafana dashboards (API latency p95, WS connections, ingestion lag, queue depth/failures)
- [ ] Loki log aggregation for structured Pino logs
- [ ] `/health` (liveness) and `/ready` (readiness) endpoints
- [ ] Alerting rules for SLO breaches (Prometheus Alertmanager)

## Phase 10 — Testing & Optimization

- [ ] Unit tests (Vitest) for business logic across `apps/api` and `packages/*`
- [ ] Integration tests (Supertest + test-container Postgres/Redis) for API routes
- [ ] Component tests (Testing Library) for shared UI
- [ ] E2E tests (Playwright): login → dashboard → triage alert → resolve incident
- [ ] Automated accessibility checks (axe via Playwright) in CI
- [ ] Coverage threshold ratcheted toward target
- [ ] Performance pass: bundle analysis, code-splitting audit, query N+1 audit
- [ ] Lighthouse pass (target ≥ 90 Performance/Accessibility/Best Practices/SEO)

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
