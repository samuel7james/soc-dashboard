import { defineConfig, devices } from "@playwright/test";

const WEB_URL = "http://localhost:3000";
export const API_URL = "http://localhost:4000";

// Runs the real api + web dev servers against the same local Postgres/Redis
// used for everything else in this repo (apps/api/.env) — no mocking, the
// point of E2E coverage here is exercising the actual HTTP + DB round trip.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // shared DB fixtures (seeded users) — parallel specs would race each other
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["html", { open: "never" }], ["github"]] : "list",
  use: {
    baseURL: WEB_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @soc/api dev",
      cwd: "../..",
      url: `${API_URL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: "pipe",
    },
    {
      command: "pnpm --filter @soc/web dev",
      cwd: "../..",
      url: WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: "pipe",
    },
  ],
});
