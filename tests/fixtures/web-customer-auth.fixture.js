import { test as base, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TESTWEB_BASE_URL } from '../../src/config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const users = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../test-data/users.json'), 'utf-8')
);

const TESTWEB_BASE = TESTWEB_BASE_URL;

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.goto(`${TESTWEB_BASE}/login`, { waitUntil: 'load', timeout: 30000 });
    await page.getByRole('textbox', { name: /email/i }).fill(users.customer.username);
    await page.getByRole('button', { name: /sign in with a password instead/i }).click();
    await page.waitForTimeout(500);
    await page.getByRole('textbox', { name: /password/i }).fill(users.customer.password);
    await Promise.all([
      page.waitForURL(new RegExp(`${TESTWEB_BASE.replace('.', '\\.')}/?$`), { timeout: 30000 }),
      page.locator('form').getByRole('button', { name: /sign in/i }).click(),
    ]);

    await use(page);
  },
});

export { expect };
