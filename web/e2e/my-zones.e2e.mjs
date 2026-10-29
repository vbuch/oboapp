import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { expect } from "playwright/test";

const baseUrl = process.env.E2E_BASE_URL || "http://localhost:3000";
assert.ok(
  ["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseUrl).hostname),
  "Run this smoke test against a local MSW development server.",
);
const browserChannel = process.env.PLAYWRIGHT_CHANNEL;
const artifactDirectory = fileURLToPath(
  new URL("../../tmp/my-zones-e2e/", import.meta.url),
);

function isApiResponse(response, pathname, method = "GET") {
  return (
    new URL(response.url()).pathname === pathname &&
    response.request().method() === method
  );
}

async function mapFeatureCount(page) {
  return page.locator('.gm-style [role="button"]').evaluateAll((markers) => {
    let count = 0;
    for (const marker of markers) {
      const label = marker.getAttribute("aria-label") || "";
      if (label === "Маркер") {
        count += 1;
      } else if (/^\d+$/.test(label)) {
        count += Number(label);
      }
    }
    return count;
  });
}

function eventCard(page, text) {
  // My zones keeps the hidden results panel mounted. Its DOM verifies that
  // unrelated results were filtered out as well as removed from the map.
  return page.locator("button").filter({ hasText: text });
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
  await expect(
    page.getByRole("button", { name: `Действия за ${label}` }),
  ).toHaveCount(0);
}

test("My zones filters the real map through tab switches, filters, panning, and zone deletion", {
  timeout: 240_000,
}, async (context) => {
  const browser = await chromium.launch({ channel: browserChannel });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
  });
  page.setDefaultTimeout(30_000);
  const pageErrors = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await mkdir(artifactDirectory, { recursive: true });
  try {
    await page.addInitScript(() => {
      localStorage.setItem("categoryFilter", JSON.stringify({
        selectedCategories: [],
        hasInteracted: true,
        showArchived: true,
      }));
    });

    const interestsResponse = page.waitForResponse((response) => {
      return isApiResponse(response, "/api/interests");
    });
    const messagesResponse = page.waitForResponse((response) => {
      return isApiResponse(response, "/api/messages");
    }, { timeout: 90_000 });
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
    const interests = await interestsResponse;
    assert.equal(interests.fromServiceWorker(), true,
      "MSW must serve the interests before this test edits mock zones.");
    const interestData = await interests.json();
    assert.deepEqual(
      interestData.interests.map((interest) => interest.id).sort(),
      ["interest-home", "interest-work"],
    );
    assert.ok(interestData.interests.every((interest) => {
      return interest.userId === "mock-user-123";
    }));
    assert.equal((await messagesResponse).fromServiceWorker(), true);

    const dismissNotifications = page.getByRole("button", {
      name: "Не сега", exact: true,
    });
    if (await dismissNotifications.isVisible()) {
      await dismissNotifications.click();
    }

    const zonesMode = page.getByRole("radio", { name: "Моите зони" });
    const eventsMode = page.getByRole("radio", { name: "Събития" });
    const roadBlockCard = eventCard(page, "Затворена улица");
    const waterCard = eventCard(page, "Планирано спиране на водоподаването");
    await expect(roadBlockCard).toBeVisible();
    await expect.poll(() => mapFeatureCount(page), {
      timeout: 30_000,
    }).toBeGreaterThan(5);
    const allFeatureCount = await mapFeatureCount(page);

    await zonesMode.click();
    await expect(zonesMode).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("button", { name: "Действия за Вкъщи" })).toBeVisible();
    await expect(roadBlockCard).toHaveCount(0);
    await expect(waterCard).toHaveCount(1);
    await expect.poll(() => mapFeatureCount(page)).toBeLessThan(allFeatureCount);
    await expect.poll(() => mapFeatureCount(page)).toBeGreaterThan(0);
    const zonesFeatureCount = await mapFeatureCount(page);
    await page.screenshot({ path: path.join(artifactDirectory, "my-zones.png") });
    context.diagnostic(`Map features: Events=${allFeatureCount}, My zones=${zonesFeatureCount}.`);

    await page.getByRole("button", { name: "Отвори филтрите", exact: true }).click();
    const waterCategory = page.getByRole("region", { name: "Категории" })
      .getByRole("button", { name: /^Вода\s*\d*$/ });
    const categoryResponse = page.waitForResponse((response) => {
      return isApiResponse(response, "/api/messages") &&
        new URL(response.url()).searchParams.get("categories") === "water";
    });
    await waterCategory.click();
    await categoryResponse;
    await expect(waterCategory).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => mapFeatureCount(page)).toBe(1);

    await page.getByRole("button", { name: "Източници", exact: true }).click();
    const sourceResponse = page.waitForResponse((response) => {
      return isApiResponse(response, "/api/messages") &&
        new URL(response.url()).searchParams.get("sources") === "sofiyska-voda";
    });
    await page.getByRole("button", { name: "Филтрирай Софийска вода", exact: true }).click();
    await sourceResponse;
    await expect(page.getByRole("button", {
      name: "Премахни Софийска вода", exact: true,
    })).toHaveAttribute("aria-pressed", "true");
    await eventsMode.click();
    await expect(waterCategory).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => mapFeatureCount(page)).toBe(1);

    const clearedResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return isApiResponse(response, "/api/messages") &&
        !url.searchParams.has("categories") && !url.searchParams.has("sources");
    });
    await page.getByRole("button", { name: "Изчисти всички", exact: true }).click();
    await clearedResponse;
    // Clearing all filters also clears the archive option. These dated MSW
    // fixtures need it enabled again for the remaining map interactions.
    await page.getByRole("checkbox", { name: "Покажи минали", exact: true }).check();
    await expect(roadBlockCard).toBeVisible();
    await page.getByRole("button", { name: "Затвори филтрите", exact: true }).click();
    await zonesMode.click();
    await expect(roadBlockCard).toHaveCount(0);

    const mapBox = await page.locator(".gm-style").boundingBox();
    assert.ok(mapBox);
    const panResponse = page.waitForResponse((response) => {
      return isApiResponse(response, "/api/messages");
    });
    const dragX = mapBox.x + mapBox.width * 0.7;
    const dragY = mapBox.y + mapBox.height * 0.3;
    await page.mouse.move(dragX, dragY);
    await page.mouse.down();
    await page.mouse.move(dragX + 100, dragY, { steps: 12 });
    await page.mouse.up();
    assert.equal((await panResponse).fromServiceWorker(), true);
    await expect(roadBlockCard).toHaveCount(0);
    await expect(waterCard).toHaveCount(1);
    context.diagnostic("Category/source choices and the zone restriction survived a viewport refetch.");

    await page.setViewportSize({ width: 1000, height: 900 });
    await expect(roadBlockCard).toBeVisible();
    await page.setViewportSize({ width: 1600, height: 1000 });
    await expect(zonesMode).toHaveAttribute("aria-checked", "true");
    await expect(roadBlockCard).toHaveCount(0);

    await deleteMockZone(page, "Вкъщи");
    await deleteMockZone(page, "Работа");
    await expect(page.getByText(/Нямаш добавени зони\. Натисни/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Добави зона", exact: true })).toBeEnabled();
    await expect.poll(() => mapFeatureCount(page)).toBe(0);
    await eventsMode.click();
    await expect(roadBlockCard).toBeVisible();
    await expect.poll(() => mapFeatureCount(page)).toBeGreaterThan(0);
    assert.deepEqual(pageErrors, []);
    context.diagnostic("Narrow layout restored Events; deleting mock zones cleared the map; Events restored markers.");
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
