import { test, expect } from "@playwright/test";

/**
 * Smoke test - Basic page load test
 * This test verifies that the application can start and render the basic HTML structure
 * Does not require Firebase emulators to be running
 */

test.describe("Smoke Tests", () => {
  // Increase timeout for initial page load
  test.setTimeout(60000);

  test("should load the home page", async ({ page }) => {
    // Navigate to the home page
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Verify basic page structure loaded
    const body = page.locator("body");
    await expect(body).toBeVisible();

    // Verify the page title
    await expect(page).toHaveTitle(/OboApp/);
  });

  test("should render the header", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Verify header is present
    const header = page.locator("header");
    await expect(header).toBeVisible();

    // Verify OboApp branding is in header
    await expect(header).toContainText("OboApp");
  });

  test("should render the main content area", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Verify main content exists
    const main = page.locator("main");
    await expect(main).toBeVisible();
  });
});
