import { expect, test } from "@playwright/test";
import { installMockNetwork } from "./support/mockNetwork";

test.use({
  permissions: ["geolocation"],
  geolocation: {
    latitude: 7.55,
    longitude: 98.12
  }
});

test.beforeEach(async ({ page }) => {
  await installMockNetwork(page);
});

test("mocked shell keeps the map and info tourist flow intact", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: "Map" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Info" })).toBeVisible();
  await expect(page.getByText(/Next bus to/i)).toBeVisible();

  await page.getByText(/Tap for routes/i).click();

  await expect(page.getByRole("heading", { name: "Welcome to Phuket" })).toBeVisible();
  await expect(page.getByPlaceholder("Beach, hotel, airport...")).toBeVisible();
});

test("mocked shell still supports the info and pass flow", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Info" }).click();

  await expect(page.getByRole("button", { name: "Stops" })).toBeVisible();
  await page.getByRole("button", { name: "Pass" }).click();

  await expect(page.getByRole("heading", { name: "My QR code" })).toBeVisible();
  await expect(page.getByText("QR boarding code")).toBeVisible();
  await page.getByRole("button", { name: "7-day pass" }).click();
  await expect(page.getByText("PKSB-WEEK-7-1124")).toBeVisible();
});

test("mocked shell updates copy when switching language", async ({ page }) => {
  await page.goto("/");

  await page.getByText(/Tap for routes/i).click();
  await page.getByRole("button", { name: "TH" }).click();

  await expect(page.getByText("ยินดีต้อนรับสู่ภูเก็ต")).toBeVisible();
  await expect(page.getByPlaceholder("ชายหาด, โรงแรม, สนามบิน...")).toBeVisible();
});

test("mocked ops console surfaces backend-declared mode and competitor data", async ({ page }) => {
  await page.goto("/ops");

  await expect(page.getByRole("heading", { name: "PKSB Operations" })).toBeVisible();
  await expect(page.getByText("Demo")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Competitor Benchmark" })).toBeVisible();
  await expect(page.getByText("Orange Line (Government)")).toBeVisible();
});
