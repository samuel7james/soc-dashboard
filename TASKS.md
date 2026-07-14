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
- [ ] Remove legacy `api/`, `frontend/`, `backend/` (now under `legacy/`) once Phase 5 reaches feature parity

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

### Milestone 2 — ingestion, worker, Demo Mode, realtime (not started)

- [ ] Ingestion connector interface (`packages/connectors`)
- [ ] **Real** ingestion connector #1: syslog UDP/TCP listener
- [ ] **Real** ingestion connector #2: JSON/CSV upload
- [ ] Synthetic "Demo Mode" generator, clearly labeled in UI, off by default
- [ ] BullMQ worker app (`apps/worker`) for ingestion/report/notification jobs
- [ ] WebSocket live push for new alerts/incidents (room-scoped, authenticated)

## Phase 6 — Advanced Analytics

- [ ] Executive analytics dashboard (trends over time, not just point-in-time counts)
- [ ] Interactive charts (Recharts) replacing all Chart.js/CDN usage
- [ ] Attack timeline visualization
- [ ] Heatmap (e.g. alerts by hour/day, MITRE technique frequency)
- [ ] Risk analytics (asset risk scoring)
- [ ] Threat trend analysis views
- [ ] Detection analytics (rule/source effectiveness)
- [ ] Table virtualization for large datasets (`@tanstack/react-virtual`)

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
