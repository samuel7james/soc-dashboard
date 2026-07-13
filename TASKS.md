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

- [ ] Prisma `User`, `Role`, `Session` models (design, in `packages/database`)
- [ ] Auth.js (NextAuth) credentials provider + JWT access/refresh flow
- [ ] Argon2id password hashing
- [ ] RBAC roles (Owner/Admin/Analyst/Read-only) + permission matrix
- [ ] API middleware: authentication guard + role-based authorization guard
- [ ] Protected route wrapper on frontend (redirect unauthenticated users)
- [ ] CSRF protection (double-submit token) on state-changing requests
- [ ] Secure cookies (httpOnly, secure, SameSite)
- [ ] Security headers via `helmet` + strict CSP (remove unpinned public CDNs)
- [ ] Rate limiting (`@fastify/rate-limit` + Redis) on auth and scan/report-trigger endpoints
- [ ] `AuditLog` model + write-path for all privileged actions
- [ ] Auth test suite: login/logout, token refresh/expiry, RBAC boundary tests, session fixation checks

## Phase 4 — Database & Backend

- [ ] Full Prisma schema: `Alert`, `Incident`, `IncidentTimelineEvent`, `Asset`, `Vulnerability`, `IOC`, `ThreatActor`, `MitreTechnique`, `AlertMitreMapping`, `Notification`, `Report`, `IngestionSource`, `RawEvent`
- [ ] Migrations authored and applied
- [ ] Seed data (MITRE ATT&CK technique reference set, demo org/users/sample alerts)
- [ ] REST API v1: CRUD for alerts, incidents, assets, vulnerabilities, IOCs, users
- [ ] Pagination/filtering/sorting on all list endpoints
- [ ] Zod request/response validation on every route
- [ ] Centralized error handling + typed error responses
- [ ] Structured logging (Pino) replacing `console.log`
- [ ] OpenAPI spec generation (`@fastify/swagger` + `zod-to-openapi`)
- [ ] Redis integration: shared cache layer replacing in-process `Map`
- [ ] `docs/database-erd.md` generated

## Phase 5 — Core SOC Platform

- [ ] Executive Dashboard (real aggregate queries, not random data)
- [ ] Alerts queue + triage workflow (assign, acknowledge, resolve, false-positive)
- [ ] Incident Management (create from alert(s), timeline, notes, assignment, status workflow)
- [ ] Threat Intelligence feed view + IOC CRUD/search
- [ ] Asset Inventory (CRUD, criticality tagging)
- [ ] Vulnerability Management (CRUD, severity, linked assets)
- [ ] MITRE ATT&CK mapping UI (matrix view, alert→technique linkage)
- [ ] Threat Hunting query interface (structured query over `RawEvent`)
- [ ] Auth/Audit Logs viewer (searchable, filterable)
- [ ] Reports (on-demand generation; scheduled generation via worker)
- [ ] Notifications (in-app; email/webhook via worker)
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
