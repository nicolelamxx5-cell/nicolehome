import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against a production build (`npm run build && npm start`)
// backed by the local Supabase stack (`npx supabase start`). They wipe the local
// database first, so never point them at a real project.
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "off",
    screenshot: "only-on-failure",
  },
  // iPhone screen, touch and user agent emulated on Chromium (WebKit is not installed
  // here). This is not a substitute for testing on a real iPhone.
  projects: [{ name: "iphone", use: { ...devices["iPhone 13"], browserName: "chromium" } }],
});
