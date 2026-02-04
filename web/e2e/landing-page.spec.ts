import { test, expect } from "@playwright/test";

/**
 * E2E tests for unknown user landing page experience
 * These tests verify the initial page load for users with no browsing history
 */

test.describe("Unknown User Landing Page", () => {
  test.beforeEach(async ({ context }) => {
    // Clear all cookies and local storage to simulate unknown user
    await context.clearCookies();
  });

  test("should see the cookie consent toolbar", async ({ page }) => {
    // Navigate to the home page
    await page.goto("/");

    // Wait for the cookie consent banner to be visible
    // The banner appears at the bottom center of the page
    const cookieBanner = page.locator('div:has-text("Използваме бисквитки")');
    await expect(cookieBanner).toBeVisible();

    // Verify the accept and decline buttons are present
    const acceptButton = page.locator('button:has-text("Приеми")');
    const declineButton = page.locator('button:has-text("Откажи")');
    
    await expect(acceptButton).toBeVisible();
    await expect(declineButton).toBeVisible();
  });

  test("should see the filters box", async ({ page }) => {
    // Navigate to the home page
    await page.goto("/");

    // Wait for the page to load and React to hydrate
    await page.waitForLoadState("networkidle");

    // The CategoryFilterBox has a handle/button that's always visible
    // It shows a filter icon and can be clicked to open the panel
    const filterHandle = page.locator('button[aria-label*="филтрите"]');
    
    // Verify the filter handle is visible
    await expect(filterHandle).toBeVisible();
    
    // The filter icon should be present in the handle
    const filterButton = page.locator('.drag-handle');
    await expect(filterButton).toBeVisible();
  });

  test("should see the login button in the header", async ({ page }) => {
    // Navigate to the home page
    await page.goto("/");

    // Wait for the header to load
    await page.waitForLoadState("domcontentloaded");

    // Find the login button with text "Влез"
    const loginButton = page.locator('button:has-text("Влез")');
    
    // Verify the button is visible
    await expect(loginButton).toBeVisible();
    
    // Verify it's in the header section
    const header = page.locator('header');
    await expect(header).toContainText("OboApp");
    await expect(header).toContainText("Влез");
  });
});
