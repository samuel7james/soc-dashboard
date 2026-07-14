import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: [
        "**/*.test.ts",
        "src/index.ts", // barrel export
        "src/types.ts", // type-only, no runtime logic
        "src/queues.ts", // shared constants/interfaces, no runtime logic
      ],
      thresholds: {
        statements: 85,
        branches: 75,
        functions: 90,
        lines: 85,
      },
    },
  },
});
