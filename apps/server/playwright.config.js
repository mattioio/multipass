import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/smoke",
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL: "http://127.0.0.1:3000",
    headless: true
  },
  webServer: [
    {
      command: "npm run dev:api",
      url: "http://127.0.0.1:3001",
      reuseExistingServer: false,
      timeout: 120_000
    },
    {
      command: "npm --prefix ../web run dev -- --host 127.0.0.1 --port 3000",
      url: "http://127.0.0.1:3000",
      reuseExistingServer: false,
      timeout: 120_000
    }
  ]
});
