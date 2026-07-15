import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const OWNER_EMAIL = process.env.SEED_OWNER_EMAIL ?? "owner@soc.local";
const OWNER_PASSWORD = process.env.SEED_OWNER_PASSWORD ?? "ChangeMe123!";

async function scan(page: Page) {
  return (
    new AxeBuilder({ page })
      // WCAG 2 A/AA is the bar this platform targets — axe's "best-practice"
      // rules fire on stylistic opinions with no accessibility standard behind
      // them and would make this check noisy rather than actionable.
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze()
  );
}

test.describe("accessibility", () => {
  test("login page has no WCAG A/AA violations", async ({ page }) => {
    await page.goto("/login");
    const results = await scan(page);
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });

  test("authenticated pages have no WCAG A/AA violations", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(OWNER_EMAIL);
    await page.getByLabel("Password").fill(OWNER_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/overview/);

    for (const path of ["/overview", "/alerts", "/incidents", "/assets", "/vulnerabilities"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const results = await scan(page);
      expect(results.violations, `${path}:\n${JSON.stringify(results.violations, null, 2)}`).toEqual([]);
    }
  });
});
