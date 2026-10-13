/**
 * env.js — single source of truth for the application under test origins.
 *
 * Both defaults point at the locally hosted QA Demo Portal (dummy-app/), so the
 * suite runs with no external dependency. Override them for a different
 * environment by exporting ADMIN_BASE_URL / TESTWEB_BASE_URL before running
 * Playwright (see .env.example).
 */
export const ADMIN_BASE_URL = process.env.ADMIN_BASE_URL ?? 'http://127.0.0.1:3100';
export const TESTWEB_BASE_URL = process.env.TESTWEB_BASE_URL ?? 'http://127.0.0.1:3000';

/** Configurator admin portal login page. */
export const ADMIN_LOGIN_URL = `${ADMIN_BASE_URL}/login`;
/** Test-web configurator login page. */
export const TESTWEB_LOGIN_URL = `${TESTWEB_BASE_URL}/login`;
