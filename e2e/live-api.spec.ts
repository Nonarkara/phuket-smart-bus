import { expect, test } from "@playwright/test";
import { installMapTileMocks } from "./support/mockNetwork";

test.use({
  permissions: ["geolocation"],
  geolocation: {
    latitude: 7.55,
    longitude: 98.12
  }
});

test.beforeEach(async ({ page }) => {
  await installMapTileMocks(page);
});

test("live api bootstraps the tourist shell without api stubbing", async ({ page }) => {
  const routesResponse = page.waitForResponse(
    (response) => response.url().includes("/api/routes") && response.status() === 200
  );
  const healthResponse = page.waitForResponse(
    (response) => response.url().includes("/api/health") && response.status() === 200
  );

  await page.goto("/");

  await routesResponse;
  await healthResponse;

  await expect(page.getByRole("button", { name: "Map" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Info" })).toBeVisible();
  await expect(page.getByText(/Next bus to/i)).toBeVisible();
});

test("live api serves the info tab stop flow end to end", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Info" }).click();

  await expect(page.getByRole("button", { name: "Stops" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pass" })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search stop or landmark" })).toBeVisible();
});
