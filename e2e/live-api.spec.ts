import { expect, test } from "@playwright/test";
import { installMapTileMocks } from "./support/mockNetwork";

const apiBaseURL = `http://127.0.0.1:${Number(process.env.API_PORT ?? 3099)}`;

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

test("live api stays reachable while the tourist shell boots", async ({ page, request }) => {
  const [routesResponse, healthResponse] = await Promise.all([
    request.get(`${apiBaseURL}/api/routes`),
    request.get(`${apiBaseURL}/api/health`)
  ]);

  expect(routesResponse.ok()).toBeTruthy();
  expect(healthResponse.ok()).toBeTruthy();

  await page.goto("/");

  await expect(page.getByRole("button", { name: "Map" })).toBeVisible();
  await expect(page.getByRole("button", { name: "More" })).toBeVisible();
  await expect(page.getByText(/Next bus to/i)).toBeVisible();
});

test("live api serves the info tab stop flow end to end", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "More" }).click();

  await expect(page.getByRole("button", { name: "Stops" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pass" })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search stop or landmark" })).toBeVisible();
});
