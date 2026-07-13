# SOC Platform — Project Plan

**Status:** Draft — awaiting approval before implementation begins.
**Prepared:** 2026-07-13

---

## 1. Executive Summary

The current repository ("SOC Dashboard") is a single-page vanilla-JS dashboard backed by an Express server that either shells out to platform-specific Bash scripts or fabricates data with `Math.random()` directly in the API layer. There is no database, no authentication, no tests, no CI/CD, no infrastructure-as-code, and no real telemetry source — the "real-time security scanning" is a client-visible illusion. `npm audit` already reports 11 vulnerabilities (6 high, 5 moderate) in a 3-dependency project.

This plan replaces the entire stack with a TypeScript monorepo delivering a real SIEM/SOC-style platform: a Next.js frontend, a Node/Fastify API, PostgreSQL + Prisma for persistence, Redis for caching/queues, JWT-based auth with RBAC, a pluggable ingestion layer (starting with a clearly-labeled synthetic telemetry generator and real connectors for syslog/JSON/CSV upload), and a full DevSecOps + observability stack (Docker, GitHub Actions, CodeQL/Semgrep/Trivy, Prometheus/Grafana/Loki/OTel).

The rebuild is scoped to be honest about what a single engineer can operate: it will look and behave like commercial SOC software (Sentinel/Defender/Elastic Security-inspired UI, real RBAC, real audit trail, real MITRE ATT&CK mapping, real detection rules engine) without pretending to have a fleet of production EDR sensors it doesn't have.

---

## 2. Current Architecture Review

```text
api/api_server.js      1021 lines — Express app, WebSocket server, cache class,
                        RealTimeScanner class, ~15 endpoints, all in one file
backend/*.sh            6 scripts — bash "monitors" that mostly emit static/
                        templated JSON; only meaningful on native Linux with
                        /var/log/auth.log present (never true on Windows/Docker)
frontend/dashboard.js  1852 lines — one God class (SOCDashboard) doing fetch,
                        DOM manipulation, chart creation, and WS handling
frontend/index.html     443 lines — static markup, all 7 sections in one file
frontend/styles.css    1296 lines — hand-written CSS, no design tokens
data/*.json              generated/sample files, committed inconsistently
```

Key observations:

- **No separation of concerns.** Routing, business logic, data access, and "scanning" simulation all live in one file (`api_server.js`).
- **No real data source.** `generateSampleData()` and `RealTimeScanner.getLive*()` methods return `Math.random()` output. The dashboard's "live threat detection" is cosmetic.
- **Platform-coupled by design.** The server hardcodes a Windows Git-Bash path (`C:\Program Files\Git\bin\bash.exe`) and branches its entire data directory (`/tmp/soc_data` vs `./data`) on `process.platform`.
- **No persistence layer.** State is flat JSON files re-written on every "scan," with no history, no querying, no relational integrity.
- **No auth.** Every API route and the manual/real-time scan controls are open to any caller.
- **No tests, lint config, or CI.** `package.json` has no `test`, `lint`, or `typecheck` scripts.
- **Frontend is a monolith class with 1850 lines**, manual DOM string-building (`innerHTML +=`) for every widget — an XSS vector wherever data is attacker-influenced (IPs, usernames, process names are all interpolated unescaped).

---

## 3. Repository Audit

| Area                | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dead/duplicate code | `generateSampleData()` in `api_server.js` duplicates logic already in `RealTimeScanner`; `ensureRequiredFiles()` duplicates schemas defined a second time inline in the scanner.                                                                                                                                                                                                                                                              |
| Security            | Unescaped `innerHTML` interpolation of server data throughout `dashboard.js` (stored/reflected XSS risk once real, attacker-controlled telemetry — e.g. a username or process name — flows in). `cors()` used with no origin allowlist. No CSP, no security headers (helmet absent). No rate limiting on `/api/scan/run` (trivially abusable). Secrets: none currently present, but no `.env` pattern is established for when they're needed. |
| Performance         | In-memory `Map`-based cache is per-process, not shared — breaks the moment there's more than one server instance. `RealTimeScanner` broadcasts to _all_ WebSocket clients every 10s regardless of whether any client is subscribed/visible, and regenerates full random payloads even with zero listeners.                                                                                                                                    |
| Scalability         | Single Node process, no clustering, no queue, no DB — cannot scale horizontally; JSON-file "storage" is a race condition under concurrent writes.                                                                                                                                                                                                                                                                                             |
| Maintainability     | Two 1000+ line files with no module boundaries; no TypeScript; no strict typing anywhere; inline HTML template strings mixed with logic.                                                                                                                                                                                                                                                                                                      |
| Dependencies        | Only 3 runtime deps (`express`, `cors`, `ws`) — minimal but `npm audit` still reports 11 vulnerabilities (6 high, 5 moderate) via transitive chains (e.g. `body-parser`/`qs`, `ajv`), because lockfile is stale.                                                                                                                                                                                                                              |
| Dead files          | `backend/test_windows.sh` is a manual smoke-test script, not a real test — no assertions, not wired to any CI.                                                                                                                                                                                                                                                                                                                                |
| UI/UX               | Dark theme only via hardcoded hex colors (no theming system); no accessibility semantics (icons with no `aria-label`, color-only severity indication, no keyboard nav for section switching); Chart.js and Font Awesome pulled from public CDNs with no SRI/CSP, which is both a security and an offline-reliability issue.                                                                                                                   |
| Docs                | README oversells the project ("real-time security scanning," "immediate notification of potential security issues") relative to what the code does.                                                                                                                                                                                                                                                                                           |

---

## 4. Technology Review & Proposed Stack

| Layer            | Current                        | Proposed                                                                                                                                                                   | Why                                                                                                                                                        |
| ---------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monorepo         | none                           | pnpm workspaces + Turborepo                                                                                                                                                | Single repo for web/api/packages with cached, parallel builds; industry-standard for TS full-stack in 2026.                                                |
| Frontend         | Vanilla JS, static HTML        | Next.js 15 (App Router) + TypeScript (strict)                                                                                                                              | SSR/streaming for a fast, SEO-irrelevant-but-perf-relevant dashboard; file-based routing matches the multi-section nav already in the app; huge ecosystem. |
| UI kit           | hand-rolled CSS                | Tailwind CSS + shadcn/ui (Radix primitives)                                                                                                                                | Accessible-by-default primitives, fast to theme, matches the "Linear/Vercel-inspired" brief without a bespoke design system build-out.                     |
| Charts           | Chart.js via CDN               | Recharts (primary) + lightweight D3 for the attack-map/heatmap                                                                                                             | React-native charting, no CDN dependency, tree-shakeable.                                                                                                  |
| State/data       | manual `fetch` + globals       | TanStack Query (server cache) + Zustand (UI state)                                                                                                                         | Replaces the hand-rolled `DataCache` class with a battle-tested cache/invalidation layer; avoids prop-drilling.                                            |
| Realtime         | raw `ws` broadcast-to-all      | Socket.IO or native WS behind a pub/sub (Redis) channel, room-scoped per org                                                                                               | Enables multi-instance horizontal scaling later; rooms avoid the "broadcast to everyone" waste.                                                            |
| API              | Express, one file              | Fastify + TypeScript, modular route/plugin structure                                                                                                                       | Faster, first-class schema validation (via Zod/TypeBox), better plugin architecture than Express for this scale.                                           |
| Validation       | none                           | Zod (shared schema package between API and web)                                                                                                                            | Single source of truth for request/response shapes and form validation.                                                                                    |
| ORM/DB           | flat JSON files                | PostgreSQL 16 + Prisma ORM                                                                                                                                                 | Real relational storage for alerts, incidents, assets, IOCs, users, audit logs; migrations, seed data, type-safe queries.                                  |
| Cache/Queue      | in-process `Map`               | Redis (cache) + BullMQ (background jobs: ingestion, report generation, notification fan-out)                                                                               | Shared cache across instances; durable background processing instead of `setInterval`.                                                                     |
| Auth             | none                           | Auth.js (NextAuth) credentials + JWT (access/refresh), argon2 password hashing, RBAC middleware                                                                            | Standard, audited auth flow rather than hand-rolled sessions.                                                                                              |
| Ingestion        | bash scripts / `Math.random()` | Pluggable "connector" interface: (1) synthetic generator clearly labeled _Demo Mode_, (2) syslog UDP/TCP listener, (3) JSON/CSV upload, (4) generic webhook receiver       | Real, honest architecture — extensible to real EDR/log sources without lying about capability.                                                             |
| Containerization | single Dockerfile              | Multi-stage Dockerfiles per app + `docker-compose` for local dev (web, api, postgres, redis)                                                                               | Already partially present; extend to the new services.                                                                                                     |
| Orchestration    | none                           | Kubernetes manifests + Helm chart (optional deploy target)                                                                                                                 | Matches enterprise brief; kept optional/documented since a solo dev may only run Compose day-to-day.                                                       |
| IaC              | none                           | Terraform module(s) for a reference cloud deployment (e.g. AWS: ECS/EKS, RDS, ElastiCache)                                                                                 | Demonstrates infra-as-code competency; documented as reference, not mandatory to run.                                                                      |
| CI/CD            | none                           | GitHub Actions: lint, typecheck, unit+integration tests, build, CodeQL, Semgrep, gitleaks, `npm audit`/`pnpm audit`, Docker build, Trivy image scan, SBOM (Syft/CycloneDX) | Full DevSecOps gate on every PR.                                                                                                                           |
| Observability    | `console.log`                  | Pino structured logging, OpenTelemetry traces/metrics, Prometheus + Grafana dashboards, Loki for log aggregation                                                           | Real observability instead of timestamped `console.log`.                                                                                                   |
| Testing          | none                           | Vitest (unit), Supertest (API integration), Playwright (E2E), Testing Library (component)                                                                                  | Standard modern TS testing stack.                                                                                                                          |

---

## 5. Security Assessment

Current state is effectively **unauthenticated read/write access to every control endpoint**, plus a raw XSS surface. Target-state controls:

- **AuthN/AuthZ:** JWT access + refresh tokens, httpOnly+secure+SameSite cookies, argon2id password hashing, RBAC (Owner/Admin/Analyst/Read-only roles) enforced via API middleware and UI route guards.
- **OWASP Top 10:** parameterized queries via Prisma (SQLi), Zod validation at every boundary (injection/mass-assignment), React's default escaping + explicit sanitization for any raw HTML (XSS), CSRF double-submit token on state-changing requests, `helmet` for security headers, strict CSP (no more unpinned CDN scripts), rate limiting (per-IP and per-user) via `@fastify/rate-limit` + Redis.
- **Secrets management:** `.env` + `.env.example`, secret scanning in CI (gitleaks), no secrets in the repo ever; production secrets via platform secret store (documented for Docker/K8s/Terraform paths).
- **Audit logging:** every privileged action (login, role change, incident status change, manual scan trigger) written to an immutable `AuditLog` table with actor, action, target, timestamp, IP.
- **Dependency hygiene:** Renovate/Dependabot + `pnpm audit` gate in CI; lockfile committed and enforced.
- **Supply chain:** SBOM generated per build, Trivy image scan blocking on critical/high CVEs.

---

## 6. Performance Assessment

- Replace per-process `Map` cache with Redis so cache is shared and survives restarts/scale-out.
- Move "scanning" off a naive `setInterval` broadcast into a queue-driven job (BullMQ) with backoff and idempotency.
- Paginate and index all list endpoints (alerts, IOCs, audit logs) instead of returning unbounded arrays.
- Next.js code-splitting per route/section (the current app ships all 7 sections' DOM and JS in one page load).
- Virtualize long tables (alerts, login events) with `@tanstack/react-virtual`.
- Target Lighthouse ≥ 90 across Performance/Accessibility/Best Practices/SEO on the dashboard shell.

## 7. Scalability Assessment

- Stateless API instances behind a load balancer; all session/cache state in Redis, all durable state in Postgres — horizontal scaling becomes possible (currently impossible due to in-memory cache + in-process scanner).
- Background ingestion/report jobs on BullMQ workers, scalable independently from the API.
- DB read scaling path documented (read replica) though not required at initial scale.

## 8. UI/UX Assessment

- Establish a real design system (tokens for color/spacing/typography) instead of 1300 lines of hand-tuned CSS; dark mode as the default theme with a light-mode toggle built on the same tokens.
- Replace manual `innerHTML` list-building with componentized, typed React components (`AlertCard`, `IncidentTable`, `ThreatMap`, etc.).
- Add empty/loading/error states consistently (currently ad hoc per widget).

## 9. Accessibility Assessment

- Current app: icon-only buttons with no `aria-label`, severity communicated by color alone, no visible focus states, no skip-link, table markup present but no `scope`/`caption`.
- Target: shadcn/ui (Radix) primitives for correct ARIA out of the box, WCAG 2.1 AA color contrast validated in the design system, severity communicated by icon+text+color, full keyboard navigation for section switching and tables, automated a11y checks (axe) in CI via Playwright.

---

## 10. Proposed Architecture

````text
                       ┌───────────────────────────┐
                       │        Next.js Web         │  (apps/web)
                       │  App Router · RSC · TanStack│
                       │  Query · Zustand · Tailwind │
                       └───────────┬────────────────┘
                                   │ HTTPS / WSS
                       ┌───────────▼────────────────┐
                       │        Fastify API          │  (apps/api)
                       │  REST + WS · Zod validation  │
                       │  RBAC middleware · Pino logs │
                       └───┬───────────────┬─────────┘
                           │               │
                 ┌─────────▼───┐   ┌───────▼────────┐
                 │  PostgreSQL │   │      Redis       │
                 │  (Prisma)   │   │ cache/pubsub/queue│
                 └─────────────┘   └───────┬──────────┘
                                            │
                                   ┌────────▼─────────┐
                                   │  BullMQ Workers    │  (apps/worker)
                                   │  ingestion · alerts │
                                   │  reports · notifs   │
                                   └────────┬────────────┘
                                            │
                       ┌────────────────────▼────────────────────┐
                       │           Ingestion Connectors            │
                       │  synthetic generator (Demo Mode) · syslog │
                       │  listener · JSON/CSV upload · webhook     │
                       └────────────────────────────────────────────┘

Cross-cutting: OpenTelemetry → Prometheus/Grafana/Loki · GitHub Actions CI/CD ·
Docker/Compose (dev) · Kubernetes+Helm / Terraform (reference prod deploy)
```text

## 11. Proposed Folder Structure

````

soc-platform/
├── apps/
│ ├── web/ # Next.js frontend
│ ├── api/ # Fastify API server
│ └── worker/ # BullMQ background workers (ingestion, reports, notifications)
├── packages/
│ ├── database/ # Prisma schema, migrations, seed scripts
│ ├── types/ # Shared Zod schemas + inferred TS types
│ ├── ui/ # Shared shadcn/ui-based component library
│ ├── config/ # Shared eslint/tsconfig/tailwind config
│ └── connectors/ # Ingestion connector interface + implementations
├── infra/
│ ├── docker/ # Dockerfiles per app
│ ├── k8s/ # Kubernetes manifests
│ ├── helm/ # Helm chart
│ └── terraform/ # Reference cloud IaC
├── .github/workflows/ # CI/CD pipelines
├── docs/ # Architecture, API, deployment, security docs
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
└── package.json

```

## 12. Database Design (high level)

Core tables: `User`, `Role`, `Session`, `Organization` (single-tenant now, schema tenant-ready), `Alert`, `Incident`, `IncidentTimelineEvent`, `Asset`, `Vulnerability`, `IOC` (indicator of compromise), `ThreatActor`, `MitreTechnique` (seeded reference data), `AlertMitreMapping`, `AuditLog`, `Notification`, `Report`, `IngestionSource`, `RawEvent` (normalized telemetry landing table). Relational integrity replaces today's flat, uncorrelated JSON files. Full ERD to be produced as part of Phase 4 deliverables (`docs/database-erd.md`).

## 13. API Design (high level)

- REST, versioned under `/api/v1`, resource-oriented: `/alerts`, `/incidents`, `/assets`, `/vulnerabilities`, `/iocs`, `/mitre/techniques`, `/audit-logs`, `/reports`, `/users`, `/auth/*`.
- All list endpoints: pagination (`?page`,`?pageSize`), filtering, sorting — none of which exist today.
- WebSocket channel `/ws` for live alert/incident push, authenticated via short-lived token, room-scoped.
- OpenAPI spec generated from Zod schemas (via `@fastify/swagger` + `zod-to-openapi`) — replaces the current undocumented endpoint list in the README.

## 14. DevSecOps Strategy

Every PR runs: ESLint, TypeScript check, unit + integration tests, build, CodeQL, Semgrep, gitleaks (secret scanning), `pnpm audit`, Docker build, Trivy image scan, SBOM generation, coverage report upload. Branch protection requires these to pass before merge (critical/high findings block).

## 15. Infrastructure Strategy

- **Local/dev:** `docker-compose up` — web, api, worker, postgres, redis, plus optional Grafana/Prometheus/Loki profile.
- **Staging/Prod (reference):** Kubernetes via Helm chart; Terraform module for a reference AWS deployment (ECS or EKS, RDS Postgres, ElastiCache Redis, S3 for report/artifact storage). Documented as a reference path — not required for the platform to be useful locally.
- **Rollback:** Helm release history / `helm rollback`; DB migrations forward-only with down-migration scripts documented per Prisma migration.

## 16. CI/CD Strategy

GitHub Actions: `ci.yml` (lint/typecheck/test/build on every push+PR), `security.yml` (CodeQL/Semgrep/Trivy/SBOM on PR + nightly schedule), `release.yml` (tag-triggered Docker build+push+deploy). Required status checks enforced via branch protection.

## 17. Testing Strategy

- Unit: Vitest for pure logic (detection rule evaluation, MITRE mapping, utils) in `packages/*` and `apps/api`.
- Integration: Supertest against a real (test-container) Postgres+Redis for API routes.
- Component: Testing Library for shared UI components.
- E2E: Playwright covering login → view dashboard → triage alert → resolve incident happy path, plus a11y assertions (axe).
- Coverage threshold enforced in CI (target ≥ 70% to start, ratcheted up over time).

## 18. Observability Strategy

- Structured JSON logs (Pino) shipped to Loki.
- OpenTelemetry SDK in API/worker for traces + metrics, exported to an OTel Collector → Prometheus (metrics) and Tempo/Jaeger (traces) — Grafana as the single pane of glass.
- `/health` and `/ready` endpoints (liveness vs readiness) replacing today's single `/api/health`.
- SLO dashboard: p95 API latency, WS connection count, ingestion lag, job queue depth/failures.

## 19. Documentation Plan

`README.md` (accurate, scoped claims), `docs/architecture.md`, `docs/api.md` (generated OpenAPI + narrative), `docs/database-erd.md`, `docs/deployment.md`, `docs/security.md`, `docs/ci-cd.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, per-phase completion notes.

## 20. Feature Roadmap (product surface)

Executive Dashboard · Alerts queue & triage · Incident management (case notes, timeline, assignment, status workflow) · Threat Intelligence feed + IOC management · Asset Inventory · Vulnerability Management · MITRE ATT&CK matrix mapping · Threat Hunting query interface · Auth/Audit logs · Reporting (scheduled + on-demand PDF/CSV export) · Notifications (in-app + email/webhook) · RBAC administration.

## 21. Sprint / Phase Roadmap

Maps 1:1 to `TASKS.md` phases 1–11 below. Each phase is a stop-and-approve gate per the workflow rules — no phase starts until the prior one is explicitly approved.

## 22. Estimated Complexity

| Phase                     | Complexity  | Notes                                               |
| ------------------------- | ----------- | --------------------------------------------------- |
| 1 Audit & Planning        | Low         | This document.                                      |
| 2 Foundation              | Medium      | Monorepo, design system, routing/state scaffolding. |
| 3 Auth & Security         | Medium-High | Correctness-critical; get this right once.          |
| 4 Database & Backend      | High        | Schema design + full CRUD API surface.              |
| 5 Core SOC Features       | High        | Largest phase — most product surface area.          |
| 6 Advanced Analytics      | Medium      | Builds on Phase 5 data model.                       |
| 7 DevSecOps               | Medium      | Mostly config/pipeline authoring.                   |
| 8 Infrastructure          | Medium-High | K8s/Helm/Terraform breadth, low iteration depth.    |
| 9 Observability           | Medium      | Well-trodden stack, mostly wiring.                  |
| 10 Testing & Optimization | High        | Retrofitting coverage across everything built.      |
| 11 Docs & Release         | Low-Medium  | Consolidation.                                      |

## 23. Risks

- **Scope size vs. solo maintenance.** Full enterprise breadth (K8s+Helm+Terraform+full observability stack) is a lot to operate alone long-term.
- **Ingestion honesty.** Risk of quietly sliding back into fake/random "live" data if real connectors aren't prioritized early.
- **Auth correctness.** Hand-rolled or misconfigured JWT/RBAC is a common source of real vulnerabilities.
- **Migration risk.** Full rewrite means the existing (limited) working demo is offline until Phase 5 lands something usable end-to-end.

## 24. Mitigation Strategies

- Treat Phases 8–9 (K8s/Terraform/full observability) as **documented reference implementations** the platform doesn't strictly require for day-to-day local use — keeps solo operability realistic while still satisfying the enterprise brief.
- Phase 5 explicitly requires at least one real, non-random ingestion path (syslog listener or file upload) before "Demo Mode" synthetic data is wired in, and Demo Mode is always visibly labeled in the UI.
- Auth phase gets its own dedicated test suite (session fixation, token expiry/refresh, RBAC boundary tests) before Phase 4 builds on top of it.
- Keep `main` deployable: work happens on feature branches per phase, merged only when that phase's completion criteria (build/lint/type/test green) are met.

## 25. Future Improvements (post-Phase-11)

Multi-tenant organizations, SSO/SAML, SOAR-style automated playbooks, real EDR agent (osquery-based) for genuine host telemetry, mobile-responsive companion app, AI-assisted alert triage/summarization.

---

**Next step:** review this plan and `TASKS.md`, then approve to begin Phase 2. No implementation will start before that approval.
```
