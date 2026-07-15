import { expect, test } from "@playwright/test";

import { API_URL } from "../playwright.config.js";

// Seeded by packages/database/prisma/seed.ts (SEED_OWNER_EMAIL/PASSWORD
// default) — the same account docs/README tell a human to log in with.
const OWNER_EMAIL = process.env.SEED_OWNER_EMAIL ?? "owner@soc.local";
const OWNER_PASSWORD = process.env.SEED_OWNER_PASSWORD ?? "ChangeMe123!";

test("login, triage an alert, and resolve an incident", async ({ page }) => {
  const runId = crypto.randomUUID().slice(0, 8);

  await test.step("log in", async () => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(OWNER_EMAIL);
    await page.getByLabel("Password").fill(OWNER_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/overview/);
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  });

  // There's no "create alert" UI — alerts arrive via ingestion in
  // production — so the fixture is seeded through the real API (same
  // session cookies as the browser) rather than inventing a UI path that
  // doesn't exist. The triage step below is what's actually under test.
  const alertTitle = `E2E triage target ${runId}`;
  await test.step("seed a fixture alert via the API", async () => {
    const cookies = await page.context().cookies();
    const csrfToken = cookies.find((c) => c.name === "csrf_token")?.value ?? "";

    const res = await page.request.post(`${API_URL}/api/v1/alerts`, {
      headers: { "x-csrf-token": csrfToken },
      data: { title: alertTitle, severity: "high" },
    });
    expect(res.ok()).toBeTruthy();
  });

  await test.step("triage the alert from the Alerts queue", async () => {
    await page.getByRole("link", { name: "Alerts" }).click();
    await expect(page).toHaveURL(/\/alerts/);

    const row = page.getByRole("row", { name: new RegExp(alertTitle) });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Alert actions" }).click();
    await page.getByRole("menuitem", { name: "acknowledged" }).click();

    await expect(row.getByText("acknowledged", { exact: false })).toBeVisible();
  });

  const incidentTitle = `E2E incident ${runId}`;
  await test.step("open and resolve an incident", async () => {
    await page.getByRole("link", { name: "Incidents" }).click();
    await expect(page).toHaveURL(/\/incidents/);

    await page.getByRole("button", { name: "New Incident" }).click();
    await page.getByLabel("Title").fill(incidentTitle);
    await page.getByRole("button", { name: "Create" }).click();

    const row = page.getByRole("row", { name: new RegExp(incidentTitle) });
    await expect(row).toBeVisible();
    await row.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(incidentTitle)).toBeVisible();
    await dialog.getByRole("combobox").filter({ hasText: "open" }).click();
    await page.getByRole("option", { name: "resolved" }).click();

    await expect(dialog.getByRole("combobox").filter({ hasText: "resolved" })).toBeVisible();
  });
});
