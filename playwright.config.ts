import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 4173);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  reporter: "dot",
  use: {
    baseURL,
    trace: "on-first-retry"
  },
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
  webServer: {
    command: `vite --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false
  }
});
