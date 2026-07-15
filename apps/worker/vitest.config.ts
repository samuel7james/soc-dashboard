import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      // v8 instruments every file touched during the run, including other
      // workspace packages' raw-TS source pulled in transitively (@soc/*)
      // and config files — scope strictly to this package's own src/.
      include: ["src/**/*.ts"],
      exclude: [
        "**/*.test.ts",
        "src/index.ts", // process bootstrap — exercised by live-verification, not unit tests
      ],
      // Low on purpose for now: most of this app is queue/network wiring
      // (listeners, processors, the demo generator) that's covered by live
      // end-to-end verification rather than unit tests. Only the pure
      // business logic (ingestion-service) is unit-tested today. Raise this
      // as more of that wiring gets integration-tested (Phase 10).
      thresholds: {
        statements: 18,
        branches: 30,
        functions: 30,
        lines: 18,
      },
    },
  },
});
