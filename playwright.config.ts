import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "HEIST_DECISION_MODE=scripted pnpm --filter @heist-one/server dev",
      port: 8787,
      reuseExistingServer: true,
    },
    {
      command: "pnpm --filter @heist-one/web dev --host 127.0.0.1",
      port: 4173,
      reuseExistingServer: true,
    },
  ],
});
