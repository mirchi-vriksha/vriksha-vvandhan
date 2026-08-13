import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("Movement Wall renders an honest count and safe empty state", async ({ page }) => {
  const response = await page.goto("/movement");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "A Wall of Gratitude" })).toBeVisible();
  await expect(page.getByText("Together, they create Mumbai’s growing wall of gratitude.")).toBeVisible();
  await expect(page.getByText("No moments of gratitude are public yet.")).toBeVisible();
  await expect(page.locator(".movement-page__count strong")).toHaveText(/^(—|\d+)$/);
});

for (const width of [360, 390]) {
  test(`Movement Wall has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/movement");
    const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
  });
}

test("Movement Wall has no serious or critical axe violations", async ({ page }) => {
  await page.goto("/movement");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
});
