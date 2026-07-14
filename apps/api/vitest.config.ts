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
        "src/test-utils/**",
      ],
      thresholds: {
        statements: 55,
        branches: 70,
        functions: 75,
        lines: 55,
      },
    },
  },
});
