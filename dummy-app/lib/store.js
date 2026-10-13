/**
 * Deterministic in-memory data store for the local QA Demo Portal.
 *
 * Both portals (admin + testweb) talk to this same store, which is why the RFQ
 * flow created on the testweb portal shows up as a task on the admin portal.
 * Nothing here reaches the network: there are no third-party APIs, no mail
 * transport and no persistent disk state.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const usersFile = path.resolve(here, '..', '..', 'test-data', 'users.json');

/** Demo credentials live in test-data/users.json (single source of truth). */
export const demoUsers = JSON.parse(fs.readFileSync(usersFile, 'utf8'));

/**
 * Display names per account. Tests assert on these names in the header menus of
 * both portals, so they are part of the demo contract, not incidental text.
 */
const PROFILES = {
  'admin@penn.com': { name: 'John Smith', role: 'Admin', initials: 'JS' },
  'engineering@penn.com': { name: 'David Wilson', role: 'Engineering', initials: 'DW' },
  'sales@penn.com': { name: 'Michael Johnson', role: 'Internal Sales', initials: 'MJ' },
  'customer@penn.com': { name: 'Emily Brown', role: 'External/Customer', initials: 'EB' },
  'distributor@penn.com': { name: 'Robert Davis', role: 'Distributor/Partner', initials: 'RD' },
};

const REGION_BY_ROLE = {
  Admin: 'North America',
  Engineering: 'Europe',
  'Internal Sales': 'North America',
  'External/Customer': 'North America',
  'Distributor/Partner': 'Asia Pacific',
};

/** Admin-portal permission matrix. */
const ADMIN_PERMISSIONS = {
  Admin: ['*'],
  Engineering: [
    '/users', '/applications', '/tasks', '/change-log', '/profile',
    '/settings/profile', '/settings/general', '/settings/security',
    '/datasets/machine-options', '/datasets/machine-options-us', '/datasets/cad-3d-settings',
    '/datasets/products', '/datasets/fasteners', '/datasets/profil-fasteners',
    '/datasets/autoriv-fasteners', '/datasets/sherex-fasteners', '/datasets/profil-indie-options',
    '/datasets/tooling-sets', '/datasets/landing-content', '/datasets/responsibility-map',
    '/datasets/tasks-raw',
  ],
  'Internal Sales': [
    '/users', '/applications', '/tasks', '/change-log', '/analytics', '/profile',
    '/settings/profile', '/settings/general', '/settings/permissions', '/settings/security',
    '/datasets/cost-models', '/datasets/pemserter-eur', '/datasets/pemserter-usd',
    '/datasets/tasks-raw', '/datasets/responsibility-map',
  ],
  'External/Customer': ['/users', '/applications', '/tasks', '/profile', '/settings/profile'],
  'Distributor/Partner': ['/applications', '/tasks', '/profile', '/settings/profile'],
};

/** Admin-portal routes that only the Admin role may undo changes on. */
const UNDO_ROLES = ['Admin'];

export const ROLES = Object.keys(ADMIN_PERMISSIONS);

let clock = 0;
const nextId = (prefix) => `${prefix}-${(++clock).toString().padStart(4, '0')}`;

/* ------------------------------------------------------------------ *
 * Static demo catalogue                                               *
 * ------------------------------------------------------------------ */

/** Installation-system solutions offered by the configurator. */
export const SOLUTIONS = [
  { id: 'solution-A210', name: 'A210', category: 'Standalone Machines', brand: 'PEM', force: [8, 25], thread: 'M6', elements: ['PEM'], price: 18500, features: ['Auto-Feed', 'Process Monitoring'] },
  { id: 'solution-824MSPe', name: '824 eDrive', category: 'Handtools', brand: 'SHEREX', force: [4, 12], thread: 'M5', elements: ['PEM', 'SHEREX'], price: 9800, features: ['Auto-Feed', 'Torque Control'] },
  { id: 'solution-A240CP', name: 'A240-CP', category: 'Standalone Machines', brand: 'PROFIL', force: [12, 40], thread: 'M8', elements: ['PROFIL'], price: 24600, features: ['Vision Sensor'] },
  { id: 'solution-MDS100', name: 'MDS A100', category: 'Robotic Integration', brand: 'PEM', force: [20, 60], thread: 'M10', elements: ['PEM', 'Other fasteners'], price: 41200, features: ['Robot Interface'] },
  { id: 'solution-FullCustom', name: 'Full Custom Solution', category: 'Custom', brand: 'PEM', force: [60, 120], thread: 'M12', elements: ['PEM', 'SHEREX', 'PROFIL', 'Other fasteners'], price: 88000, features: ['Engineered To Order'] },
  { id: 'solution-InDie12', name: 'InDie 12', category: 'InDie', brand: 'PROFIL', force: [10, 30], thread: 'M6', elements: ['PROFIL'], price: 31400, features: ['Die Mounted'] },
];

/** Machine + accessory options shown inside the configuration panel. */
export const MACHINE_OPTIONS = [
  { code: 'QA-1200', name: 'Heavy Duty Frame', group: 'All groups', tracks: 'Single track', force: '8 - 25 kN', price: 6400, kind: 'machine' },
  { code: 'QA-1310', name: 'Double Feeder Column', group: 'PEM fasteners', tracks: 'Double track', force: '12 - 40 kN', price: 5200, kind: 'machine' },
  { code: 'QA-1420', name: 'Stand Mount Base', group: 'Profil fasteners', tracks: 'Single track', force: '0 - 12 kN', price: 2800, kind: 'machine' },
];

export const ACCESSORY_OPTIONS = [
  { code: 'AX-2010', name: 'Auto-Feed Unit', group: 'All groups', tracks: 'Single track', force: '8 - 25 kN', price: 3100, kind: 'option' },
  { code: 'AX-2020', name: 'Changeover Set', group: 'PEM fasteners', tracks: 'Double track', force: '12 - 40 kN', price: 1750, kind: 'option' },
  { code: 'AX-2030', name: 'Process Monitoring Kit', group: 'All groups', tracks: 'Single track', force: '0 - 12 kN', price: 2450, kind: 'option' },
  { code: 'AX-2040', name: 'Vision Sensor', group: 'Profil fasteners', tracks: 'Double track', force: '20 - 60 kN', price: 3900, kind: 'option' },
  { code: 'AX-2050', name: 'Torque Control Module', group: 'Other fasteners', tracks: 'Single track', force: '8 - 25 kN', price: 1250, kind: 'option' },
];

export const BRANDS = [
  { label: 'PEMnet', href: '/brand/pemnet' },
  { label: 'Profil-Global', href: '/brand/profil-global' },
  { label: 'Haeger', href: '/brand/haeger' },
  { label: 'Autoriv', href: '/brand/autoriv' },
  { label: 'Sherex', href: '/brand/sherex' },
];

export const REGIONS = ['North America', 'Europe', 'Asia Pacific', 'South America', 'MEA'];
export const ELEMENT_TYPES = ['PEM', 'SHEREX', 'PROFIL', 'Other fasteners'];
export const MAX_THREADS = ['M4', 'M5', 'M6', 'M8', 'M10', 'M12'];
export const FASTENER_GROUPS = ['All groups', 'PEM fasteners', 'Profil fasteners', 'Other fasteners'];
export const FEEDER_TRACKS = ['Single track', 'Double track', 'Triple track'];
export const FORCE_RANGES = ['Any', '0 - 12 kN', '8 - 25 kN', '12 - 40 kN', '20 - 60 kN', '60 - 120 kN'];
export const DEPARTMENTS = ['Engineering', 'Manufacturing', 'Quality', 'Purchasing', 'Research'];

/* ------------------------------------------------------------------ *
 * Admin datasets                                                      *
 * ------------------------------------------------------------------ */

const row = (id, cells) => ({ id, cells });

function datasetSeed() {
  return {
    'machine-options': {
      title: 'Machine Options',
      route: '/datasets/machine-options',
      group: 'Machine',
      columns: ['Product', 'Description', 'Region', 'Force (kN)', 'Price (USD)', 'Status'],
      records: [
        row('MO-1', ['A210 Standard', 'Standalone feeding machine', 'North America', '8 - 25', '$18,500.00', 'Active']),
        row('MO-2', ['824 eDrive', 'Handtool with torque control', 'North America', '4 - 12', '$9,800.00', 'Active']),
        row('MO-3', ['MDS A100', 'Robotic integration platform', 'Europe', '20 - 60', '$41,200.00', 'Draft']),
        row('MO-4', ['Full Custom Solution', 'Engineered to order', 'Asia Pacific', '60 - 120', '$88,000.00', 'Active']),
      ],
    },
    'machine-options-us': {
      title: 'Machine Options US',
      route: '/datasets/machine-options-us',
      group: 'Machine',
      columns: ['Product', 'Description', 'Region', 'Force (kN)', 'Price (USD)', 'Status'],
      records: [
        row('MOU-1', ['A210 US Build', 'US assembled standalone machine', 'North America', '8 - 25', '$19,750.00', 'Active']),
        row('MOU-2', ['824 eDrive US', 'US warehouse configuration', 'North America', '4 - 12', '$10,400.00', 'Active']),
        row('MOU-3', ['A240-CP US', 'US spec press unit', 'North America', '12 - 40', '$25,900.00', 'Retired']),
      ],
    },
    'cad-3d-settings': {
      title: 'CAD 3D Settings',
      route: '/datasets/cad-3d-settings',
      group: 'Machine',
      columns: ['Model', 'Format', 'Units', 'Status'],
      records: [
        row('CAD-1', ['A210 Assembly', 'STEP', 'Metric', 'Active']),
        row('CAD-2', ['824 eDrive Handtool', 'IGES', 'Imperial', 'Active']),
      ],
    },
    products: {
      title: 'Products',
      route: '/datasets/products',
      group: 'Products',
      columns: ['Product Code', 'Name', 'Category', 'Brand', 'Status'],
      records: [
        row('PRD-1', ['PEMSerter S', 'Self-clinching fastener', 'Fasteners', 'PEM', 'Active']),
        row('PRD-2', ['Sherex Bulb-Tite', 'Lockbolt', 'Fasteners', 'Sherex', 'Active']),
        row('PRD-3', ['Profil stud', 'Weld stud', 'Fasteners', 'Profil', 'Draft']),
      ],
    },
    fasteners: {
      title: 'Fasteners',
      route: '/datasets/fasteners',
      group: 'Products',
      columns: ['Code', 'Type', 'Material', 'Size', 'Status'],
      records: [
        row('FST-1', ['SS', 'A4', 'M5', 'Active']),
        row('FST-2', ['CLS', 'Carbon', 'M6', 'Active']),
        row('FST-3', ['SSL', 'A2', 'M8', 'Draft']),
      ],
    },
    'profil-fasteners': {
      title: 'Profil Fasteners',
      route: '/datasets/profil-fasteners',
      group: 'Products',
      columns: ['Code', 'Type', 'Coating', 'Status'],
      records: [row('PF-1', ['CGM', 'Zinc', 'Active']), row('PF-2', ['CGB', 'Plain', 'Active'])],
    },
    'autoriv-fasteners': {
      title: 'Autoriv Fasteners',
      route: '/datasets/autoriv-fasteners',
      group: 'Products',
      columns: ['Code', 'Type', 'Diameter', 'Status'],
      records: [row('AR-1', ['Flow drill screw', '4.8', 'Active']), row('AR-2', ['Self-piercing rivet', '5.0', 'Draft'])],
    },
    'sherex-fasteners': {
      title: 'Sherex Fasteners',
      route: '/datasets/sherex-fasteners',
      group: 'Products',
      columns: ['Code', 'Type', 'Length', 'Status'],
      records: [row('SX-1', ['Bulb-Tite', '25 mm', 'Active']), row('SX-2', ['Magna-Bulb', '30 mm', 'Active'])],
    },
    'profil-indie-options': {
      title: 'Profil Indie Options',
      route: '/datasets/profil-indie-options',
      group: 'Products',
      columns: ['Option', 'In-die', 'Notes', 'Status'],
      records: [row('PI-1', ['Indie Feed 6', 'Yes', 'Prototype', 'Draft'])],
    },
    'tooling-sets': {
      title: 'Tooling Sets',
      route: '/datasets/tooling-sets',
      group: 'Tooling',
      columns: ['Set', 'Anvil', 'Driver', 'Price (USD)', 'Status'],
      records: [
        row('TLS-1', ['AN-100', 'DR-220', 'M5', '$320.00', 'Active']),
        row('TLS-2', ['AN-140', 'DR-260', 'M6', '$410.00', 'Active']),
      ],
    },
    'cost-models': {
      title: 'Cost Models',
      route: '/datasets/cost-models',
      group: 'Calculations',
      columns: ['Model', 'Cycle time (s)', 'Fasteners / part', 'Cost / 1000 parts (USD)', 'Status'],
      records: [
        row('CM-1', ['A210 baseline', '3.4', '12', '$1,240.00', 'Active']),
        row('CM-2', ['824 eDrive baseline', '5.1', '8', '$980.00', 'Active']),
      ],
    },
    'pemserter-eur': {
      title: 'Pemserter Price EUR',
      route: '/datasets/pemserter-eur',
      group: 'Pricing',
      columns: ['Product', 'EUR price', 'VAT region', 'Status'],
      records: [
        row('EEUR-1', ['PEMSerter S M5', '€1,240.00', 'DE', 'Active']),
        row('EEUR-2', ['PEMSerter S M6', '€1,380.00', 'FR', 'Active']),
      ],
    },
    'pemserter-usd': {
      title: 'Pemserter Price USD',
      route: '/datasets/pemserter-usd',
      group: 'Pricing',
      columns: ['Product', 'USD price', 'Warehouse', 'Status'],
      records: [
        row('EUSD-1', ['PEMSerter S M5', '$1,345.00', 'US-East', 'Active']),
        row('EUSD-2', ['PEMSerter S M6', '$1,499.00', 'US-West', 'Active']),
      ],
    },
    'landing-content': {
      title: 'Landing Content',
      route: '/datasets/landing-content',
      group: 'Content',
      columns: ['Slot', 'Headline', 'Language', 'Status'],
      records: [
        row('LC-1', ['Find your installation system', 'EN', 'Active']),
        row('LC-2', ['Compare solutions in minutes', 'DE', 'Draft']),
      ],
    },
    'tasks-raw': {
      title: 'Tasks Raw Dataset',
      route: '/datasets/tasks-raw',
      group: 'Content',
      columns: ['Task', 'Source', 'Owner', 'Status'],
      records: [
        row('TR-1', ['RFQ-1001', 'Sales', 'Michael Johnson', 'Open']),
        row('TR-2', ['RFQ-1002', 'Engineering', 'David Wilson', 'Closed']),
      ],
    },
    'responsibility-map': {
      title: 'Dataset: Responsibility Map',
      route: '/datasets/responsibility-map',
      group: 'Content',
      heading: 'Dataset: Responsibility Map',
      description: 'Record-level editor for mappings between brands, regions and the sales and engineering contacts that receive notifications.',
      addButton: 'Add mapping',
      columns: ['Brand', 'Region', 'Sales emails', 'Engineering emails', 'Status'],
      records: [
        row('RM-1', ['Haeger', 'North America', 'sales.na@qa-demo.invalid, haeger.sales@qa-demo.invalid', 'haeger.eng@qa-demo.invalid', 'Active']),
        row('RM-2', ['MDS', 'Europe', 'mds.sales@qa-demo.invalid', 'mds.eng@qa-demo.invalid, platform.eng@qa-demo.invalid', 'Active']),
        row('RM-3', ['PEMSerter', 'North America', 'pemserter.sales@qa-demo.invalid', 'pemserter.eng@qa-demo.invalid', 'Active']),
        row('RM-4', ['PROFIL', 'Asia Pacific', 'profil.apac@qa-demo.invalid', 'profil.eng@qa-demo.invalid', 'Draft']),
        row('RM-5', ['Sherex', 'South America', 'sherex.latam@qa-demo.invalid', 'sherex.eng@qa-demo.invalid', 'Active']),
      ],
    },
  };
}

/* ------------------------------------------------------------------ *
 * Runtime state                                                       *
 * ------------------------------------------------------------------ */

export const state = {
  /** session token -> { email, portal, createdAt } */
  sessions: new Map(),
  /** email -> pending magic-link / OTP code */
  codes: new Map(),
  /** admin dataset tables */
  datasets: datasetSeed(),
  /** admin users table */
  users: Object.entries(PROFILES).map(([email, profile], index) => ({
    id: `USR-${index + 1}`,
    cells: [profile.name, email, profile.role, REGION_BY_ROLE[profile.role], index % 3 === 2 ? 'Inactive' : 'Active'],
  })),
  roles: [
    { id: 'ROLE-1', cells: ['Admin', 'Full access to every dataset and setting', '5', 'Active'] },
    { id: 'ROLE-2', cells: ['Engineering', 'Datasets and applications, no pricing', '9', 'Active'] },
    { id: 'ROLE-3', cells: ['Internal Sales', 'Applications, tasks and pricing', '12', 'Active'] },
    { id: 'ROLE-4', cells: ['External/Customer', 'Own applications and tasks only', '48', 'Active'] },
    { id: 'ROLE-5', cells: ['Distributor/Partner', 'Applications and tasks only', '17', 'Active'] },
  ],
  applications: [
    { id: 'APP-1001', name: 'Battery tray front', oem: 'Volvo', program: 'EX30', volume: 240000, batch: 120, material: 'Aluminium 6060', region: 'Europe', owner: 'David Wilson', status: 'Open', solution: 'A210' },
    { id: 'APP-1002', name: 'Door hinge carrier', oem: 'Tesla', program: 'CYB', volume: 150000, batch: 60, material: 'Steel HSLA', region: 'North America', owner: 'Emily Brown', status: 'In Review', solution: '824 eDrive' },
  ],
  tasks: [
    { id: 'TASK-1001', title: 'Review quotation Q-1001', type: 'Quotation', owner: 'Michael Johnson', status: 'Open', detail: 'Battery tray front — 240,000 parts / year' },
  ],
  changelog: [
    { id: 'CHG-1001', at: '2026-01-12 09:24', actor: 'John Smith', entity: 'Machine Options', action: 'Updated price for A210 Standard' },
    { id: 'CHG-1002', at: '2026-01-11 15:02', actor: 'David Wilson', entity: 'Fasteners', action: 'Added CLS A4 M6' },
    { id: 'CHG-1003', at: '2026-01-10 11:47', actor: 'John Smith', entity: 'Responsibility Map', action: 'Mapped Sherex South America sales contact' },
  ],
  smtp: {
    enabled: true,
    fromEmail: 'no-reply@qa-demo.invalid',
    fromName: 'QA Demo Portal',
    relayUrl: 'https://relay.qa-demo.invalid/send',
    relayRegion: 'us-east-1',
    testRecipient: '',
    /** every "sent" mail is recorded here so tests can assert side effects */
    outbox: [],
  },
  /** testweb applications owned by a session (for test isolation) */
  sessionApplications: new Map(),
  /** counters */
  sequence: { application: 2000, task: 1001, quotation: 1001, record: 500 },
  analytics: {
    totals: { applications: 2, openTasks: 1, registeredUsers: 5, quotations: 1 },
    byRegion: REGIONS.map((region, index) => ({ region, applications: 4 - index, tasks: (index % 2) + 1 })),
  },
};

/* ------------------------------------------------------------------ *
 * Helpers                                                            *
 * ------------------------------------------------------------------ */

export function findUser(email) {
  if (typeof email !== 'string') return null;
  const normalized = email.trim().toLowerCase();
  for (const [key, profile] of Object.entries(PROFILES)) {
    if (key.toLowerCase() === normalized) {
      const record = demoUsers[Object.keys(demoUsers).find((name) => demoUsers[name].username?.toLowerCase() === normalized)];
      return {
        email: key,
        password: record?.password ?? '12345678',
        name: profile.name,
        role: profile.role,
        initials: profile.initials,
        region: REGION_BY_ROLE[profile.role],
      };
    }
  }
  return null;
}

export function canAccess(role, route) {
  const allowed = ADMIN_PERMISSIONS[role] ?? [];
  if (allowed.includes('*')) return true;
  const clean = String(route || '/').split('?')[0].replace(/\/+$/, '') || '/';
  return allowed.some((entry) => clean === entry || clean.startsWith(`${entry}/`));
}

export function canUndo(role) {
  return UNDO_ROLES.includes(role);
}

/** Roles that may see quoting prices and quotation downloads in the configurator. */
export function canQuote(role) {
  return ['Admin', 'Engineering', 'Internal Sales'].includes(role);
}

export function nextSequence(name, prefix) {
  const value = state.sequence[name] + 1;
  state.sequence[name] = value;
  return `${prefix}${value}`;
}

export function newId(prefix) {
  return nextId(prefix);
}

export function applicationsFor(owner) {
  // Legacy function - kept for backward compatibility with admin portal
  if (!state.customerApplications.has(owner)) state.customerApplications.set(owner, []);
  return state.customerApplications.get(owner);
}

export function applicationsForSession(sessionToken) {
  console.log('[store] applicationsForSession called with:', sessionToken);
  if (!state.sessionApplications.has(sessionToken)) {
    console.log('[store] Creating new sessionApplications for:', sessionToken);
    state.sessionApplications.set(sessionToken, []);
  }
  return state.sessionApplications.get(sessionToken);
}

export function tableFor(datasetKey) {
  return state.datasets[datasetKey] ?? null;
}

export function datasetSummaries() {
  return Object.entries(state.datasets).map(([, table]) => ({
    title: table.title,
    route: table.route,
    group: table.group,
    records: table.records.length,
  }));
}
