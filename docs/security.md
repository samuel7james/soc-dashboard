# Security

## Authentication

- **Password hashing:** argon2id (`@node-rs/argon2`), not bcrypt/scrypt —
  the current OWASP-recommended default.
- **Access tokens:** JWT (HS256, `jose`), 15-minute TTL, `httpOnly` +
  `SameSite=lax` cookie.
- **Refresh tokens:** opaque, rotating. The raw token is only ever sent to
  the client in a cookie (`SameSite=strict`, scoped to `/api/v1/auth`); the
  database stores a SHA-256 hash of it, never the raw value — a database
  read alone can't be replayed as a live session. Every refresh **rotates**
  the token; presenting an already-rotated (stolen, replayed) token revokes
  **every** session for that user, not just the one attempt.
- **Login timing:** the login handler runs a real argon2 comparison against
  a dummy hash even when the email doesn't exist, so response timing
  doesn't leak account existence. The error message is the same generic
  "wrong email or password" either way.
- **No public self-registration.** This is an internal security tool, not a
  consumer product — `POST /api/v1/users` is owner/admin-only.

## Authorization

Role-based, four roles: `owner`, `admin`, `analyst`, `read_only`. Enforced
in exactly two places, both server-side:

- `requireAuth` — any authenticated user.
- `requireRole(...roles)` — the caller's role must be in the allowed set.

`read_only` can view everything but mutate nothing. `analyst` can create/
update most resources but not delete or provision users. `owner`/`admin`
can delete and manage users. The frontend's route guards and conditional
rendering are a UX convenience, not the authorization boundary — every
mutating route independently enforces its own role check.

## CSRF

Double-submit cookie pattern: a `csrf_token` cookie (readable by client JS,
not `httpOnly`) must be echoed back in an `X-CSRF-Token` header on every
mutating `/api/v1/*` request, including login itself. A cross-site attacker
can trigger a cookie-bearing request but can't read the cookie to also set
the header.

`apps/web`'s API client (`apps/web/src/lib/api/client.ts`) makes this
self-sufficient: if a mutating call fires before the cookie has been
primed, it awaits a priming request first rather than depending on a
background call having already completed. This was a real bug fixed during
Phase 10 — see [`CHANGELOG.md`](../CHANGELOG.md#testing--optimization).

## Transport & headers

- `helmet` with a strict CSP (`default-src 'self'`, no unpinned CDN
  scripts/styles).
- CORS locked to an explicit origin allowlist (`CORS_ORIGIN`), not `*`.
- Cookies are `secure` in production.

## Rate limiting

`@fastify/rate-limit`: 100 requests/minute globally per IP, tightened to 10/
minute on `POST /auth/login` specifically. Disabled only under
`NODE_ENV=test` so the test suite's own request volume doesn't rate-limit
itself.

## Input validation

Every request body/query string is validated against a Zod schema
(`fastify-type-provider-zod`) before a handler runs — the same schemas that
generate the OpenAPI spec (see [`docs/api.md`](api.md)), so validation and
documentation can't drift apart. Prisma's parameterized queries prevent SQL
injection; there is no raw string-interpolated SQL anywhere in the codebase
(the few `$queryRaw` calls in `analytics.ts` use tagged-template
parameterization, not string concatenation).

## XSS

React's default escaping handles the general case. No `dangerouslySetInnerHTML`
anywhere in `apps/web`. This was a real, live vulnerability in the original
codebase this project replaced (unescaped `innerHTML` interpolation of
server-controlled data) — see [`CHANGELOG.md`](../CHANGELOG.md) for what it
looked like before the rebuild.

## Audit logging

Every privileged action (login, login failure, logout, user creation, and
every create/update/delete on alerts/incidents/assets/vulnerabilities/IOCs/
ingestion sources) writes an immutable `AuditLog` row: actor, action, target
type/id, IP, and a JSON metadata blob with action-specific context. Visible
via `GET /api/v1/audit-logs` (owner/admin-only).

## Secrets management

- `.env`/`.env.local` (gitignored) for local development; `.env.example`
  documents every variable without real values.
- CI secret scanning: `gitleaks` on every push/PR + full git history.
- Production secrets never touch a `.tfvars` file or a committed values
  file — the Terraform path generates/stores them in AWS Secrets Manager;
  the Helm chart's `values.yaml` documents `secret.existingSecret` as the
  recommended mode over inline `secret.values` for anything beyond local
  testing.

## Dependency & supply-chain security

Runs on every push/PR plus a weekly schedule (`security.yml`):

| Check            | Tool                                                                      |
| ---------------- | ------------------------------------------------------------------------- |
| SAST             | CodeQL (native GitHub) + Semgrep (community ruleset)                      |
| Secret scanning  | gitleaks, full history                                                    |
| Dependency vulns | OSV-Scanner against `pnpm-lock.yaml` (see below for why not `pnpm audit`) |
| Container CVEs   | Trivy, matrix over all 3 built images, CRITICAL/HIGH, fails the build     |
| SBOM             | Syft → CycloneDX JSON, uploaded as a build artifact                       |
| Updates          | Dependabot, weekly, all 3 ecosystems (npm/docker/github-actions)          |

CodeQL/Semgrep/Trivy findings all upload as SARIF to GitHub's Security tab —
one place to triage regardless of which tool found something.

**Why OSV-Scanner and not `pnpm audit`:** the npm registry retired the
legacy quick-audit endpoint `pnpm audit` depends on (`pnpm audit` breaks
with a 410 on every pnpm 10.x release; the fix landed in pnpm 11, which
requires Node 22 — too large a runtime bump to force for one CI check).
OSV-Scanner scans the lockfile directly against the OSV.dev database and
isn't affected by that registry change. See
[`docs/ci-cd.md`](ci-cd.md#dependency-audit-baseline) for the full story,
including live verification against this repo's actual lockfile before the
switch.

Baseline: the original codebase's `npm audit` reported 11 vulnerabilities (6
high, 5 moderate) in a 3-dependency project. This codebase reports **zero**
known vulnerabilities as of the last scan.

## Third-party GitHub Actions are pinned to commit SHAs

Not tags. `aquasecurity/trivy-action` and the OSV-Scanner reusable workflow
are both pinned to a specific commit (`# vX.Y.Z` comment for
human-readability), not a mutable tag — a real supply-chain incident
(March 2026, 75 of 76 `trivy-action` tags force-pushed to attempt to steal
CI/CD secrets) is why. A tag can be moved after the fact; a commit SHA
can't. Verified via two independent lookups (GitHub API + `git ls-remote`)
before pinning, each time.

## Container security

- Non-root user (`USER node`) in every runtime image, with an explicit
  numeric `runAsUser`/`runAsGroup: 1000` in the Helm chart (kubelet can't
  verify a symbolic username as non-root without a numeric UID — this was a
  real deploy failure caught during live cluster testing, not assumed).
- Multi-stage builds — build tooling and dev dependencies never reach a
  production image's final layer (aside from the documented
  api/worker `node_modules` tradeoff, see `docs/deployment.md`).
