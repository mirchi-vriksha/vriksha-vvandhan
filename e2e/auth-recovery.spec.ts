import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const testEmail = "recovery@example.test";
const testPassword = "SafeTestPass123!";

test("staff completes the controlled password recovery and signs in again", async ({ page }) => {
  await page.goto("/auth/login");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();

  await page.getByLabel("Email address").fill(testEmail);
  await page.getByRole("button", { name: "Send password reset link" }).click();
  await expect(page.getByRole("status")).toContainText(
    "If an eligible staff account exists for that email",
  );

  await page.goto(
    "/auth/confirm?token_hash=safe-e2e-recovery-token&type=recovery&next=%2Fauth%2Fset-password",
  );
  await expect(page).toHaveURL(/\/auth\/set-password$/);
  await expect(page.getByRole("heading", { name: "Set a new password" })).toBeVisible();

  await page.getByLabel("New password", { exact: true }).fill(testPassword);
  await page.getByLabel("Confirm new password", { exact: true }).fill(testPassword);
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page).toHaveURL(/\/auth\/login\?password-reset=1$/);
  await expect(page.getByRole("status")).toContainText("Password updated");

  await page.getByLabel("Email address").fill(testEmail);
  await page.getByLabel("Password").fill(testPassword);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
});

test("expired recovery links fail safely", async ({ page }) => {
  await page.goto("/auth/confirm?token_hash=expired-test-token&type=recovery");
  await expect(page).toHaveURL(/\/auth\/login\?recovery-error=1$/);
  await expect(page.locator(".auth-error")).toContainText("invalid or has expired");
  await expect(page.getByRole("link", { name: "Forgot password?" })).toBeVisible();
});

test("set-password requires a verified recovery session", async ({ page }) => {
  await page.goto("/auth/set-password");
  await expect(page).toHaveURL(/\/auth\/login\?recovery-required=1$/);
  await expect(page.locator(".auth-error")).toContainText("fresh password reset link");
});

test("recovery UI is accessible and contained on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/auth/forgot-password");

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? ""),
  )).toEqual([]);
});
