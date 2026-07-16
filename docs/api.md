# API

REST, versioned under `/api/v1`, resource-oriented. The interactive spec is
generated straight from each route's Zod schemas (`@fastify/swagger` +
`fastify-type-provider-zod`'s `jsonSchemaTransform`) — there's no
hand-maintained OpenAPI document to drift out of sync with the code. Run the
API in non-production mode and it's live:

```bash
pnpm --filter @soc/api dev
```

- Swagger UI: <http://localhost:4000/docs>
- Raw OpenAPI 3 JSON: <http://localhost:4000/docs/json>

The docs UI is disabled in production (`NODE_ENV=production`) — the API
surface isn't something to leave discoverable to an anonymous caller in a
real deployment.

At the time of writing this generates **37 documented paths**, verified by
actually starting the API and fetching `/docs/json` rather than counted by
hand from the route files.

## Authentication

Every route except `POST /auth/login`, `POST /auth/refresh`, and `GET
/health`/`/ready` requires a valid session. See
[`docs/security.md`](security.md) for the full auth design (JWT access +
rotating refresh tokens, CSRF, cookies). In short:

1. `GET /csrf` — primes the CSRF cookie (also happens automatically on any
   safe request; `apps/web`'s client makes every mutating call
   self-sufficient rather than depending on a prior call having run).
2. `POST /auth/login` — sets `access_token` (15 min TTL) and a refresh-token
   cookie.
3. Every mutating request (`POST`/`PATCH`/`DELETE`) must echo the
   `csrf_token` cookie's value back in an `X-CSRF-Token` header.
4. `POST /auth/refresh` rotates the refresh token; reusing an already-rotated
   token revokes every session for that user (theft detection).

## Endpoints by resource

| Resource             | Routes                                                                                              | Notes                                                                                                                                                |
| -------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Auth**             | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`, `GET /csrf`          | No public self-registration — accounts are provisioned via `POST /users`.                                                                            |
| **Alerts**           | `GET/POST /alerts`, `GET/PATCH/DELETE /alerts/:id`                                                  | Paginated/filterable (status, severity, assetId, incidentId). MITRE technique IDs replace mappings wholesale on PATCH.                               |
| **Incidents**        | `GET/POST /incidents`, `GET/PATCH/DELETE /incidents/:id`, `POST /incidents/:id/timeline`            | Opening an incident seeds a `note` timeline event; a status change auto-appends a `status_change` event and sets `closedAt` on resolution.           |
| **Assets**           | `GET/POST /assets`, `GET/PATCH/DELETE /assets/:id`                                                  | Paginated/filterable (type, criticality).                                                                                                            |
| **Vulnerabilities**  | `GET/POST /vulnerabilities`, `GET/PATCH/DELETE /vulnerabilities/:id`                                | Setting `status: "remediated"` via PATCH sets `remediatedAt` once, not on every subsequent update.                                                   |
| **IOCs**             | `GET/POST /iocs`, `GET/PATCH/DELETE /iocs/:id`                                                      | `(type, value)` is unique — duplicate submission is a `409`, not a silent upsert.                                                                    |
| **MITRE techniques** | `GET /mitre/techniques`                                                                             | Read-only, seeded reference data; Redis-cached (1h TTL), fails open to Postgres if Redis is down.                                                    |
| **Users**            | `GET/POST /users`                                                                                   | List is any authenticated role (assignee pickers need it); create is owner/admin-only.                                                               |
| **Audit logs**       | `GET /audit-logs`                                                                                   | Owner/admin-only.                                                                                                                                    |
| **Notifications**    | `GET /notifications`, `POST /notifications/:id/read`, `POST /notifications/read-all`                | Server-side hook fires on alert/incident assignment.                                                                                                 |
| **Dashboard**        | `GET /dashboard/summary`                                                                            | Real aggregate counts — no mocked/derived numbers.                                                                                                   |
| **Analytics**        | `GET /analytics/{alerts-trend,heatmap,mitre-frequency,detection-effectiveness,asset-risk,timeline}` | All real Postgres aggregates (`groupBy` + a few `$queryRaw` time-bucketing queries). See below for `detection-effectiveness`'s scope.                |
| **Hunting**          | `GET /hunting/raw-events`, `GET /hunting/sources`, `PATCH /hunting/sources/:id`                     | The `:id` toggle flips an `IngestionSource.isActive` flag — used for both real source management and the Demo Mode on/off switch.                    |
| **Reports**          | `GET /reports/export`                                                                               | On-demand CSV/JSON export (alerts/incidents/vulnerabilities/assets) — real, synchronous, not a persisted `Report` entity with background generation. |
| **Ingest**           | `POST /ingest/upload`                                                                               | Multipart CSV/JSON upload, 5MB / 1000-row limit, queues one ingestion job per row through the same pipeline the syslog listener uses.                |
| **WebSocket**        | `GET /ws`                                                                                           | Cookie-authenticated live push (`alert.created`, `incident.created`) via Redis pub/sub.                                                              |
| **Health**           | `GET /health`, `GET /ready`                                                                         | Liveness vs. readiness — `/ready` runs a real `SELECT 1` + Redis ping, not a hardcoded `200`.                                                        |

## A documented scope boundary: `detection-effectiveness`

`GET /analytics/detection-effectiveness` reports per-rule effectiveness
grouped by the `(title, severity)` pair each detection rule in
`packages/connectors` produces — not by a `ruleId`, because rules aren't
persisted database entities in this architecture (they're pattern-matchers
in code). This is an honest reflection of the actual system, not a stand-in
for a `Rule` table that doesn't exist yet.

## Pagination

Every list endpoint shares the same shape:

```
GET /alerts?page=1&pageSize=25&status=open&severity=high&sortBy=createdAt&sortOrder=desc
```

```json
{ "items": [...], "page": 1, "pageSize": 25, "total": 142 }
```

## Errors

Validation failures (Zod, on request bodies/query strings) return `400`
with a `{ "status": "error", "message": "..." }` body. Auth failures are
`401`; RBAC failures are `403`; not-found is `404`. There's no envelope
inconsistency between routes — every error path goes through the same
Fastify error handler.
