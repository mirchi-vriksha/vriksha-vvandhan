import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("join page reflects the connected campaign availability and has no console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  const response = await page.goto("/join");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Tie a Rakhi to a Tree" })).toBeVisible();
  await expect(page.getByText("About Vriksha Bandhan")).toBeVisible();
  await expect(page.locator("#how-to-participate")).toContainText("Upload & inspire others");
  const form = page.locator("form.public-submission-form");
  if (await form.count()) {
    await expect(form).toBeVisible();
    await expect(page.getByLabel("Display name")).toBeVisible();
    const instructionBeforeForm = await page.evaluate(() => {
      const instructions = document.querySelector("#submission-instructions");
      const formElement = document.querySelector("form.public-submission-form");
      return Boolean(instructions && formElement && (instructions.compareDocumentPosition(formElement) & Node.DOCUMENT_POSITION_FOLLOWING));
    });
    expect(instructionBeforeForm).toBe(true);
  } else {
    await expect(page.getByRole("heading", { name: /Submissions (are temporarily unavailable|opening soon)\./ })).toBeVisible();
  }
  expect(errors).toEqual([]);
});

for (const width of [320, 360, 375, 390, 430]) {
  test(`join and legal pages have no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    for (const path of ["/join", "/campaign-terms", "/privacy"]) {
      await page.goto(path);
      const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
      }));
      expect(dimensions.content, `${path} overflowed`).toBeLessThanOrEqual(dimensions.viewport);
    }
  });
}

test("campaign terms and privacy routes are linked and keyboard reachable", async ({ page }) => {
  await page.goto("/join");
  const footer = page.getByRole("contentinfo");
  const terms = footer.getByRole("link", { name: "Campaign Terms" });
  const privacy = footer.getByRole("link", { name: "Privacy" });
  await expect(terms).toHaveAttribute("href", "/campaign-terms");
  await expect(privacy).toHaveAttribute("href", "/privacy");

  await terms.focus();
  await expect(terms).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/campaign-terms$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("A clear promise");
});

test("join page has no serious or critical axe violations", async ({ page }) => {
  await page.goto("/join");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? ""),
  )).toEqual([]);
});

test("join page remains readable at 200 percent text size", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/join");
  await page.waitForLoadState("networkidle");
  const layout = await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
    const viewport = document.documentElement.clientWidth;
    return {
      viewport,
      content: document.documentElement.scrollWidth,
      overflowing: Array.from(document.querySelectorAll<HTMLElement>("body *"))
        .filter((element) => {
          const bounds = element.getBoundingClientRect();
          return bounds.right > viewport + 1 || bounds.left < -1 || element.scrollWidth > element.clientWidth + 1;
        })
        .map((element) => ({
          tag: element.tagName,
          className: element.className,
          text: element.textContent?.trim().slice(0, 40),
          left: Math.round(element.getBoundingClientRect().left),
          right: Math.round(element.getBoundingClientRect().right),
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
        })),
    };
  });
  expect(layout.overflowing).toEqual([]);
  expect(layout.content).toBeLessThanOrEqual(layout.viewport);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to the Movement" })).toBeVisible();
});
