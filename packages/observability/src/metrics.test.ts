import { metrics } from "@opentelemetry/api";
import {
  MeterProvider,
  MetricReader,
  type CollectionResult,
  type Histogram,
} from "@opentelemetry/sdk-metrics";
import { afterAll, describe, expect, it } from "vitest";

// A reader with no export destination — tests call `.collect()` directly and
// assert on its return value, so nothing needs to actually be exported.
class TestMetricReader extends MetricReader {
  protected async onForceFlush(): Promise<void> {}
  protected async onShutdown(): Promise<void> {}
}

// Registers a real MeterProvider *before* importing the module under test,
// since its instruments are created once at top-level import time from
// whatever global MeterProvider is active.
const reader = new TestMetricReader();
const provider = new MeterProvider({ readers: [reader] });
metrics.setGlobalMeterProvider(provider);

const {
  wsConnectionOpened,
  wsConnectionClosed,
  recordIngestionLag,
  recordQueueJobFailure,
  observeQueueDepth,
} = await import("./metrics.js");

function findMetric(result: CollectionResult, name: string) {
  for (const scope of result.resourceMetrics.scopeMetrics) {
    const metric = scope.metrics.find((m) => m.descriptor.name === name);
    if (metric) return metric;
  }
  return undefined;
}

async function collect(): Promise<CollectionResult> {
  return reader.collect();
}

describe("metrics", () => {
  afterAll(async () => {
    await provider.shutdown();
  });

  it("tracks WebSocket connection count as an up/down counter", async () => {
    wsConnectionOpened();
    wsConnectionOpened();
    wsConnectionClosed();

    const metric = findMetric(await collect(), "soc.ws.connections");
    expect(metric?.dataPoints[0]?.value).toBe(1);
  });

  it("records ingestion lag observations in a histogram", async () => {
    recordIngestionLag(250);

    const metric = findMetric(await collect(), "soc.ingestion.lag");
    const value = metric?.dataPoints[0]?.value as Histogram | undefined;
    expect(value?.count).toBeGreaterThan(0);
  });

  it("counts queue job failures by queue name", async () => {
    recordQueueJobFailure("ingestion");

    const metric = findMetric(await collect(), "soc.queue.job_failures");
    const point = metric?.dataPoints.find((dp) => dp.attributes.queue === "ingestion");
    expect(point?.value).toBe(1);
  });

  it("observes queue depth via an async callback", async () => {
    observeQueueDepth(
      { getJobCounts: () => Promise.resolve({ waiting: 3, active: 1, delayed: 0 }) },
      "notification-delivery",
    );

    const metric = findMetric(await collect(), "soc.queue.depth");
    const point = metric?.dataPoints.find((dp) => dp.attributes.queue === "notification-delivery");
    expect(point?.value).toBe(4);
  });

  it("treats missing job-count fields as zero", async () => {
    observeQueueDepth({ getJobCounts: () => Promise.resolve({ waiting: 2 }) }, "scheduled-reports");

    const metric = findMetric(await collect(), "soc.queue.depth");
    const point = metric?.dataPoints.find((dp) => dp.attributes.queue === "scheduled-reports");
    expect(point?.value).toBe(2);
  });
});
