// Tests de bout en bout : le jeu est servi tel quel et piloté dans Chromium,
// sur un écran de PC et sur un téléphone simulé (écran tactile).
import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

export default defineConfig({
  testDir: "tests",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `python3 -m http.server ${PORT} --directory Survivor`,
    url: `http://localhost:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
    stderr: "ignore",
  },
});
