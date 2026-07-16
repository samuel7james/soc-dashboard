# Production release checklist

This is a concrete checklist for taking this platform from "runs locally" to
"serving real traffic," written from the real constraints discovered while
building [`deploy/helm`](../deploy/helm) and [`deploy/terraform`](../deploy/terraform)
— not generic boilerplate. See [`docs/deployment.md`](deployment.md) for the
two supported deployment paths.

## Before the first deploy

- [ ] **Generate real secrets** — `JWT_ACCESS_SECRET` (32+ random bytes,
      e.g. `openssl rand -base64 48`), a real `DATABASE_URL`/`REDIS_URL`.
      Never reuse the `dev-only-insecure-default-*` values `docker-compose.yml`
      and the Helm chart fall back to for local convenience.
- [ ] **Set `CORS_ORIGIN`** to the real web origin(s), comma-separated if
      more than one. This is an allowlist, not a wildcard — a mismatch here
      manifests as every mutating request failing CORS in the browser
      console, not a clear server-side error.
- [ ] **Set `NEXT_PUBLIC_API_URL` as a Docker build ARG, not a runtime env
      var.** Next.js inlines `NEXT_PUBLIC_*` values into the client bundle
      at build time — setting it as a container-runtime env var on an
      already-built `web` image silently has no effect. Rebuild the image
      if this value changes.
- [ ] **Choose a secrets delivery mode and don't use the other one:** Helm's
      `secret.existingSecret: <name>` (recommended — point it at a secret
      your cluster's external-secrets/sealed-secrets tooling manages) over
      inline `secret.values.*`; Terraform generates and stores secrets in
      AWS Secrets Manager automatically, never in `.tfvars`.
- [ ] **Confirm `NODE_ENV=production`** on api/worker — this disables the
      `/docs` Swagger UI (the API surface shouldn't be discoverable to an
      anonymous caller in production) and switches Pino to non-pretty JSON
      output.

## Database

- [ ] **Apply migrations before the new app version receives traffic**,
      not as part of the app's own startup — `prisma migrate deploy`,
      run once per deploy (see `docs/deployment.md`'s Kubernetes/Terraform
      sections for the exact command per path). Neither deploy path runs
      migrations automatically on pod/task start, by design — a migration
      is a distinct, auditable step.
- [ ] **Seed reference data on first deploy only** —
      `pnpm --filter @soc/database db:seed` is idempotent (safe to re-run),
      but only needs to run once to populate MITRE ATT&CK reference data and
      the initial owner account. Rotate that owner account's password
      immediately after first login in a real environment
      (`SEED_OWNER_PASSWORD` is a labeled dev-only default).
- [ ] **If a migration is going to ship alongside an app rollback path**,
      follow the expand/contract pattern — see
      [`docs/deployment.md`](deployment.md#database-migration-rollback--the-honest-version).
      Prisma migrations are forward-only; there is no generated down-script.

## Observability

- [ ] **Bring up the observability profile**
      (`docker compose --profile observability up` locally, or the
      equivalent Collector/Prometheus/Tempo/Loki/Grafana deployment in your
      target environment) _before_ cutting real traffic over — you want
      dashboards and alerting live from the first request, not retrofitted
      after an incident.
- [ ] **Point Alertmanager at a real notification channel.** It ships with
      no outbound transport configured (an honest stub, not a fake
      integration) — wire a real `webhook_configs`/`email_configs`
      receiver in `deploy/observability/alertmanager/alertmanager.yml`
      before relying on it.
- [ ] **Verify `/health` and `/ready` are wired to your platform's
      liveness/readiness probes**, not just one combined check — `/health`
      means "process is alive," `/ready` means "dependencies are reachable"
      and returns `503` when they're not (verified live: see
      `docs/deployment.md`).

## CI/CD

- [ ] **Configure branch protection** on `main` (a GitHub repository
      setting, not something this repo can configure for you) — see
      [`docs/ci-cd.md`](ci-cd.md#branch-protection-manual--requires-github-repo-admin-access)
      for the exact required-checks list. Confirm the check names in the
      Actions tab after the workflows have run at least once; a reusable
      workflow's job can report under a name that doesn't exactly match
      the file that defines it.
- [ ] **Confirm the security scan baseline is clean** — `security.yml`'s
      OSV-Scanner/Trivy/CodeQL/Semgrep jobs should all be green before the
      first production deploy, not left to catch up after.

## Post-deploy verification

Don't trust a green CI run alone — do this against the real deployed
environment once, the same way every phase of this project's own build
verified against a real running system rather than assumed-correct config:

- [ ] Real login round-trip (not a health-check-only smoke test).
- [ ] Confirm a mutating request succeeds (CSRF + CORS both correctly
      configured) — a login success alone doesn't exercise CSRF.
- [ ] Confirm `/ready` reflects real dependency state — the cheapest way is
      to watch it briefly during the database's own health-check window
      after a fresh deploy.
- [ ] Confirm traces/metrics/logs are actually arriving in your
      observability stack for this environment specifically, not just
      that the collector accepted a connection.
- [ ] Confirm the WebSocket channel (`/ws`) actually delivers a live push —
      a reverse proxy/load balancer sitting in front of the API needs
      WebSocket upgrade support explicitly enabled; this is a common gap
      that a plain HTTP health check won't surface.
