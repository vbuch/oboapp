import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { expect } from "playwright/test";

const baseUrl = process.env.E2E_BASE_URL || "http://localhost:3000";
const browserChannel = process.env.PLAYWRIGHT_CHANNEL;
const preferenceKey = "landingViewPreference:v1";
const artifactDirectory = fileURLToPath(
  new URL("../../tmp/preferred-landing-e2e/", import.meta.url),
);

function isApiResponse(response, pathname, method = "GET") {
  return new URL(response.url()).pathname === pathname &&
    response.request().method() === method;
}

function eventCard(page, text) {
  return page.locator("button").filter({ hasText: text });
}

async function savedPreference(page) {
  return page.evaluate((key) => localStorage.getItem(key), preferenceKey);
}

async function openSettings(page) {
  await page.getByRole("button", { name: "Профилно меню", exact: true }).click();
  await page.getByRole("link", { name: "Настройки", exact: true }).click();
  await expect(page.getByRole("heading", {
    name: "Начален изглед", exact: true,
  })).toBeVisible({ timeout: 90_000 });
  return page.getByRole("group", { name: "Избор на начален изглед", exact: true });
}

async function deleteMockZone(page, label) {
  await page.getByRole("button", { name: `Действия за ${label}` }).click();
  await page.getByRole("menuitem", { name: "Изтрий", exact: true }).click();
  const deleted = page.waitForResponse((response) => {
    return isApiResponse(response, "/api/interests", "DELETE");
  });
  await page.getByRole("button", { name: "Изтрий зоната", exact: true }).click();
  const response = await deleted;
  assert.equal(response.fromServiceWorker(), true);
  assert.equal(response.ok(), true);
  await expect(page.getByRole("button", {
    name: `Действия за ${label}`,
  })).toHaveCount(0);
}

async function expectInitialCircleFit(page, zones) {
  await expect.poll(async () => {
    return page.evaluate(() => globalThis.__landingCamera?.fits.length);
  }).toBe(1);
  await expect.poll(async () => {
    return page.evaluate((savedZones) => {
      const state = globalThis.__landingCamera;
      const bounds = state.map.getBounds();
      if (!bounds) {
        return false;
      }

      const fit = state.fits[0];
      if (typeof fit.padding !== "number" || fit.padding < 16) {
        return false;
      }

      return savedZones.every((zone) => {
        const circle = new google.maps.Circle({
          center: zone.coordinates,
          radius: zone.radius,
        }).getBounds();
        return bounds.contains(circle.getNorthEast()) &&
          bounds.contains(circle.getSouthWest());
      });
    }, zones);
  }, { timeout: 30_000 }).toBe(true);
}

test("saved landing choice survives visits and keeps event links and empty zones usable", {
  timeout: 480_000,
}, async (context) => {
  assert.ok(
    ["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseUrl).hostname),
    "Run this test against a local MSW development server with a Google Maps key.",
  );
  const browser = await chromium.launch({ channel: browserChannel });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
  });
  page.setDefaultTimeout(30_000);
  const pageErrors = [];
  const messageRequests = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/messages") {
      messageRequests.push(request.url());
    }
  });
  await mkdir(artifactDirectory, { recursive: true });

  try {
    // Abort mock mutations that escape the service worker.
    await page.route("**/api/interests**", async (route) => {
      if (route.request().method() === "GET") {
        await route.continue();
      } else {
        await route.abort("blockedbyclient");
      }
    });
    await page.addInitScript(() => {
      localStorage.setItem("categoryFilter", JSON.stringify({
        selectedCategories: [],
        hasInteracted: true,
        showArchived: true,
      }));

      // Delay delivery to the hook while leaving MSW and its response intact.
      if (sessionStorage.getItem("delay-landing-zones") === "true") {
        const originalFetch = globalThis.fetch;
        const zonesReady = new Promise((resolve) => {
          globalThis.__releaseLandingZones = resolve;
        });
        globalThis.fetch = async (...args) => {
          const response = await originalFetch(...args);
          const input = args[0];
          const url = new URL(
            input instanceof Request ? input.url : input,
            location.href,
          );
          if (url.pathname === "/api/interests") {
            await zonesReady;
          }
          return response;
        };
      }
    });
    await page.addLocatorHandler(
      page.getByRole("button", { name: "Не сега", exact: true }),
      async (button) => {
        await button.click();
      },
    );

    const [interests, messages] = await Promise.all([
      page.waitForResponse((response) => {
        return isApiResponse(response, "/api/interests");
      }, { timeout: 180_000 }),
      page.waitForResponse((response) => {
        return isApiResponse(response, "/api/messages");
      }, { timeout: 180_000 }),
      page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 180_000 }),
    ]);
    assert.equal(interests.fromServiceWorker(), true);
    assert.equal(messages.fromServiceWorker(), true);
    const zones = (await interests.json()).interests;
    assert.deepEqual(zones.map((zone) => zone.id).sort(), [
      "interest-home", "interest-work",
    ]);
    assert.ok(zones.every((zone) => zone.userId === "mock-user-123"));
    const zonesMode = page.getByRole("radio", { name: "Моите зони", exact: true });
    const eventsMode = page.getByRole("radio", { name: "Събития", exact: true });
    const roadCard = eventCard(page, "Затворена улица");
    const waterCard = eventCard(page, "Планирано спиране на водоподаването");
    await expect(eventsMode).toHaveAttribute("aria-checked", "true");
    await expect(roadCard).toBeVisible();
    assert.equal(await savedPreference(page), null);

    await page.waitForFunction(() => {
      return typeof globalThis.google?.maps?.Map?.prototype.fitBounds === "function";
    }, undefined, { timeout: 60_000 });
    await page.evaluate(() => {
      const originalFitBounds = google.maps.Map.prototype.fitBounds;
      globalThis.__landingCamera = { map: null, fits: [] };
      google.maps.Map.prototype.fitBounds = function (bounds, padding) {
        globalThis.__landingCamera.map = this;
        globalThis.__landingCamera.fits.push({ padding });
        return originalFitBounds.call(this, bounds, padding);
      };
    });

    let preferenceGroup = await openSettings(page);
    await expect(preferenceGroup.getByRole("radio", { name: "Събития", exact: true }))
      .toBeChecked();
    assert.equal(await savedPreference(page), null);
    await preferenceGroup.getByRole("radio", { name: "Моите зони", exact: true }).check();
    assert.equal(await savedPreference(page), "zones");
    await page.getByRole("link", { name: /Начало$/ }).click();
    await expect(zonesMode).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("region", {
      name: "Събития в моите зони", exact: true,
    })).toBeVisible();
    await expect(roadCard).toHaveCount(0);
    await expect(waterCard).toBeVisible();
    await expectInitialCircleFit(page, zones);
    context.diagnostic("Selecting My zones in Settings applies the shared geometry filter and fits both saved circles on the next home visit.");

    await eventsMode.click();
    await expect(eventsMode).toHaveAttribute("aria-checked", "true");
    await expect(roadCard).toBeVisible();
    assert.equal(await savedPreference(page), "zones");
    await page.evaluate(() => {
      sessionStorage.setItem("delay-landing-zones", "true");
    });
    messageRequests.length = 0;
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => {
      return typeof globalThis.__releaseLandingZones === "function";
    });
    await expect(page.getByText("Зареждане...", { exact: true })).toBeVisible();
    await expect(roadCard).toHaveCount(0);
    assert.equal(messageRequests.length, 0,
      "A preferred zone landing must wait for saved zones before fetching events.");
    await page.evaluate(() => {
      sessionStorage.removeItem("delay-landing-zones");
      globalThis.__releaseLandingZones();
    });
    await expect(zonesMode).toHaveAttribute("aria-checked", "true");
    await expect(waterCard).toBeVisible();
    await expect(roadCard).toHaveCount(0);
    assert.equal(await savedPreference(page), "zones");

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(zonesMode).toBeVisible();
    await expect(zonesMode).toHaveAttribute("aria-checked", "true");
    await eventsMode.click();
    await expect(roadCard).toBeVisible();
    assert.equal(await savedPreference(page), "zones");
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(zonesMode).toHaveAttribute("aria-checked", "true");
    await expect(waterCard).toBeVisible();
    await page.screenshot({
      path: path.join(artifactDirectory, "mobile-zone-landing.png"),
      fullPage: true,
    });
    context.diagnostic("The saved choice survives reload, delayed zone loading, temporary switches, and the phone layout.");

    await page.setViewportSize({ width: 1600, height: 1000 });
    await deleteMockZone(page, "Вкъщи");
    await deleteMockZone(page, "Работа");
    await expect(page.getByText(/Нямаш добавени зони\. Натисни/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Добави зона", exact: true })).toBeEnabled();
    await expect(waterCard).toHaveCount(0);
    assert.equal(await savedPreference(page), "zones");

    const eventUrl = new URL("/?messageId=msg-water-center-1", baseUrl).href;
    await page.goto(eventUrl, { waitUntil: "domcontentloaded" });
    const details = page.getByRole("complementary", {
      name: "Детайли за сигнала", exact: true,
    });
    await expect(details).toBeVisible();
    await expect(details).toContainText("Граф Игнатиев");
    await expect(eventsMode).toHaveAttribute("aria-checked", "true");
    assert.equal(await savedPreference(page), "zones");
    await details.getByRole("button", { name: "Затвори детайлите", exact: true }).click();
    await expect(details).toHaveCount(0);
    context.diagnostic("No saved zones leaves the add-zone action available. An explicit event link opens its details in Events without changing the landing preference.");

    preferenceGroup = await openSettings(page);
    await preferenceGroup.getByRole("radio", { name: "Събития", exact: true }).check();
    assert.equal(await savedPreference(page), "events");
    await page.getByRole("link", { name: /Начало$/ }).click();
    await expect(eventsMode).toHaveAttribute("aria-checked", "true");
    await expect(roadCard).toBeVisible();
    await zonesMode.click();
    assert.equal(await savedPreference(page), "events");
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(eventsMode).toHaveAttribute("aria-checked", "true");
    await expect(roadCard).toBeVisible();
    assert.equal(await savedPreference(page), "events");
    assert.deepEqual(pageErrors, []);
    context.diagnostic("Changing the saved choice to Events applies across visits while manual zone switches leave it intact.");
  } catch (error) {
    await page.screenshot({
      path: path.join(artifactDirectory, "failure.png"),
      fullPage: true,
    });
    throw error;
  } finally {
    await browser.close();
  }
});
