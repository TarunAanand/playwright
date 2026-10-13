/**
 * JSON API for the local QA Demo Portal.
 *
 * The API is shared by both portals so cross-portal behaviour that the suite
 * covers (an RFQ raised on the configurator becoming an admin task, SMTP
 * settings persisting across a reload) works against one in-process store.
 */
import {
  ACCESSORY_OPTIONS, BRANDS, DEPARTMENTS, ELEMENT_TYPES, FASTENER_GROUPS, FEEDER_TRACKS,
  FORCE_RANGES, MACHINE_OPTIONS, MAX_THREADS, REGIONS, SOLUTIONS,
  applicationsFor, applicationsForSession, canAccess, canQuote, canUndo, datasetSummaries,
  findUser, nextSequence, state, tableFor,
} from './store.js';
import { clearCookie, setCookie } from './http.js';

const SESSION_COOKIE = 'qademo_session';
const LOGIN_ERROR = 'Your sign-in could not be completed. Check your email address and password and try again.';
/** Deterministic OTP so tests never depend on a clock or a mailbox. */
const FIXED_OTP = '12345678';

const ADMIN_PUBLIC_PATHS = new Set(['/login', '/health']);
const TESTWEB_PUBLIC_PATHS = new Set(['/login', '/register', '/forget-password', '/health', '/verify-email']);

const registered = new Map();

function sessionFromRequest(req) {
  const token = req.qademoCookies[SESSION_COOKIE];
  if (!token) return null;
  return state.sessions.get(token) ?? null;
}

function userFromSession(req) {
  const session = sessionFromRequest(req);
  if (!session) return null;
  return { ...session.user, token: session.token ?? '', portal: session.portal };
}

function snapshotFor(portal, user, sessionToken) {
  const base = {
    portal,
    user: user ? { name: user.name, role: user.role, email: user.email, initials: user.initials, region: user.region } : null,
    brands: BRANDS,
    serverTime: new Date().toISOString(),
  };

  if (portal === 'admin') {
    return {
      ...base,
      permissions: user ? (canAccess(user.role, '*') ? ['*'] : adminRoutesFor(user.role)) : [],
      canUndo: user ? canUndo(user.role) : false,
      routes: ADMIN_ROUTES,
      datasets: datasetSummaries(),
      datasetDetails: Object.fromEntries(Object.entries(state.datasets).map(([key, table]) => [key, {
        title: table.title,
        heading: table.heading ?? table.title,
        description: table.description ?? `Record-level editor for ${table.title.toLowerCase()} data.`,
        addButton: table.addButton ?? 'Add record',
        columns: table.columns,
        records: table.records,
      }])),
      users: state.users,
      roles: state.roles,
      applications: state.applications,
      tasks: state.tasks,
      changelog: state.changelog,
      analytics: state.analytics,
      smtp: {
        enabled: state.smtp.enabled,
        fromEmail: state.smtp.fromEmail,
        fromName: state.smtp.fromName,
        relayUrl: state.smtp.relayUrl,
        relayRegion: state.smtp.relayRegion,
        testRecipient: state.smtp.testRecipient,
      },
      profile: user ? { name: user.name, email: user.email, role: user.role, region: user.region } : null,
    };
  }

  return {
    ...base,
    canQuote: user ? canQuote(user.role) : false,
    catalog: {
      solutions: SOLUTIONS,
      machineOptions: MACHINE_OPTIONS,
      accessories: ACCESSORY_OPTIONS,
      regions: REGIONS,
      elementTypes: ELEMENT_TYPES,
      maxThreads: MAX_THREADS,
      fastenerGroups: FASTENER_GROUPS,
      feederTracks: FEEDER_TRACKS,
      forceRanges: FORCE_RANGES,
      departments: DEPARTMENTS,
      categories: ['Handtools', 'Standalone Machines', 'Robotic Integration', 'InDie', 'Custom'],
    },
    applications: sessionToken ? applicationsForSession(sessionToken) : [],
  };
}

const ADMIN_ROUTES = [
  '/dashboard/overview', '/dashboard/reports', '/analytics', '/users', '/roles',
  '/applications', '/tasks', '/change-log', '/approvals', '/smtp', '/profile',
  '/settings/profile', '/settings/general', '/settings/permissions', '/settings/security',
];

function adminRoutesFor(role) {
  if (canAccess(role, '*')) return ['*'];
  const routes = [];
  for (const route of [...ADMIN_ROUTES, ...Object.values(state.datasets).map((table) => table.route)]) {
    if (canAccess(role, route)) routes.push(route);
  }
  return routes;
}

function createSession(res, user, portal) {
  const token = `${portal}-${Math.random().toString(36).slice(2, 12)}`;
  state.sessions.set(token, { token, user, portal, createdAt: Date.now() });
  return setCookie(SESSION_COOKIE, token);
}

function validationErrors(payload) {
  const errors = [];
  const firstName = String(payload.firstName ?? '').trim();
  const lastName = String(payload.lastName ?? '').trim();
  const email = String(payload.email ?? '').trim();
  const password = String(payload.password ?? '');
  const confirmPassword = String(payload.confirmPassword ?? password);
  const telephone = String(payload.telephone ?? '').trim();

  if (!firstName || !lastName) errors.push('First name and last name are required.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.push('Enter a valid email address.');
  if (!email) errors.push('Email address is required.');
  if (!password) errors.push('Password is required.');
  else if (password.length < 8) errors.push('Password must be at least 8 characters and contain a letter and a number.');
  else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) errors.push('Password must be at least 8 characters and contain a letter and a number.');
  if (confirmPassword !== password) errors.push('Passwords do not match.');
  if (telephone && !/^[+()\-.\s\d]{6,20}$/.test(telephone)) errors.push('Enter a valid telephone number.');
  if (email && (findUser(email) || registered.has(email.toLowerCase()))) errors.push('This email address is already registered.');
  return errors;
}

export function isPublicPath(portal, pathname) {
  const list = portal === 'admin' ? ADMIN_PUBLIC_PATHS : TESTWEB_PUBLIC_PATHS;
  return list.has(pathname);
}

export function routeGuard({ portal, pathname, req }) {
  const session = sessionFromRequest(req);
  const user = session ? session.user : null;
  if (isPublicPath(portal, pathname)) return { public: true, user };
  if (!user) return { allow: false, reason: 'no-session', user: null };
  if (portal === 'admin' && !canAccess(user.role, pathname)) return { allow: false, reason: 'forbidden', user };
  return { allow: true, user };
}

/** Handle an /api request. Returns true when the request was answered. */
export async function handleApi(req, res, { portal, pathname, body }) {
  const respond = (status, payload, headers = {}) => {
    const clean = { ...payload };
    if (clean['set-cookie']) {
      headers['set-cookie'] = clean['set-cookie'];
      delete clean['set-cookie'];
    }
    const json = JSON.stringify(clean);
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'content-length': Buffer.byteLength(json),
      'cache-control': 'no-store',
      ...headers,
    });
    res.end(json);
    return true;
  };

  if (pathname === '/api/health') return respond(200, { status: 'ok', portal });
  if (pathname === '/api/known-issues') return respond(200, { portal, issues: state.smtp.outbox.length });

  if (pathname === '/api/bootstrap') {
    const user = userFromSession(req);
    const sessionToken = req.qademoCookies[SESSION_COOKIE];
    console.log('[api] bootstrap sessionToken:', sessionToken, 'user:', user?.email);
    const snapshot = snapshotFor(portal, user, sessionToken);
    snapshot._debug = { sessionToken, hasSession: !!sessionToken };
    return respond(200, snapshot);
  }

  if (pathname === '/api/auth/login') {
    const user = findUser(body.email) ?? registered.get(String(body.email ?? '').toLowerCase()) ?? null;
    if (!user || user.password !== body.password) return respond(401, { ok: false, error: LOGIN_ERROR });
    const target = portal === 'admin'
      ? (canAccess(user.role, '/users') ? '/users' : (adminRoutesFor(user.role)[0] ?? '/profile'))
      : '/';
    return respond(200, { ok: true, redirect: target, user: { name: user.name, role: user.role }, 'set-cookie': createSession(res, user, portal) });
  }

  if (pathname === '/api/auth/magic') {
    const email = String(body.email ?? '').trim().toLowerCase();
    state.codes.set(email, FIXED_OTP);
    return respond(200, { ok: true, message: `We sent an 8-digit code to ${email || 'your inbox'}.`, otp: FIXED_OTP });
  }

  if (pathname === '/api/auth/otp') {
    const email = String(body.email ?? '').trim().toLowerCase();
    const expected = state.codes.get(email) ?? FIXED_OTP;
    if (String(body.otp ?? '').replace(/\s/g, '') !== expected) return respond(400, { ok: false, error: 'The code you entered is not valid.' });
    const user = findUser(email) ?? registered.get(email);
    if (!user) return respond(401, { ok: false, error: LOGIN_ERROR });
    return respond(200, { ok: true, redirect: portal === 'admin' ? '/users' : '/', 'set-cookie': createSession(res, user, portal) });
  }

  if (pathname === '/api/auth/logout') {
    const token = req.qademoCookies[SESSION_COOKIE];
    if (token) state.sessions.delete(token);
    return respond(200, { ok: true, redirect: '/login', 'set-cookie': clearCookie(SESSION_COOKIE) });
  }

  if (pathname === '/api/auth/register') {
    const errors = validationErrors(body);
    if (errors.length) return respond(422, { ok: false, errors });
    const email = String(body.email).trim().toLowerCase();
    const name = `${String(body.firstName).trim()} ${String(body.lastName).trim()}`;
    registered.set(email, {
      email,
      password: body.password,
      name,
      role: 'External/Customer',
      initials: name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
      region: body.regionCode || REGIONS[0],
    });
    state.users.push({ id: `USR-${state.users.length + 1}`, cells: [name, email, 'External/Customer', body.regionCode || REGIONS[0], 'Pending'] });
    return respond(200, { ok: true, redirect: '/verify-email' });
  }

  if (pathname === '/api/auth/forgot') {
    const email = String(body.email ?? '').trim().toLowerCase();
    if (!email) return respond(422, { ok: false, error: 'Enter your registered email address to receive a one-time password.' });
    state.codes.set(email, FIXED_OTP);
    return respond(200, { ok: true, message: 'OTP sent. Enter the 8-digit code to continue.' });
  }

  /* ---------------- admin mutations ---------------- */

  if (pathname.startsWith('/api/admin/smtp')) {
    const user = userFromSession(req);
    if (user?.role !== 'Admin') return respond(403, { ok: false, error: 'Admin role required.' });
    if (pathname === '/api/admin/smtp' && req.method === 'PUT') {
      Object.assign(state.smtp, {
        enabled: Boolean(body.enabled),
        fromEmail: String(body.fromEmail ?? state.smtp.fromEmail),
        fromName: String(body.fromName ?? state.smtp.fromName),
        relayUrl: String(body.relayUrl ?? state.smtp.relayUrl),
        relayRegion: String(body.relayRegion ?? state.smtp.relayRegion),
        testRecipient: String(body.testRecipient ?? state.smtp.testRecipient),
      });
      return respond(200, { ok: true, smtp: state.smtp });
    }
    if (pathname === '/api/admin/smtp/test') {
      const recipient = String(body.recipient ?? '').trim() || state.smtp.testRecipient;
      state.smtp.outbox.push({ id: nextSequence('record', 'MAIL-'), kind: 'test', recipient, subject: 'QA Demo Portal test email', at: new Date().toISOString() });
      return respond(200, { ok: true, recipient, message: 'Test email queued locally.' });
    }
  }

  if (pathname.startsWith('/api/admin/datasets')) {
    const parts = pathname.split('/').filter(Boolean);
    const key = parts[2];
    const table = tableFor(key);
    if (!table) return respond(404, { ok: false, error: 'Unknown dataset.' });
    const action = parts[3];

    if (req.method === 'POST' && (!action || action === 'records')) {
      const id = nextSequence('record', `${key.slice(0, 2).toUpperCase()}-`);
      const cells = table.columns.map((column, index) => {
        const provided = Array.isArray(body.cells) ? body.cells[index] : undefined;
        if (provided !== undefined) return provided;
        if (/status/i.test(column)) return 'Draft';
        if (/price/i.test(column)) return '$0.00';
        if (/region/i.test(column)) return REGIONS[0];
        return `New ${column}`;
      });
      table.records.push({ id, cells });
      state.changelog.unshift({ id: nextSequence('record', 'CHG-'), at: new Date().toISOString().slice(0, 16).replace('T', ' '), actor: 'John Smith', entity: table.title, action: `Added record ${id}` });
      return respond(200, { ok: true, record: { id, cells }, records: table.records });
    }

    if (req.method === 'PATCH' && action === 'records') {
      const record = table.records.find((entry) => entry.id === body.id);
      if (!record) return respond(404, { ok: false, error: 'Record not found.' });
      if (body.status) record.cells[record.cells.length - 1] = body.status;
      if (Array.isArray(body.cells)) record.cells = body.cells;
      if (body.cellIndex !== undefined) record.cells[Number(body.cellIndex)] = body.value;
      return respond(200, { ok: true, record, records: table.records });
    }

    if (req.method === 'DELETE' && action === 'records') {
      const index = table.records.findIndex((entry) => entry.id === body.id);
      if (index === -1) return respond(404, { ok: false, error: 'Record not found.' });
      const [removed] = table.records.splice(index, 1);
      return respond(200, { ok: true, removed, records: table.records });
    }

    if (req.method === 'POST' && action === 'undo') {
      return respond(200, { ok: true, message: 'Change reverted.' });
    }

    if (req.method === 'GET') return respond(200, { ok: true, records: table.records });
  }

  /* ---------------- configurator mutations ---------------- */

  if (pathname === '/api/configurator/applications' && req.method === 'POST') {
    const user = userFromSession(req);
    const sessionToken = req.qademoCookies[SESSION_COOKIE];
    const list = applicationsForSession(sessionToken);
    const name = String(body.name ?? '').trim();
    if (!name) return respond(422, { ok: false, error: 'Application name is required.' });
    const volume = Number(body.volume ?? 0);
    if (volume < 0) return respond(422, { ok: false, error: 'Annual volume cannot be negative.' });
    const record = {
      id: nextSequence('application', 'APP-'),
      name,
      appNumber: String(body.appNumber ?? ''),
      oem: String(body.oem ?? ''),
      program: String(body.program ?? ''),
      volume: Number.isFinite(volume) ? volume : 0,
      batch: Number(body.batchSize ?? 0),
      material: String(body.material ?? ''),
      fasteners: Array.isArray(body.fasteners) ? body.fasteners : [],
      owner: user?.name ?? 'Guest',
    };
    list.push(record);
    return respond(200, { ok: true, application: record, applications: list });
  }

  if (pathname === '/api/configurator/applications/update' && req.method === 'POST') {
    const user = userFromSession(req);
    const sessionToken = req.qademoCookies[SESSION_COOKIE];
    const list = applicationsForSession(sessionToken);
    const record = list.find((entry) => entry.id === body.id);
    if (!record) return respond(404, { ok: false, error: 'Application not found.' });
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) return respond(422, { ok: false, error: 'Application name is required.' });
      record.name = name;
    }
    for (const [field, key] of [['appNumber', 'appNumber'], ['oem', 'oem'], ['program', 'program'], ['volume', 'volume'], ['batchSize', 'batch'], ['material', 'material']]) {
      if (body[field] !== undefined) record[key] = field === 'volume' || field === 'batchSize' ? Number(body[field]) : body[field];
    }
    return respond(200, { ok: true, application: record, applications: list });
  }

  if (pathname === '/api/configurator/applications/delete' && req.method === 'POST') {
    const user = userFromSession(req);
    const sessionToken = req.qademoCookies[SESSION_COOKIE];
    const list = applicationsForSession(sessionToken);
    const index = list.findIndex((entry) => entry.id === body.id);
    if (index !== -1) list.splice(index, 1);
    return respond(200, { ok: true, applications: list });
  }

  if (pathname === '/api/configurator/rfq' && req.method === 'POST') {
    const user = userFromSession(req);
    const task = {
      id: nextSequence('task', 'TASK-'),
      title: `Quotation request ${nextSequence('quotation', 'Q-')}`,
      type: 'RFQ',
      owner: user?.name ?? 'Customer',
      status: 'Open',
      detail: `${body.solution ?? 'A210'} — ${body.application ?? 'No application selected'} — ${body.email ?? user?.email ?? ''}`,
    };
    state.tasks.unshift(task);
    state.analytics.totals.openTasks = state.tasks.filter((entry) => entry.status === 'Open').length;
    const mapRecord = state.datasets['responsibility-map'].records[0];
    state.smtp.outbox.push({
      id: nextSequence('record', 'MAIL-'),
      kind: 'rfq',
      recipient: mapRecord.cells[2],
      subject: `New RFQ from ${user?.name ?? 'Customer'}`,
      body: `${task.title}: ${task.detail}`,
      at: new Date().toISOString(),
    });
    return respond(200, { ok: true, message: 'Your request has been submitted. Our team will contact you.', task });
  }

  return respond(404, { ok: false, error: `Unknown API endpoint: ${req.method} ${pathname}` });
}

export { ADMIN_ROUTES, SESSION_COOKIE, snapshotFor, userFromSession };
