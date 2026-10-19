import { expect, test, type Page } from "@playwright/test";
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

const open = (page: Page, path: string) =>
  page.goto(path, { waitUntil: "commit" });

test("rider front door labels modelled figures honestly", async ({ page }) => {
  await open(page, "/");

  if ((page.viewportSize()?.width ?? 0) < 768) {
    await expect(page.getByRole("heading", { name: /Phuket Smart Bus tickets/i })).toBeVisible();
    await expect(page.getByText(/live timetable simulation · no real payment/i)).toBeVisible();
  } else {
    await expect(page.getByRole("button", { name: /Operator Console/i })).toBeVisible();
    await expect(page.getByText("Modelled riders today")).toBeVisible();
    await expect(page.getByText(/published timetable \+ demand simulation/i)).toBeVisible();
  }
});

test("legacy tourist shell keeps the map and info flow intact", async ({ page }) => {
  await open(page, "/tourist");

  await expect(page.getByRole("button", { name: "Map" })).toBeVisible();
  await expect(page.getByRole("button", { name: "More" })).toBeVisible();
  await expect(page.getByText("Next Bus · Airport", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /Plan a trip/i }).click();

  await expect(page.getByRole("heading", { name: "Welcome to Phuket" })).toBeVisible();
  await expect(page.getByPlaceholder("Beach, hotel, airport...")).toBeVisible();
});

test("mocked shell still supports the info and pass flow", async ({ page }) => {
  await open(page, "/tourist");

  await page.getByRole("button", { name: "More" }).click();

  await expect(page.getByRole("button", { name: "Stops" })).toBeVisible();
  await page.getByRole("button", { name: "Pass" }).click();

  await expect(page.getByRole("heading", { name: "My QR code" })).toBeVisible();
  await expect(page.getByText("QR boarding code")).toBeVisible();
  await page.getByRole("button", { name: "7-day pass" }).click();
  await expect(page.getByText("PKSB-WEEK-7-1124")).toBeVisible();
});

test("mocked shell updates copy when switching language", async ({ page }) => {
  await open(page, "/tourist");

  await page.getByRole("button", { name: /Plan a trip/i }).click();
  await page.getByRole("button", { name: "TH", exact: true }).click();

  await expect(page.getByText("ยินดีต้อนรับสู่ภูเก็ต")).toBeVisible();
  await expect(page.getByPlaceholder("ชายหาด, โรงแรม, สนามบิน...")).toBeVisible();
});


test("ops console separates the replay from the live fleet", async ({ page }) => {
  await open(page, "/ops?source=sim");

  await expect(page.locator(".v2-header__eyebrow")).toContainText("Investor");
  await expect(page.getByRole("button", { name: "SIMULATION", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /^LIVE/ })).toBeVisible();
});

test("fleet monitor leads with evidence and states its blind spot", async ({ page }) => {
  await open(page, "/fleet");

  await expect(page.getByText("Phuket Mobility Observatory")).toBeVisible();
  await expect(page.getByRole("heading", { name: /fleet is outside our field of view|buses are visible on the road/i })).toBeVisible();
  await expect(page.getByText("Passenger load not measured")).toBeVisible();
  await expect(page.getByText(/does not claim occupancy, ridership, revenue, or demand/i)).toBeVisible();
});

test("capacity monitor keeps modelled demand separate from live telemetry", async ({ page }) => {
  await open(page, "/capacity?source=live");

  await expect(page.getByText("Modelled airport queue")).toBeVisible();
  await expect(page.getByText("Planning recommendation", { exact: true })).toBeVisible();
  await expect(page.getByText(/test \+\d+ buses? against real boardings before dispatch/i)).toBeVisible();
});
