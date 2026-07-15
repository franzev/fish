import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_QUALITY_BASE_URL ?? "http://localhost:3002";

export default defineConfig({
  testDir: "./e2e/quality",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    colorScheme: "light",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "quality-chromium",
      use: {
        channel: "chrome",
        launchOptions: {
          args: [
            "--use-fake-device-for-media-stream",
            "--use-fake-ui-for-media-stream",
          ],
        },
      },
    },
  ],
  webServer: {
    command: "pnpm exec next start -p 3002",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
