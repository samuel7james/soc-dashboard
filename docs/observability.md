# Observability

API and worker are instrumented with [OpenTelemetry](https://opentelemetry.io/)
(traces + metrics), feeding a Grafana LGTM-style stack:

```
apps/api ──┐                          ┌── Tempo (traces)
           ├── OTLP ──▶ OTel Collector ┤
apps/worker┘                          └── Prometheus (metrics, pull-scraped)
                                              │
apps/{api,worker} logs ──▶ Promtail ──▶ Loki  │
                                              ▼
                                          Grafana ◀── Alertmanager ◀── Prometheus alert rules
```

## Instrumentation architecture

`apps/api/otel/instrumentation.mjs` and `apps/worker/otel/instrumentation.mjs`
are deliberately plain `.mjs` files, not TypeScript and not bundled by
esbuild (see `packages/config/build-node-app.mjs`). OpenTelemetry's
auto-instrumentation (`@opentelemetry/auto-instrumentations-node`) works by
patching a package's exports the moment Node loads it via require-hooks —
that only works if the SDK registers its hooks _before_ the app's own
`import "fastify"` (etc.) run. Bundling would inline everything into one
file and defeat this; a regular top-of-file import can't guarantee
patch-before-load ordering under ESM's static import hoisting either. Node's
`--import` preload flag is the mechanism OpenTelemetry's own docs recommend
for this exact reason — see the `dev`/`start` scripts in
`apps/{api,worker}/package.json`.

Auto-instrumentation covers HTTP (fastify), Redis (ioredis), and DNS/TCP for
free. `@prisma/instrumentation` (pinned to the exact installed Prisma
version, same convention as `@prisma/client`/`prisma` elsewhere in this repo)
adds Prisma query spans.

## Custom metrics (`packages/observability`)

Auto-instrumentation can't see application-level state, so
`packages/observability` defines four custom instruments, wired into the
places that own that state:

| Metric                           | Type            | Wired into                                                                    |
| -------------------------------- | --------------- | ----------------------------------------------------------------------------- |
| `soc_ws_connections`             | UpDownCounter   | `apps/api/src/lib/realtime.ts` (WS connect/disconnect)                        |
| `soc_ingestion_lag_milliseconds` | Histogram       | `apps/worker/src/processors/ingestion-processor.ts` (enqueue → process start) |
| `soc_queue_depth`                | ObservableGauge | `apps/worker/src/index.ts` (all three BullMQ queues)                          |
| `soc_queue_job_failures_total`   | Counter         | Each processor's `worker.on("failed", ...)` handler                           |

## Bringing the stack up

```bash
docker compose --profile full --profile observability up --build
```

`api`/`worker` point `OTEL_EXPORTER_OTLP_ENDPOINT` at the collector
unconditionally, even without `--profile observability` — the OTLP exporter
retries/drops silently in the background on a connection failure rather than
crashing the app (the same degrade-gracefully approach already used for a
down Redis).

| Service        | URL                                         | Notes                                   |
| -------------- | ------------------------------------------- | --------------------------------------- |
| Grafana        | http://localhost:3001                       | Anonymous viewer access enabled locally |
| Prometheus     | http://localhost:9090                       |                                         |
| Alertmanager   | http://localhost:9093                       |                                         |
| Tempo          | http://localhost:3200                       | Queried through Grafana, not directly   |
| OTel Collector | http://localhost:4317 (gRPC) / :4318 (HTTP) | OTLP ingest                             |

## Dashboards

Auto-provisioned from `deploy/observability/grafana/dashboards/*.json` into
the "SOC Platform" folder:

- **API Latency** — p50/p95/p99 request duration, latency by method, request rate by status code
- **WebSocket Connections** — currently-open count + time series
- **Ingestion Lag** — p50/p95/p99 time from job enqueue to processing start, job throughput
- **Queue Depth & Failures** — per-queue depth, failure rate, total failures (1h)

## Alerting

`deploy/observability/prometheus/rules/soc-platform-alerts.yml`:

- `APIHighLatencyP95` — p95 HTTP latency > 1s for 5m
- `APIHighErrorRate` — 5xx rate > 5% for 5m
- `IngestionBacklogHigh` — p95 ingestion lag > 10s for 5m
- `QueueDepthHigh` — any queue depth > 500 for 10m
- `QueueJobFailuresFiring` — any non-zero job failure rate for 5m

Alertmanager (`deploy/observability/alertmanager/alertmanager.yml`) handles
routing/grouping/dedup. No outbound notification transport (Slack/email/etc.)
is configured in this environment — same honest-stub approach as the
worker's notification-delivery processor. Wire a real receiver
(`webhook_configs`/`email_configs`) once a transport exists.

## Logs

Promtail (`deploy/observability/promtail`) discovers every container via the
mounted Docker socket and ships stdout to Loki — no per-service log-shipping
config needed. Pino's JSON logs are parsed at scrape time to lift `level`
out as a queryable label (`{service="api"} | json`).

## Live verification performed

This stack was brought up for real, not just written and assumed correct:

- Generated real HTTP traffic, a real login + CSV file upload (exercising
  the actual ingestion pipeline end to end), and a real WebSocket
  connect/disconnect.
- Confirmed real trace data in Tempo: fastify HTTP spans, Prisma query
  spans, and ioredis DNS/TCP spans, from both `soc-api` and `soc-worker`.
- Confirmed real metric data in Prometheus, with exact metric names and
  label sets read back from the live stack rather than assumed from docs —
  e.g. `http_server_duration_milliseconds_bucket` (OTel's HTTP
  instrumentation defaults to the _old_ semantic convention unless
  `OTEL_SEMCONV_STABILITY_OPT_IN` is set) and `soc_queue_job_failures_total`
  (OTel counters gain a `_total` suffix in the Prometheus exporter).
- Deliberately enqueued a job with an invalid `ingestionSourceId` straight
  onto the Redis-backed queue to trigger a genuine Prisma foreign-key
  violation, and confirmed `soc_queue_job_failures_total` incremented for
  real.
- Confirmed all 5 Prometheus alert rules loaded with `health: "ok"`.
- Confirmed Grafana's dashboards render real (non-empty) data by querying
  through Grafana's own datasource proxy, not just directly against
  Prometheus.
- Confirmed real Pino JSON log lines queryable in Loki with correct
  `service`/`container`/`level` labels.
