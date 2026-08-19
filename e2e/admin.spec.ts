import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const pendingId = "e1000000-0000-4000-8000-000000000001";
const recommendedId = "e1000000-0000-4000-8000-000000000002";
const trashedId = "e1000000-0000-4000-8000-000000000003";

async function signInAs(page: Page, role: "reviewer" | "admin") {
  await page.context().addCookies([{ name:"vriksha-e2e-staff-role", value:role, url:"http://127.0.0.1:3000", sameSite:"Lax" }]);
}

test("Reviewer can use the queue, approve, and recommend without Admin access", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await signInAs(page, "reviewer");
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name:"Needs attention" })).toBeVisible();
  await expect(page.getByRole("link", { name:"Trash" })).toHaveCount(0);
  await expect(page.getByRole("link", { name:"Team" })).toHaveCount(0);
  await page.getByRole("link", { name:"Review Queue" }).click();
  await expect(page.getByText("Asha Test")).toBeVisible();
  await expect(page.getByAltText("Private submission preview")).toBeVisible();

  await page.goto(`/admin/submissions/${pendingId}`);
  await expect(page.getByLabel("Public display name")).toBeVisible();
  const detailImage = page.getByAltText("Private submitted photograph preview");
  await expect(detailImage).toBeVisible();
  await expect(detailImage).toHaveAttribute("width", "900");
  await expect(page.getByText("Private original · signed for 10 minutes")).toBeVisible();
  await expect(page.getByRole("group", { name: "Public card focal point" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Choose image focal point" })).toHaveCount(0);
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
  await page.getByRole("button", { name:"Approve and publish" }).click();
  await expect(page.getByText(/Published successfully/i)).toBeVisible();

  await page.goto(`/admin/submissions/${pendingId}`);
  await page.getByLabel("Reason shown to participant").selectOption("image_quality");
  await page.getByLabel("Optional participant guidance").fill("Please submit a clearer generated tree photograph.");
  await page.getByLabel("Internal moderation note").fill("The photograph is too blurred for campaign recognition.");
  await page.getByRole("button", { name:"Recommend Rejection" }).click();
  await expect(page.getByText(/test moderation action completed: recommended/i)).toBeVisible();
  expect(errors).toEqual([]);
});

test("Reviewer is denied a direct Team route", async ({ page }) => {
  await signInAs(page, "reviewer");
  await page.goto("/admin/team");
  await expect(page.getByText("404", { exact:true })).toBeVisible();
});

test("Reviewer is denied deliveries while Admin can operate the Delivery Center", async ({ page }) => {
  await signInAs(page, "reviewer");
  await page.goto("/admin/deliveries");
  await expect(page.getByText("404", { exact:true })).toBeVisible();

  await signInAs(page, "admin");
  await page.goto("/admin");
  await page.getByRole("link", { name:"Deliveries", exact:true }).click();
  await expect(page).toHaveURL(/\/admin\/deliveries$/);
  await expect(page.getByRole("heading", { name:"Deliveries" })).toBeVisible();
  await expect(page.getByRole("heading", { name:"Delivery records" })).toBeVisible();
  await expect(page.getByRole("heading", { name:"Email worker health" })).toBeVisible();
  await expect(page.getByLabel("Status")).toHaveValue("all");
  await expect(page.getByRole("link", { name:"Download" })).toBeVisible();
  await page.getByRole("button", { name:"Send new attempt" }).click();
  await expect(page.getByText(/delivery action completed: email retry/i)).toBeVisible();
  await expect(page.getByRole("heading", { name:"Delivery records" })).toBeVisible();
});

test("Admin can confirm, approve instead, Trash, restore, delete, and manage controls", async ({ page }) => {
  await signInAs(page, "admin");
  await page.goto(`/admin/submissions/${recommendedId}`);
  await expect(page.getByText("participant@example.test")).toBeVisible();
  await page.getByLabel("Reason shown to participant").selectOption("campaign_mismatch");
  await page.getByLabel("Internal moderation note").fill("The image does not match the campaign participation guidelines.");
  await page.getByRole("button", { name:"Confirm Rejection" }).click();
  await expect(page.getByText(/test moderation action completed: rejected/i)).toBeVisible();

  await page.goto(`/admin/submissions/${recommendedId}`);
  await page.getByRole("button", { name:"Approve and publish" }).click();
  await expect(page.getByText(/Published successfully/i)).toBeVisible();

  await page.goto(`/admin/submissions/${pendingId}`);
  await page.getByText("Trash and deletion", { exact: true }).click();
  await page.getByRole("checkbox", { name:/public visibility and count/i }).check();
  await page.getByRole("button", { name:"Move to Trash" }).click();
  await expect(page.getByText(/test moderation action completed: trashed/i)).toBeVisible();

  await page.goto(`/admin/submissions/${trashedId}`);
  await page.getByText("Trash and deletion", { exact: true }).click();
  await page.getByRole("button", { name:"Regenerate and restore publication" }).click();
  await expect(page.getByText(/test moderation action completed: restored/i)).toBeVisible();

  await page.goto(`/admin/submissions/${trashedId}`);
  await page.getByText("Trash and deletion", { exact: true }).click();
  await page.getByLabel("Permanent deletion reason").fill("Delete generated Playwright fixture only.");
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await page.getByRole("button", { name:"Permanently delete" }).click();
  await expect(page).toHaveURL(/status=trashed&testAction=deleted/);

  await page.getByRole("link", { name:"Team" }).click();
  await expect(page.getByRole("heading", { name:"Team" })).toBeVisible();
  await expect(page.getByRole("link", { name:"Campaign Settings" })).toHaveAttribute("href", "/admin/settings");
  await page.goto("/admin/settings");
  await expect(page.getByRole("heading", { name:"Campaign Settings" })).toBeVisible();
  await expect(page.getByRole("link", { name:"Export Campaign Data" })).toBeVisible();
});

test("Campaign Desk has no serious or critical accessibility violations", async ({ page }) => {
  await signInAs(page, "admin");
  await page.goto("/admin");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
});

test("queue text is usable before one batched private thumbnail response", async ({ page }) => {
  const errors: string[] = [];
  const signingRequests: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.route("**/api/admin/review-thumbnails", async (route) => {
    signingRequests.push(route.request().postData() ?? "");
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });
  await signInAs(page, "reviewer");
  await page.goto("/admin/submissions");

  await expect(page.getByText("Asha Test")).toBeVisible();
  const skeleton = page.locator(".admin-thumbnail--skeleton").first();
  await expect(skeleton).toBeVisible();
  const before = await skeleton.boundingBox();
  expect(before?.width).toBe(80);
  expect(before?.height).toBe(100);

  const image = page.getByAltText("Private submission preview");
  await expect(image).toBeVisible();
  const after = await image.boundingBox();
  expect(after?.width).toBe(80);
  expect(after?.height).toBe(100);
  expect(signingRequests).toHaveLength(1);
  expect(signingRequests[0]).not.toContain("original");
  expect(signingRequests[0]).not.toContain("review-thumb");
  const imagePreloads = await page
    .locator('link[rel="preload"][as="image"]')
    .evaluateAll((links) => links.map((link) => ({
      href: (link as HTMLLinkElement).href,
      imageSrcSet: (link as HTMLLinkElement).imageSrcset,
    })));
  expect(imagePreloads).toHaveLength(1);
  expect(decodeURIComponent(JSON.stringify(imagePreloads[0]))).toContain("/brand/mirchi-logo.png");
  expect(errors).toEqual([]);
});

test("broken queue thumbnails fall back and the mobile queue uses contained cards", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAs(page, "admin");
  await page.goto("/admin/submissions?status=rejection_pending_admin");
  await expect(page.getByText("Ravi Test")).toBeVisible();
  await expect(page.getByLabel("Private preview unavailable")).toBeVisible();
  const overflow = await page.evaluate(() => {
    const queue = document.querySelector<HTMLElement>(".admin-queue-panel");
    window.scrollTo({ left: 1000, top: 0, behavior: "instant" });
    return { pageScrollX: window.scrollX, queueOverflow: Boolean(queue && queue.scrollWidth > queue.clientWidth) };
  });
  expect(overflow).toEqual({ pageScrollX: 0, queueOverflow: false });

  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
});

test("mobile Campaign Desk navigation opens as a keyboard-contained drawer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAs(page, "admin");
  await page.goto("/admin");
  const trigger = page.getByRole("button", { name: "Open desk navigation" });
  await trigger.click();
  const drawer = page.getByRole("dialog", { name: "Campaign Desk navigation" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("link", { name: "Campaign Settings" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
