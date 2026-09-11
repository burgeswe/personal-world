import { defineConfig } from "playwright/test";
// The `playwright` package (v1.57+) re-exports the full test runner at
// playwright/test — @playwright/test is not a separate dependency here.

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: "http://127.0.0.1:8731",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node e2e/server.mjs",
    url: "http://127.0.0.1:8731/healthz",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});