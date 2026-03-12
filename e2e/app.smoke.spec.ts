import { expect, test } from "@playwright/test";
import { installMockNetwork } from "./support/mockNetwork";
import { mockAirportLocation } from "../src/test/fixtures/appApiFixtures";

test.use({
  permissions: ["geolocation"],
  geolocation: {
    latitude: mockAirportLocation[0],
    longitude: mockAirportLocation[1]
  }
});

test.beforeEach(async ({ page }) => {
  await installMockNetwork(page);
});

test("airport landing shows the rider-critical airport guidance and opens the ride view", async ({
  page
}) => {
  await page.goto("/");

  await expect(page.getByText("You appear to be at Phuket Airport")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bus or taxi?" })).toBeVisible();
  await expect(page.getByText("100 THB")).toBeVisible();
  await expect(page.getByText(/1,000/)).toBeVisible();
  await expect(page.getByText("Rain moving across the airport corridor").first()).toBeVisible();
  await expect(
    page.getByText("Turn left after you come out and head to the Smart Bus stop by Cafe Amazon.")
  ).toBeVisible();
  await expect(page.getByTestId("airport-map-preview")).toBeVisible();

  await page.getByRole("button", { name: "Open boarding stop" }).click();

  await expect(page).toHaveURL(/\/ride$/);
  await expect(page.getByText("Airport approach is slower")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Phuket Airport" })).toBeVisible();
});

test("live map boots from the path and route focus can switch to Patong", async ({ page }) => {
  await page.goto("/live-map");

  await expect(page.getByTestId("live-map")).toBeVisible();
  await expect(page.getByRole("button", { name: "Airport Line" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Patong Line" })).toBeVisible();

  await page.getByRole("button", { name: "Patong Line" }).click();

  await expect(page.getByRole("button", { name: "Patong Line" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-testid="live-map"] .map-frame__copy strong')).toHaveText("Patong Line");
});

test("language switch updates the airport page copy to Thai", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "TH" }).click();

  await expect(page.getByRole("heading", { name: "รถบัสหรือแท็กซี่?" })).toBeVisible();
  await expect(page.getByText("ดูเหมือนว่าคุณอยู่ที่สนามบินภูเก็ต")).toBeVisible();
  await expect(page.getByText("มีกลุ่มฝนเคลื่อนผ่านแนวสนามบิน").first()).toBeVisible();
  await expect(
    page.getByText("เมื่อออกมาด้านนอกแล้วให้เลี้ยวซ้ายและเดินไปที่ป้าย Smart Bus ข้าง Cafe Amazon")
  ).toBeVisible();
});

test("qr pass view boots from the path and the pass switch updates the visible ticket", async ({
  page
}) => {
  await page.goto("/my-qr");

  await expect(page.getByRole("heading", { name: "My QR code" })).toBeVisible();
  await expect(page.getByText("QR boarding code")).toBeVisible();

  await page.getByRole("button", { name: "7-day pass" }).click();

  await expect(page.getByText("PKSB-WEEK-7-1124")).toBeVisible();
  await expect(page.getByText("7-day pass")).toHaveCount(2);
});
