import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("homepage loads without browser console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  const response = await page.goto("/");

  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Vriksha Bandhan");
  await expect(page.locator(".campaign-hero__tagline")).toHaveText(
    "It’s time to protect the protector.",
  );
  await expect(page.getByText(/Vriksha Vvandhan/i)).toHaveCount(0);
  await expect(page.getByText("This Raksha Bandhan", { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("homepage uses the warm campaign canvas and transparent rakhi ornament", async ({ page }) => {
  await page.goto("/");

  const surfaces = await page.evaluate(() => {
    const hero = document.querySelector<HTMLElement>(".campaign-hero");
    const tracker = document.querySelector<HTMLElement>(".rakhi-counter");
    const ornament = document.querySelector<HTMLImageElement>(".rakhi-counter__ornament");

    if (!hero || !tracker || !ornament) throw new Error("Required campaign surfaces are missing");

    return {
      body: getComputedStyle(document.body).backgroundColor,
      hero: getComputedStyle(hero).backgroundColor,
      heroImage: getComputedStyle(hero).backgroundImage,
      ornamentAlt: ornament.alt,
      ornamentLoaded: ornament.complete && ornament.naturalWidth > 0,
      trackerText: tracker.textContent,
    };
  });

  expect(surfaces.body).toBe("rgb(248, 247, 243)");
  expect(surfaces.hero).toBe("rgb(250, 248, 242)");
  expect(surfaces.heroImage).toContain("radial-gradient");
  expect(surfaces.ornamentAlt).toBe("");
  expect(surfaces.ornamentLoaded).toBe(true);
  expect(surfaces.trackerText).toContain("983");
});

test("homepage provides concise navigation and keeps both hero journeys", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");

  await expect(page.locator(".site-header")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();

  await page.locator(".campaign-hero").getByRole("link", { name: "How It Works" }).click();
  await expect(page).toHaveURL(/\/join#how-to-participate$/);
  await expect(page.locator("#how-to-participate")).toBeInViewport();

  await page.goto("/");
  await page.locator(".campaign-hero").getByRole("link", { name: "Tie a Rakhi to a Tree" }).click();
  await expect(page).toHaveURL(/\/join$/);
});

test("desktop identity is centered in its campaign column and the reel joins the first viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const logo = await page
    .locator(".campaign-hero")
    .getByRole("img", { name: "Mirchi", exact: true })
    .boundingBox();
  const identity = await page.locator(".campaign-hero__identity").boundingBox();
  const reel = await page.locator(".promise-ribbon__viewport").boundingBox();
  expect(logo).not.toBeNull();
  expect(identity).not.toBeNull();
  expect(reel).not.toBeNull();
  expect(Math.abs((logo!.x + logo!.width / 2) - (identity!.x + identity!.width / 2))).toBeLessThan(3);
  expect(reel!.y).toBeLessThan(900);
});

for (const width of [320, 360, 375, 390, 430]) {
  test(`homepage has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width <= 360 ? 800 : 932 });
    await page.goto("/");

    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));

    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
  });
}

test("mobile hero follows the intentional identity, image, counter order", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const identity = await page.locator(".campaign-hero__identity").boundingBox();
  const media = await page.locator(".hero-media").boundingBox();
  const counter = await page.locator(".rakhi-counter").boundingBox();
  expect(identity).not.toBeNull();
  expect(media).not.toBeNull();
  expect(counter).not.toBeNull();
  expect(media!.y).toBeGreaterThan(identity!.y + identity!.height);
  expect(counter!.y).toBeGreaterThan(media!.y + media!.height);
});

test("hero stays stacked on portrait tablet and becomes image-left on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/");

  const tabletCopy = await page.locator(".campaign-hero__identity").boundingBox();
  const tabletMedia = await page.locator(".hero-media").boundingBox();
  expect(tabletCopy).not.toBeNull();
  expect(tabletMedia).not.toBeNull();
  expect(tabletMedia!.y).toBeGreaterThan(tabletCopy!.y + tabletCopy!.height);

  await page.setViewportSize({ width: 1024, height: 768 });
  const desktopCopy = await page.locator(".campaign-hero__identity").boundingBox();
  const desktopMedia = await page.locator(".hero-media").boundingBox();
  expect(desktopCopy).not.toBeNull();
  expect(desktopMedia).not.toBeNull();
  expect(desktopMedia!.x).toBeLessThan(desktopCopy!.x);
  expect(desktopCopy!.x).toBeGreaterThan(desktopMedia!.x + desktopMedia!.width);
});

test("hero remains usable at a 200 percent layout-equivalent viewport", async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 900 });
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator(".hero-media__frame")).toBeVisible();
  await expect(
    page.locator(".campaign-hero").getByRole("link", { name: "Tie a Rakhi to a Tree" }),
  ).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
});

test("Promise Ribbon scrolls internally without expanding the page", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const ribbon = page.locator(".promise-ribbon__viewport");
  await ribbon.scrollIntoViewIfNeeded();
  const before = await ribbon.evaluate((element) => ({
    pageWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    left: element.scrollLeft,
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(before.scrollWidth).toBeGreaterThan(before.clientWidth);

  await ribbon.evaluate((element) => element.scrollTo({ left: 220 }));
  const after = await ribbon.evaluate((element) => ({
    pageWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    left: element.scrollLeft,
  }));
  expect(after.left).toBeGreaterThan(0);
  expect(after.pageWidth).toBeLessThanOrEqual(after.viewportWidth);
});

test("Promise Reel moves continuously and the visible control pauses it", async ({ page }) => {
  await page.goto("/");
  const reel = page.locator(".promise-reel");
  const track = page.locator(".promise-ribbon__track");
  await reel.scrollIntoViewIfNeeded();

  await expect(page.getByRole("button", { name: "Pause promise reel" })).toBeVisible();
  await expect(track).toHaveAttribute("data-playing", "true");
  const firstTransform = await track.evaluate((element) => getComputedStyle(element).transform);
  await page.waitForTimeout(500);
  const secondTransform = await track.evaluate((element) => getComputedStyle(element).transform);
  expect(secondTransform).not.toBe(firstTransform);

  await page.getByRole("button", { name: "Pause promise reel" }).click();
  await expect(track).toHaveAttribute("data-playing", "false");
  await expect(page.getByRole("button", { name: "Play promise reel" })).toBeVisible();
});

test("Promise Reel pauses on hover and keyboard focus", async ({ page }) => {
  await page.goto("/");
  const reel = page.locator(".promise-reel");
  const viewport = page.locator(".promise-ribbon__viewport");
  const track = page.locator(".promise-ribbon__track");
  await reel.scrollIntoViewIfNeeded();

  await reel.hover();
  await expect(track).toHaveAttribute("data-playing", "false");
  await page.mouse.move(0, 0);
  await expect(track).toHaveAttribute("data-playing", "true");

  await viewport.focus();
  await expect(track).toHaveAttribute("data-playing", "false");
});

test("reduced motion leaves hero content visible", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await expect(page.locator(".hero-media__frame")).toBeVisible();
  await expect(page.locator(".promise-ribbon__card").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Play promise reel" })).toBeVisible();
  await expect(page.locator(".promise-ribbon__track")).toHaveAttribute("data-playing", "false");
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("Promise Reel remains a manually scrollable static image strip", async ({ page }) => {
    await page.goto("/");
    const ribbon = page.locator(".promise-ribbon");
    const viewport = page.locator(".promise-ribbon__viewport");
    const track = page.locator(".promise-ribbon__track");

    await expect(ribbon.locator("figure")).toHaveCount(8);
    await expect(page.getByRole("button", { name: /promise reel/i })).toBeHidden();
    await expect(track).toHaveAttribute("data-enhanced", "false");

    const dimensions = await viewport.evaluate((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      animationName: getComputedStyle(element.firstElementChild!).animationName,
    }));
    expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.clientWidth);
    expect(dimensions.animationName).toBe("none");
  });
});

test("homepage has no serious or critical axe violations", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();

  const seriousOrCritical = results.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? ""),
  );

  expect(seriousOrCritical).toEqual([]);
});
