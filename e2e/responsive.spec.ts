import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const pendingId = "e1000000-0000-4000-8000-000000000001";

const publicPaths = [
  "/",
  "/join",
  "/movement",
  "/campaign-terms",
  "/privacy",
] as const;

const staffPaths = [
  "/auth/login",
  "/admin",
  "/admin/submissions",
  `/admin/submissions/${pendingId}`,
  "/admin/deliveries",
  "/admin/submissions?status=trashed",
  "/admin/team",
  "/admin/settings",
] as const;

const mobileViewports = [
  { width: 320, height: 568 },
  { width: 360, height: 640 },
  { width: 360, height: 800 },
  { width: 375, height: 667 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 393, height: 852 },
  { width: 412, height: 915 },
  { width: 430, height: 932 },
] as const;

async function signInAsAdmin(page: Page) {
  await page.context().addCookies([{
    name: "vriksha-e2e-staff-role",
    value: "admin",
    url: "http://127.0.0.1:3000",
    sameSite: "Lax",
  }]);
}

async function expectNoPageOverflow(page: Page, path: string) {
  let layout: { viewport: number; content: number } | undefined;
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(100);
      layout = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
      }));
      break;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(100);
    }
  }
  if (!layout) throw lastError;
  expect(layout.content, `${path} created page-level overflow`).toBeLessThanOrEqual(layout.viewport);
}

for (const viewport of mobileViewports) {
  test(`public and staff routes fit ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    for (const path of publicPaths) await expectNoPageOverflow(page, path);
    await signInAsAdmin(page);
    for (const path of staffPaths) await expectNoPageOverflow(page, path);
  });
}

for (const viewport of [
  { width: 844, height: 390 },
  { width: 667, height: 375 },
] as const) {
  test(`key flows fit mobile landscape ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await expectNoPageOverflow(page, "/");
    await expectNoPageOverflow(page, "/join");
    await signInAsAdmin(page);
    await expectNoPageOverflow(page, `/admin/submissions/${pendingId}`);
    await expectNoPageOverflow(page, "/admin/deliveries");
  });
}

for (const viewport of [
  { width: 768, height: 1024 },
  { width: 834, height: 1194 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
] as const) {
  test(`key public and staff surfaces fit ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await expectNoPageOverflow(page, "/");
    await expectNoPageOverflow(page, "/join");
    await expectNoPageOverflow(page, "/movement");
    await signInAsAdmin(page);
    await expectNoPageOverflow(page, "/admin/submissions");
    await expectNoPageOverflow(page, "/admin/deliveries");
  });
}
