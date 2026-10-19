import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 4173);
const apiPort = Number(process.env.API_PORT ?? 3099);
// `bus.localhost` exercises the same hostname routing as bus.nonarkara.org.
// Plain localhost is intentionally the research-toolkit front door.
const baseURL = `http://bus.localhost:${port}`;
const apiURL = `http://127.0.0.1:${apiPort}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // The app mounts two live maps and an API server per run. Capping workers
  // keeps the browser check deterministic on CI and ordinary laptops.
  workers: 1,
  timeout: 90_000,
  forbidOnly: Boolean(process.env.CI),
  reporter: "dot",
  use: {
    baseURL,
    navigationTimeout: 90_000,
    trace: "on-first-retry"
  },
  expect: { timeout: 60_000 },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        browserName: "chromium",
        ...devices["Desktop Chrome"]
      }
    },
    {
      name: "mobile-iphone13",
      use: {
        browserName: "chromium",
        ...devices["iPhone 13"]
      }
    }
  ],
  webServer: [
    {
      command: `PORT=${apiPort} npm run dev:api:test`,
      url: `${apiURL}/health/live`,
      reuseExistingServer: false
    },
    {
      command: `API_PORT=${apiPort} PLAYWRIGHT_PORT=${port} npm run dev:web:test`,
      url: baseURL,
      reuseExistingServer: false
    }
  ]
});
