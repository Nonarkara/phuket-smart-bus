import type { Page } from "@playwright/test";
import { getMockApiPayload } from "../../src/test/fixtures/appApiFixtures";

const BLANK_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9sA4nKkAAAAASUVORK5CYII=";

export async function installMockNetwork(page: Page) {
  await installMapTileMocks(page);

  await page.route("**/api/**", async (route) => {
    const payload = getMockApiPayload(route.request().url());

    if (payload === null) {
      await route.abort();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(payload)
    });
  });
}

export async function installMapTileMocks(page: Page) {
  await page.route("https://*.tile.openstreetmap.org/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from(BLANK_PNG_BASE64, "base64")
    });
  });
}
