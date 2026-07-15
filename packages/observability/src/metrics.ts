import { metrics } from "@opentelemetry/api";

// Reads the global MeterProvider registered by the OTel SDK preload
// (apps/*/otel/instrumentation.mjs, loaded via `node --import` before any
// app code runs). If no SDK has registered one yet — e.g. under `vitest run`,
// which never loads the preload script — this returns OTel's no-op meter, so
// these calls are always safe to make unconditionally.
const meter = metrics.getMeter("soc-platform");

const wsConnections = meter.createUpDownCounter("soc.ws.connections", {
  description: "Number of currently open WebSocket connections",
});

const ingestionLag = meter.createHistogram("soc.ingestion.lag", {
  description: "Time between a job being enqueued and the worker starting to process it",
  unit: "ms",
});

const queueJobFailures = meter.createCounter("soc.queue.job_failures", {
  description: "Number of BullMQ jobs that failed, by queue name",
});

// One shared instrument with multiple callbacks (one per queue), rather than
// one instrument per queue — OTel merges same-named observable callbacks into
// a single metric stream, differentiated by the `queue` attribute each
// callback reports.
const queueDepth = meter.createObservableGauge("soc.queue.depth", {
  description: "Number of waiting, active, and delayed jobs in a BullMQ queue",
});

export function wsConnectionOpened(): void {
  wsConnections.add(1);
}

export function wsConnectionClosed(): void {
  wsConnections.add(-1);
}

export function recordIngestionLag(lagMs: number): void {
  ingestionLag.record(lagMs);
}

export function recordQueueJobFailure(queueName: string): void {
  queueJobFailures.add(1, { queue: queueName });
}

// Structurally-typed subset of bullmq's `Queue` — avoids a hard dependency on
// bullmq from this shared package for the sake of one method's return shape.
export interface QueueLike {
  getJobCounts(...types: string[]): Promise<Record<string, number>>;
}

export function observeQueueDepth(queue: QueueLike, queueName: string): void {
  queueDepth.addCallback(async (result) => {
    const counts = await queue.getJobCounts("waiting", "active", "delayed");
    const depth = (counts.waiting ?? 0) + (counts.active ?? 0) + (counts.delayed ?? 0);
    result.observe(depth, { queue: queueName });
  });
}
