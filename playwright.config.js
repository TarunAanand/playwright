import { defineConfig, devices } from '@playwright/test';
import { cpus } from 'os';
import 'dotenv/config';

/**
 * The system under test is the locally hosted QA Demo Portal (dummy-app/), so no
 * credentials, VPN or third-party SaaS is required to run the suite. Both origins
 * are started by Playwright's webServer with a real HTTP health check, and the
 * process is shut down when the run finishes.
 *
 * Override only when pointing the suite at another deployment:
 *   ADMIN_PORT / TESTWEB_PORT   ports the demo app binds
 *   ADMIN_BASE_URL / TESTWEB_BASE_URL   origins the tests navigate to
 *   BASE_URL                    Playwright baseURL shortcut (defaults to admin)
 */
const ADMIN_PORT = process.env.ADMIN_PORT ?? '3100';
const TESTWEB_PORT = process.env.TESTWEB_PORT ?? '3000';

const ADMIN_BASE_URL = process.env.ADMIN_BASE_URL ?? `http://127.0.0.1:${ADMIN_PORT}`;
const TESTWEB_BASE_URL = process.env.TESTWEB_BASE_URL ?? `http://127.0.0.1:${TESTWEB_PORT}`;

// Page Objects and fixtures read these, so workers must see them too.
process.env.ADMIN_BASE_URL = ADMIN_BASE_URL;
process.env.TESTWEB_BASE_URL = TESTWEB_BASE_URL;

const demoApp = (portal, port) => ({
  command: `node dummy-app/server.js --portal=${portal}`,
  url: `http://127.0.0.1:${port}/health`,
  timeout: 60_000,
  reuseExistingServer: !process.env.CI,
  stdout: 'pipe',
  stderr: 'pipe',
});

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: process.env.CI ? 1 : Math.min(8, cpus().length),

  reporter: [
    ['html', { outputFolder: 'reports/playwright-report', open: 'never' }],
    ['json', { outputFile: 'reports/last-run.json' }],
    ['allure-playwright', { outputFolder: 'allure-results' }],
    ['list'],
  ],

  use: {
    baseURL: process.env.BASE_URL || ADMIN_BASE_URL,
    headless: true,
    screenshot: 'only-on-failure',
    video:      'on',
    trace:      'on-first-retry',
    actionTimeout:     10_000,
    navigationTimeout: 15_000,
  },

  webServer: [demoApp('testweb', TESTWEB_PORT), demoApp('admin', ADMIN_PORT)],

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
