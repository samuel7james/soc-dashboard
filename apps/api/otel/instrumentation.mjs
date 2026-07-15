// Loaded via `node --import ./otel/instrumentation.mjs dist/index.js` — NOT
// bundled into dist/index.js by esbuild (see packages/config/build-node-app.mjs).
// OpenTelemetry's auto-instrumentation works by patching a package's exports
// the moment Node loads it; that only works if this SDK registers its hooks
// before the app's own `import "fastify"` etc. run. A regular top-of-file
// import inside the bundled app code can't guarantee that under ESM's static
// import hoisting — Node's `--import` preload flag is the mechanism OTel's
// own docs recommend for this exact reason.
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { PrismaInstrumentation } from "@prisma/instrumentation";

const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318";
const serviceName = process.env.OTEL_SERVICE_NAME ?? "soc-api";

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: process.env.npm_package_version ?? "0.0.0",
  }),
  traceExporter: new OTLPTraceExporter({ url: `${otlpEndpoint}/v1/traces` }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({ url: `${otlpEndpoint}/v1/metrics` }),
    exportIntervalMillis: 15000,
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      // Every fs call becomes a span otherwise — pure noise, no diagnostic value.
      "@opentelemetry/instrumentation-fs": { enabled: false },
    }),
    new PrismaInstrumentation(),
  ],
});

sdk.start();

async function shutdown() {
  await sdk.shutdown().catch((error) => {
    console.error("Error shutting down OpenTelemetry SDK", error);
  });
}

process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
