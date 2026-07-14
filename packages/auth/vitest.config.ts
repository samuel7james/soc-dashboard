import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: ["**/*.test.ts", "src/index.ts"], // barrel export, no logic of its own
      thresholds: {
        statements: 75,
        branches: 75,
        functions: 80,
        lines: 75,
      },
    },
  },
});
