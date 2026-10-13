/**
 * Tiny HTTP helpers: cookie parsing, JSON body reading, redirects and static
 * file serving. Written by hand so the demo app has zero runtime dependencies.
 */
import fs from 'node:fs';
import path from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    if (key) out[key] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return out;
}

export function readBody(req, limit = 1024 * 1024) {
  return new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size <= limit) chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

export function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  res.end(body);
}

export function sendHtml(res, status, html) {
  res.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'content-length': Buffer.byteLength(html),
    'cache-control': 'no-store',
  });
  res.end(html);
}

export function redirect(res, location, cookies = []) {
  const headers = { location: String(location) };
  if (cookies.length) headers['set-cookie'] = cookies;
  res.writeHead(302, headers);
  res.end();
}

export function setCookie(name, value, { maxAge = 60 * 60 * 8 } = {}) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearCookie(name) {
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/** Serve a file from `dir` when the path maps onto a real file (no traversal). */
export function serveStatic(res, dir, urlPath) {
  const safe = urlPath.replace(/[?#].*$/, '');
  const absolute = path.resolve(dir, `.${path.posix.normalize(safe)}`);
  if (!absolute.startsWith(path.resolve(dir))) return false;
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) return false;
  const body = fs.readFileSync(absolute);
  res.writeHead(200, {
    'content-type': MIME[path.extname(absolute)] ?? 'application/octet-stream',
    'content-length': body.length,
    'cache-control': 'no-store',
  });
  res.end(body);
  return true;
}
