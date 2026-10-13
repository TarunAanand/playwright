import { expect as playwrightExpect } from '@playwright/test';
import { ADMIN_BASE_URL } from '../../src/config/env.js';

/**
 * Wraps a Playwright assertion with a human-readable prefix message.
 * When the assertion fails, the report shows:
 *
 *   ─── Sign in should redirect to /users ───
 *   Expected: URL to match /\/users/
 *   Received: http://127.0.0.1:3100/login
 *
 * Usage:
 *   await assertThat("Sign in should redirect to /users", () => expect(page).toHaveURL(/\/users/));
 */
export async function assertThat(description, assertionFn) {
  try {
    await assertionFn();
  } catch (error) {
    const wrapped = new Error(`─── ${description} ───\n${error.message}`);
    wrapped.stack = error.stack;
    throw wrapped;
  }
}

export { playwrightExpect as expect };
