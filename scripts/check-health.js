#!/usr/bin/env node
/**
 * check-health.js — probe the locally hosted QA Demo Portal origins.
 *
 *   node scripts/check-health.js            checks both default ports
 *   ADMIN_BASE_URL=... TESTWEB_BASE_URL=...  override the origins
 *
 * Exits 0 when every probed /health endpoint answers, 1 otherwise. Uses only
 * Node built-ins so it works before `npm test` starts the app.
 */
const targets = [
  ['administration', process.env.ADMIN_BASE_URL ?? 'http://127.0.0.1:3100'],
  ['configurator', process.env.TESTWEB_BASE_URL ?? 'http://127.0.0.1:3000'],
];

let failed = 0;

for (const [label, origin] of targets) {
  const url = `${origin.replace(/\/$/, '')}/health`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const body = await response.json();
    if (response.ok && body.status === 'ok') {
      process.stdout.write(`ok   ${label.padEnd(15)} ${url}  portal=${body.portal} uptime=${Math.round(body.uptime)}s\n`);
    } else {
      process.stderr.write(`FAIL ${label.padEnd(15)} ${url}  HTTP ${response.status}\n`);
      failed += 1;
    }
  } catch (error) {
    process.stderr.write(`FAIL ${label.padEnd(15)} ${url}  ${error.name}: ${error.message}\n`);
    failed += 1;
  }
}

process.exit(failed === 0 ? 0 : 1);
