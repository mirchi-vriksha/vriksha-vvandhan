import { expect, test } from "@playwright/test";

test("Movement Wall remains unavailable while the global switch is disabled", async ({ page }) => {
  const response = await page.goto("/movement");
  expect(response?.status()).toBe(404);

  await page.goto("/");
  await expect(page.getByRole("link", { name: "Movement Wall" })).toHaveCount(0);
});

for (const width of [360, 390]) {
  test(`Movement Wall has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/movement");
    const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
  });
}
