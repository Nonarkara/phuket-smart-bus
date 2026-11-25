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
    await expect(page.getByRole("heading", { name: /where the buses are and when the next one reaches your stop/i })).toBeVisible();
    await expect(page.getByText(/Next scheduled bus leaves in/i)).toBeVisible();
    await expect(page.getByText(/prototype does not charge a card/i)).toBeVisible();
  } else {
    await expect(page.getByRole("link", { name: /Ops Console/i })).toBeVisible();
    await expect(page.getByText(/modelled riders/i)).toBeVisible();
    await expect(page.getByText(/published duties on 3,944-point road geometry/i)).toBeVisible();
  }
});

test("legacy tourist shell keeps the map and info flow intact", async ({ page }) => {
  await open(page, "/tourist");

  await expect(page.getByRole("button", { name: "Map" })).toBeVisible();
  await expect(page.getByRole("button", { name: "More" })).toBeVisible();
  await expect(page.getByText("Next scheduled departure · Patong & Rawai", { exact: true })).toBeVisible();

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

for (const { width, height } of [{ width: 390, height: 844 }, { width: 1024, height: 768 }]) {
  test(`compact ops keeps the working map and modelled dispatch together at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await open(page, "/ops?source=sim");
    const briefing = page.getByRole("main", { name: "Mobile operations briefing" });
    const map = briefing.locator(".leaflet-container");
    const flightStatus = briefing.locator(".v2-map__flight-badge");
    const flightToggle = briefing.getByRole("button", { name: "Flights", exact: true });
    const decision = briefing.locator(".v2-brief__decision h2");
    await expect(map).toBeVisible();
    await expect(flightStatus).toBeVisible();
    await page.evaluate(async () => { await document.fonts.ready; });

    const mapBox = (await map.boundingBox())!;
    const decisionBox = (await decision.boundingBox())!;
    expect(mapBox.y, "weather, decision and evidence cannot push down the map").toBeLessThanOrEqual(225);
    const visibleMapArea = mapBox.width * Math.min(mapBox.height, height - mapBox.y);
    expect(visibleMapArea / (width * height)).toBeGreaterThanOrEqual(0.56);
    expect(decisionBox.y - (mapBox.y + mapBox.height)).toBeLessThanOrEqual(80);
    expect(decisionBox.y + decisionBox.height).toBeLessThanOrEqual(height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    if (width === 390) {
      const slider = page.getByRole("slider", { name: "Simulation time" });
      expect((await slider.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }

    // An overlapping badge used to intercept this pointer action on phones.
    await flightToggle.click();
    await expect(flightToggle).toHaveAttribute("aria-pressed", "false");
    await expect(flightStatus).toHaveCount(0);
    await flightToggle.press("Space");
    await expect(flightStatus).toBeVisible();
    await expect(briefing.getByRole("region", { name: "Phuket conditions" })).toContainText("MODEL ONLY");

    await page.getByRole("link", { name: "CAPACITY", exact: true }).focus();
    expect((await page.locator(".v2-header").boundingBox())!.x).toBe(0);
  });
}

test("fleet monitor leads with evidence and states its blind spot", async ({ page }) => {
  await open(page, "/fleet");

  await expect(page.getByText("Phuket Mobility Observatory")).toBeVisible();
  await expect(page.getByRole("heading", { name: /fleet is outside our field of view|buses are visible on the road/i })).toBeVisible();
  await expect(page.getByText("Passenger load not measured")).toBeVisible();
  await expect(page.getByText(/does not claim occupancy, ridership, revenue, or demand/i)).toBeVisible();
});

test("compact live ops does not turn an unavailable feed into observed zeroes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/live-buses", (route) => route.fulfill({ status: 503, body: "unavailable" }));
  await open(page, "/ops?source=live");
  await expect(page.getByText("Tracker unreachable", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fleet map · GPS unavailable" })).toBeVisible();
  const totals = page.getByRole("region", { name: "Today's live totals" });
  await expect(totals.getByText("—", { exact: true })).toHaveCount(4);
});

test("capacity monitor keeps modelled demand separate from live telemetry", async ({ page }) => {
  await open(page, "/capacity?source=live");

  await expect(page.getByText("Modelled airport queue")).toBeVisible();
  await expect(page.getByText("Planning recommendation", { exact: true })).toBeVisible();
  await expect(page.getByText(/test \+\d+ buses? against real boardings before dispatch/i)).toBeVisible();
});
