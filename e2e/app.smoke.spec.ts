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

test("current shell uses Map, Compare, and More and the More tab opens the stop flow", async ({
  page
}) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: "Map" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Compare" })).toBeVisible();
  await expect(page.getByRole("button", { name: "More" })).toBeVisible();
  await expect(page.getByText("Where do you want to go?")).toBeVisible();

  await page.getByRole("button", { name: "More" }).click();

  await expect(page).toHaveURL(/\/more$/);
  await expect(page.getByRole("button", { name: "Stops" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pass" })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search stop or landmark" })).toBeVisible();
});

test("compare view loads from the canonical /compare route", async ({ page }) => {
  await page.goto("/compare");

  await expect(page.getByRole("heading", { name: "Getting around Phuket" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Airport" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Patong Beach" })).toBeVisible();

  await page.getByRole("button", { name: "Patong Beach" }).click();

  await expect(page.getByRole("button", { name: "Patong Beach" })).toHaveClass(/is-active/);
  await expect(page.getByRole("button", { name: "Airport" })).toBeVisible();
});

test("language switch updates the welcome sheet copy to Thai", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Map" }).click();
  await page.getByRole("button", { name: "TH" }).click();

  await expect(page.getByText("ยินดีต้อนรับสู่ภูเก็ต")).toBeVisible();
  await expect(page.getByPlaceholder("ชายหาด, โรงแรม, สนามบิน...")).toBeVisible();
});

test("more view hosts stops and pass instead of retired qr routes", async ({ page }) => {
  await page.goto("/more");

  await expect(page.getByRole("button", { name: "Stops" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pass" })).toBeVisible();

  await page.getByRole("button", { name: "Pass" }).click();

  await expect(page.getByRole("heading", { name: "My QR code" })).toBeVisible();
  await expect(page.getByText("QR boarding code")).toBeVisible();

  await page.getByRole("button", { name: "7-day pass" }).first().click();

  await expect(page.getByText("PKSB-WEEK-7-1124")).toBeVisible();
});
