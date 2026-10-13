#!/usr/bin/env node
/**
 * Local QA Demo Portal — one Node process, two HTTP origins.
 *
 *   http://localhost:3000   configurator portal (role accounts: engineering,
 *                           sales, customer, distributor, admin)
 *   http://localhost:3100   administration portal (same accounts, admin route
 *                           permissions and datasets)
 *
 * Only Node built-ins are used, so `npm test` can start this without a network
 * install step. Health endpoints: GET /health on both ports.
 */
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApi, isPublicPath, routeGuard } from './lib/api.js';
import { parseCookies, readBody, redirect, sendHtml, sendJson, serveStatic } from './lib/http.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(here, 'public');

const ADMIN_PORT = Number(process.env.ADMIN_PORT || 3100);
const TESTWEB_PORT = Number(process.env.TESTWEB_PORT || 3000);

/** Admin routes the demo app actually renders; anything else is a 404 page. */
const KNOWN_ADMIN_PREFIXES = [
  '/login', '/dashboard', '/analytics', '/users', '/roles', '/applications', '/tasks',
  '/change-log', '/approvals', '/smtp', '/profile', '/settings', '/datasets',
];

const KNOWN_TESTWEB_PATHS = ['/login', '/register', '/forget-password', '/verify-email', '/installation-system', '/'];

/** Static demo page for the brand bar links so no link points off-machine. */
function brandPage(slug) {
  const label = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>${label} — QA Demo Portal</title><link rel="stylesheet" href="/assets/base.css" /></head>
  <body data-portal="testweb">
    <main class="card">
      <h1>${label}</h1>
      <p>Demo brand landing page served locally by the QA Demo Portal. It exists so the
      brand bar never points at an external site.</p>
      <p><a href="/">Back to the configurator</a></p>
    </main>
  </body>
</html>`;
}

function shell(portal) {
  const title = portal === 'admin' ? 'QA Demo Portal — Administration' : 'QA Demo Portal — Configurator';
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <link rel="stylesheet" href="/assets/base.css" />
  </head>
  <body data-portal="${portal}">
    <div id="app">
      <div class="loading loading-spinner" role="progressbar" aria-label="Loading">
        <span class="sr-only">Loading…</span>
      </div>
    </div>
    <script src="/assets/vendor-lite.js"></script>
    <script src="/assets/${portal}.js"></script>
  </body>
</html>`;
}

function notFoundPage(portal) {
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>Page Not Found</title><link rel="stylesheet" href="/assets/base.css" /></head>
  <body data-portal="${portal}">
    <main class="notfound">
      <h1>404 — Page Not Found</h1>
      <p>The page you requested does not exist on the QA Demo Portal.</p>
      <p><a href="/users">Back to the dashboard</a></p>
    </main>
  </body>
</html>`;
}

function createPortalServer(portal) {
  return async function onRequest(req, res) {
    const rawUrl = req.url || '/';
    const pathname = decodeURIComponent(rawUrl.split('?')[0]);
    req.qademoCookies = parseCookies(req.headers.cookie || '');

    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' });
      return res.end();
    }

    if (pathname === '/health') return sendJson(res, 200, { status: 'ok', portal, uptime: process.uptime() });

    if (pathname.startsWith('/assets/')) {
      if (serveStatic(res, publicDir, pathname.replace('/assets/', '/'))) return;
      return sendHtml(res, 404, '<h1>Asset not found</h1>');
    }

    if (pathname.startsWith('/api/')) {
      const body = req.method === 'GET' ? {} : await readBody(req);
      if (pathname === '/api/bootstrap') {
        console.log(`[${portal}] bootstrap cookie header:`, req.headers.cookie);
        console.log(`[${portal}] parsed cookies:`, req.qademoCookies);
      }
      return handleApi(req, res, { portal, pathname, body });
    }

    if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'Method not allowed' });

    const brandMatch = pathname.match(/^\/brand\/([a-z0-9-]+)$/i);
    if (brandMatch) return sendHtml(res, 200, brandPage(brandMatch[1]));

    const known = portal === 'admin'
      ? KNOWN_ADMIN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
      : KNOWN_TESTWEB_PATHS.includes(pathname);

    const guard = routeGuard({ portal, pathname, req });
    if (!guard.public && !guard.allow) return redirect(res, '/login');
    if (!known) return sendHtml(res, 404, notFoundPage(portal));
    return sendHtml(res, 200, shell(portal));
  };
}

function listen(port, handler, label) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      Promise.resolve(handler(req, res)).catch((error) => {
        process.stderr.write(`[${label}] ${error?.stack ?? error}\n`);
        if (!res.headersSent) sendJson(res, 500, { ok: false, error: 'Internal demo app error' });
        else res.end();
      });
    });
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

const servers = [];

/**
 * `--portal=admin|testweb` (or QADEMO_PORTAL) lets a supervisor (Playwright
 * webServer, CI job, …) start one origin per process so each has its own health
 * check. The default boots both. A CLI flag is used rather than `set X=…` so the
 * same command line works on Windows and Linux CI shells.
 */
const portalFlag = process.argv.find((arg) => arg.startsWith('--portal='));
const ONLY_PORTAL = String(portalFlag?.split('=')[1] ?? process.env.QADEMO_PORTAL ?? 'both').toLowerCase();

async function start() {
  const lines = ['QA Demo Portal ready'];
  if (ONLY_PORTAL !== 'admin') {
    servers.push(await listen(TESTWEB_PORT, createPortalServer('testweb'), 'testweb'));
    lines.push(`  configurator   http://localhost:${TESTWEB_PORT}  (health: /health)`);
  }
  if (ONLY_PORTAL !== 'testweb') {
    servers.push(await listen(ADMIN_PORT, createPortalServer('admin'), 'admin'));
    lines.push(`  administration http://localhost:${ADMIN_PORT}  (health: /health)`);
  }
  process.stdout.write(`${lines.join('\n')}\n`);
}

function shutdown(signal) {
  process.stdout.write(`\nQA Demo Portal shutting down (${signal})\n`);
  for (const server of servers) server.close();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start().catch((error) => {
  process.stderr.write(`Failed to start QA Demo Portal: ${error?.message ?? error}\n`);
  process.exit(1);
});
