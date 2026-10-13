/**
 * Administration portal client for the local QA Demo Portal.
 *
 * Server-rendered shell + plain JS router. Every route the maintained suite
 * covers is rendered here: users, roles, applications, tasks, changelog,
 * analytics, approvals, profile/settings, SMTP and the dataset editors.
 */
(() => {
  const { h, api, clear, num, uiState, modal, confirmDialog } = window.QD;
  const root = document.getElementById('app');
  let snap = null;

  const NAV = [
    { label: 'Dashboard', href: '/dashboard/overview' },
    { label: 'Analytics', href: '/analytics' },
    { label: 'Users', href: '/users' },
    { label: 'Roles', href: '/roles' },
    { label: 'Applications', href: '/applications' },
    { label: 'Tasks', href: '/tasks' },
    { label: 'Changelog', aria: 'Change Log', href: '/change-log' },
    { label: 'Approvals', href: '/approvals' },
    { type: 'group', label: 'Machine', children: [
      { label: 'Machine Options', href: '/datasets/machine-options' },
      { label: 'Machine Options US', href: '/datasets/machine-options-us' },
      { label: 'CAD 3D Settings', href: '/datasets/cad-3d-settings' },
    ] },
    { type: 'group', label: 'Products', children: [
      { label: 'Products', href: '/datasets/products' },
      { label: 'Fasteners', href: '/datasets/fasteners' },
      { label: 'Profil Fasteners', href: '/datasets/profil-fasteners' },
      { label: 'Autoriv Fasteners', href: '/datasets/autoriv-fasteners' },
      { label: 'Sherex Fasteners', href: '/datasets/sherex-fasteners' },
      { label: 'Profil Indie Options', href: '/datasets/profil-indie-options' },
    ] },
    { type: 'group', label: 'Tooling', children: [
      { label: 'Tooling Sets', href: '/datasets/tooling-sets' },
    ] },
    { type: 'group', label: 'Pricing', children: [
      { label: 'Pemserter Price EUR', href: '/datasets/pemserter-eur' },
      { label: 'Pemserter Price USD', href: '/datasets/pemserter-usd' },
    ] },
    { type: 'group', label: 'Calculations', children: [
      { label: 'Cost Models', href: '/datasets/cost-models' },
    ] },
    { type: 'group', label: 'Content', children: [
      { label: 'Landing Content', href: '/datasets/landing-content' },
      { label: 'Responsibility Map', href: '/datasets/responsibility-map' },
      { label: 'Tasks Raw Dataset', href: '/datasets/tasks-raw' },
    ] },
    { label: 'SMTP', href: '/smtp' },
    { label: 'Profile', href: '/profile' },
  ];

  const isPermitted = (href) => {
    if (snap.permissions.includes('*')) return true;
    return snap.permissions.includes(href);
  };

  /* ------------------------------------------------------------------ *
   * Login                                                             *
   * ------------------------------------------------------------------ */

  function renderLogin(forcedMessage) {
    clear(root);
    let mode = 'magic';
    const alertBox = h('div');

    const fail = (text) => {
      clear(alertBox);
      alertBox.appendChild(h('div', { role: 'alert', text }));
    };

    const emailField = h('div', {},
      h('label', { for: 'email', text: 'Email address' }),
      h('input', { id: 'email', name: 'email', type: 'email', autocomplete: 'email', placeholder: 'admin@penn.com' }));

    const passwordWrap = h('div', { class: 'hidden' },
      h('div', {},
        h('label', { for: 'password', text: 'Password' }),
        h('input', { id: 'password', name: 'password', type: 'password', autocomplete: 'current-password' })));

    // The submit control stays visible in both modes so a click with empty
    // fields produces inline validation instead of a no-op.
    const submitWrap = h('div', {},
      h('button', { type: 'submit', text: 'Sign in' }));

    const otpSection = h('div', { class: 'hidden' });

    async function verifyOtp() {
      const digits = [...otpSection.querySelectorAll('input')].map((input) => input.value).join('');
      const res = await api('/auth/otp', { method: 'POST', body: { email: email.value.trim(), otp: digits } });
      if (!res.ok) return fail(res.error ?? 'The code you entered is not valid.');
      window.location.assign(res.redirect ?? '/users');
    }

    const sendCodeButton = h('button', {
      class: 'secondary', type: 'button', text: 'Send code',
      onclick: async () => {
        const address = email.value.trim();
        if (!address) return fail('Your sign-in could not be completed. Enter your email address first.');
        const res = await api('/auth/magic', { method: 'POST', body: { email: address } });
        const digits = h('div', { class: 'otp-row' });
        for (let index = 1; index <= 8; index += 1) {
          digits.appendChild(h('input', {
            type: 'text', inputmode: 'numeric', maxlength: '1', 'aria-label': `one-time code digit ${index}`,
          }));
        }
        clear(otpSection);
        otpSection.classList.remove('hidden');
        otpSection.append(
          h('p', { class: 'page-lede', text: res.message ?? 'We sent an 8-digit code to your inbox.' }),
          h('p', { class: 'text-xs text-muted', text: `Demo OTP for this session: ${res.otp ?? '12345678'}` }),
          digits,
          h('button', { class: 'secondary', type: 'button', text: 'Verify code', onclick: verifyOtp }),
        );
      },
    });

    const toggle = h('button', {
      class: 'toggle', type: 'button', text: 'Sign in with a password instead',
      onclick: () => {
        mode = 'password';
        passwordWrap.classList.remove('hidden');
        submitWrap.classList.remove('hidden');
        otpSection.classList.add('hidden');
        toggle.textContent = 'Sign in with a one-time code instead';
      },
    });

    async function onSubmit(event) {
      event.preventDefault();
      const address = email.value.trim();
      const secret = password.value;
      if (!address || !secret) return fail('Your sign-in could not be completed. Enter your email address and password.');
      const res = await api('/auth/login', { method: 'POST', body: { email: address, password: secret } });
      if (!res.ok) return fail(res.error ?? 'Your sign-in could not be completed.');
      window.location.assign(res.redirect ?? '/users');
    }

    const form = h('form', { novalidate: true, onsubmit: onSubmit },
      emailField, passwordWrap, otpSection, alertBox, submitWrap);
    const { email, password } = form;

    if (forcedMessage) fail(forcedMessage);

    root.appendChild(h('main', { class: 'auth-shell' },
      h('section', { class: 'auth-card' },
        h('h1', { text: 'Sign in' }),
        h('p', { class: 'lede', text: 'QA Demo Portal — administration console. Demo credentials live in test-data/users.json.' }),
        form,
        h('div', { class: 'row mt-2' }, sendCodeButton, toggle),
        h('p', { class: 'text-xs text-muted mt-2', text: 'Try admin@penn.com with password 12345678' }))));
  }

  /* ------------------------------------------------------------------ *
   * Layout                                                            *
   * ------------------------------------------------------------------ */

  function chevron() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'lucide lucide-chevron-down');
    svg.setAttribute('width', '14');
    svg.setAttribute('height', '14');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M6 9l6 6 6-6');
    svg.appendChild(path);
    return svg;
  }

  function sidebar() {
    const list = h('ul');
    for (const item of NAV) {
      if (item.type === 'group') {
        const children = item.children.filter((child) => isPermitted(child.href));
        if (!children.length) continue;
        const button = h('button', {
          class: 'group', type: 'button', 'aria-expanded': 'true',
          onclick: () => button.setAttribute('aria-expanded', 'true'),
        }, chevron(), h('span', { text: item.label }));
        const sub = h('ul', { class: 'children' });
        for (const child of children) {
          sub.appendChild(h('li', {}, h('a', { href: child.href, text: child.label })));
        }
        list.appendChild(h('li', {}, button, sub));
        continue;
      }
      if (!isPermitted(item.href)) continue;
      const link = h('a', { href: item.href, text: item.label });
      if (item.aria) link.setAttribute('aria-label', item.aria);
      if (window.location.pathname === item.href) link.setAttribute('aria-current', 'page');
      list.appendChild(h('li', {}, link));
    }
    return h('nav', { 'aria-label': 'Main navigation' }, list);
  }

  function header() {
    const user = snap.user;
    const menuMount = h('div', { class: 'user-menu' });
    const trigger = h('button', {
      class: 'secondary', type: 'button', 'aria-haspopup': 'true', 'aria-expanded': 'false',
      onclick: (event) => { event.stopPropagation(); toggleMenu(); },
    },
    h('span', { class: 'avatar rounded-full bg-penn-500', text: user.initials }),
    h('span', { text: user.name }),
    h('span', { class: 'sr-only', text: `Open menu for ${user.name}` }));

    let openMenu = null;
    function closeMenu() {
      if (!openMenu) return;
      openMenu.remove();
      openMenu = null;
      trigger.setAttribute('aria-expanded', 'false');
    }
    function toggleMenu() {
      if (openMenu) return closeMenu();
      // The menu item is the only "Sign out" control while the menu is open; the
      // confirmation dialog removes it so the dialog's confirm button stays unique.
      openMenu = h('div', { class: 'menu', role: 'menu' },
        h('p', { class: 'who' }, h('strong', { text: user.name }), h('span', { class: 'text-muted', text: user.role }), h('span', { class: 'text-muted', text: user.email })),
        h('a', { href: '/profile', text: 'Profile' }),
        h('button', {
          class: 'danger', type: 'button', text: 'Sign out',
          onclick: () => { closeMenu(); signOutDialog(); },
        }));
      menuMount.appendChild(openMenu);
      trigger.setAttribute('aria-expanded', 'true');
    }
    document.addEventListener('click', closeMenu);

    function signOutDialog() {
      const dialog = modal({
        labelledBy: 'signout-title',
        children: [
          h('header', {}, h('h2', { id: 'signout-title', text: 'Sign out of the QA Demo Portal?' })),
          h('p', { class: 'page-lede', text: 'You will be returned to the sign-in page.' }),
          h('div', { class: 'row' },
            h('button', { class: 'secondary', type: 'button', text: 'Cancel', onclick: () => dialog.closeModal() }),
            h('button', {
              type: 'button', text: 'Sign out', onclick: async () => {
                dialog.closeModal();
                const res = await api('/auth/logout', { method: 'POST', body: {} });
                window.location.assign(res.redirect ?? '/login');
              },
            })),
        ],
      });
    }

    const nav = h('nav', { 'aria-label': 'Portal' },
      h('a', { href: '/users', class: 'brand', text: 'QA Demo Portal' }),
      h('span', { class: 'chip', text: 'Administration' }));

    menuMount.appendChild(trigger);
    return h('header', { role: 'banner' }, nav, menuMount);
  }

  function layout(contentNodes) {
    clear(root);
    const body = h('div', { class: 'body-grid' }, h('aside', { 'aria-label': 'Navigation' }, sidebar()), h('main', {}, ...contentNodes));
    root.appendChild(h('div', { class: 'app' }, header(), body));
  }

  const pageHeader = (title, lede) => [
    h('h1', { text: title }),
    lede ? h('p', { class: 'page-lede', text: lede }) : null,
  ].filter(Boolean);

  /* ------------------------------------------------------------------ *
   * Generic table + record editor                                     *
   * ------------------------------------------------------------------ */

  const PAGE_SIZE = 10;

  function datasetState(key) {
    const all = uiState.read().datasets ?? {};
    return { search: '', page: 1, ...all[key] };
  }

  function saveDatasetState(key, next) {
    const store = uiState.read();
    store.datasets = { ...(store.datasets ?? {}), [key]: { search: next.search, page: next.page } };
    uiState.write(store);
  }

  function editRecordDialog({ title, columns, record, onSave, addLabel }) {
    const inputs = columns.map((column, index) => h('input', {
      id: `cell-${index}`, value: record ? record.cells[index] : '', 'data-column': column,
    }));
    const dialog = modal({
      labelledBy: 'edit-record-title',
      children: [
        h('header', {}, h('h2', { id: 'edit-record-title', text: title })),
        ...columns.map((column, index) => h('div', {}, h('label', { for: `cell-${index}`, text: column }), inputs[index])),
        h('div', { class: 'row mt-4' },
          h('button', { class: 'secondary', type: 'button', text: 'Cancel', onclick: () => dialog.closeModal() }),
          h('button', {
            type: 'button', text: addLabel ?? 'Save', onclick: async () => {
              const cells = inputs.map((input) => input.value);
              dialog.closeModal();
              await onSave(cells);
            },
          })),
      ],
    });
    return dialog;
  }

  function recordsTable(key) {
    const table = snap.datasetDetails[key];
    const control = { state: datasetState(key) };

    const filtered = () => {
      const needle = control.state.search.trim().toLowerCase();
      if (!needle) return table.records;
      return table.records.filter((record) => record.cells.join(' ').toLowerCase().includes(needle));
    };

    const tbody = h('tbody');
    const thead = h('thead', {}, h('tr', {}, ...table.columns.map((column) => h('th', { scope: 'col', text: column })), h('th', { scope: 'col', text: 'Actions' })));
    const countLine = h('p', { class: 'pager-count text-muted' });
    const searchInput = h('input', {
      type: 'search', placeholder: 'Search records', 'aria-label': 'Search records',
      value: control.state.search,
      oninput: (event) => { control.state.search = event.target.value; saveDatasetState(key, control.state); paint(); },
    });
    const prevButton = h('button', {
      class: 'secondary', type: 'button', text: 'Prev',
      onclick: () => { control.state.page = Math.max(1, control.state.page - 1); saveDatasetState(key, control.state); paint(); },
    });
    const nextButton = h('button', {
      class: 'secondary', type: 'button', text: 'Next',
      onclick: () => { control.state.page = control.state.page + 1; saveDatasetState(key, control.state); paint(); },
    });

    const addLabel = table.addButton ?? 'Add record';
    const addButton = h('button', {
      type: 'button', text: addLabel,
      onclick: () => editRecordDialog({
        title: addLabel,
        columns: table.columns,
        record: null,
        addLabel: 'Save record',
        onSave: async (cells) => {
          const res = await api(`/admin/datasets/${key}/records`, { method: 'POST', body: { cells } });
          if (res.ok) { snap.datasetDetails[key].records = res.records; paint(); }
        },
      }),
    });

    function paint() {
      clear(tbody);
      const rows = filtered();
      const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
      if (control.state.page > pages) control.state.page = pages;
      const start = (control.state.page - 1) * PAGE_SIZE;
      const slice = rows.slice(start, start + PAGE_SIZE);
      if (!slice.length) {
        tbody.appendChild(h('tr', {}, h('td', { colspan: String(table.columns.length + 1), text: 'No records found for this filter.' })));
      }
      for (const record of slice) {
        const tr = h('tr', { 'data-record': record.id },
          ...record.cells.map((cell) => h('td', { text: String(cell) })),
          h('td', {}, h('div', { class: 'row' },
            h('button', { class: 'ghost', type: 'button', text: 'View', onclick: () => viewRecord(key, record) }),
            h('button', { class: 'ghost', type: 'button', text: 'Edit', onclick: () => {
              editRecordDialog({
                title: `Edit: ${record.cells[0]}`,
                columns: table.columns,
                record,
                onSave: async (cells) => {
                  const res = await api(`/admin/datasets/${key}/records`, { method: 'PATCH', body: { id: record.id, cells } });
                  if (res.ok) { snap.datasetDetails[key].records = res.records; paint(); }
                },
              });
            } }),
            h('button', { class: 'danger', type: 'button', text: 'Delete', onclick: () => confirmDialog({
              title: 'Delete record',
              message: `Delete "${record.cells[0]}" from ${table.title}?`,
              confirmLabel: 'Delete',
              tone: 'danger',
              onConfirm: async () => {
                const res = await api(`/admin/datasets/${key}/records`, { method: 'DELETE', body: { id: record.id } });
                if (res.ok) { snap.datasetDetails[key].records = res.records; paint(); }
              },
            }) }),
          )));
        tbody.appendChild(tr);
      }
      clear(countLine);
      countLine.append(h('span', { text: `${rows.length} records` }), h('span', { class: 'text-muted', text: `page ${control.state.page} of ${pages}` }));
      prevButton.disabled = control.state.page <= 1;
      nextButton.disabled = control.state.page >= pages;
    }

    paint();

    return h('section', { class: 'section' },
      h('div', { class: 'toolbar' }, searchInput, addButton),
      h('div', { class: 'table-scroll' }, h('table', {}, h('caption', { text: `${table.title} data` }), thead, tbody)),
      h('div', { class: 'pager' }, prevButton, nextButton, countLine));
  }

  function viewRecord(key, record) {
    const table = snap.datasetDetails[key];
    const dialog = modal({
      labelledBy: 'view-record-title',
      children: [
        h('header', {}, h('h2', { id: 'view-record-title', text: `View: ${record.cells[0]}` })),
        h('dl', {}, ...record.cells.flatMap((cell, index) => [
          h('dt', { text: table.columns[index] }), h('dd', { text: String(cell) }),
        ])),
        h('div', { class: 'row mt-4' }, h('button', { class: 'secondary', type: 'button', text: 'Close', onclick: () => dialog.closeModal() })),
      ],
    });
  }

  /* ------------------------------------------------------------------ *
   * Pages                                                             *
   * ------------------------------------------------------------------ */

  function simpleTable(columns, rows, { actionsFor } = {}) {
    const tbody = h('tbody');
    rows.forEach((cells, index) => {
      const actions = actionsFor ? actionsFor(index, cells) : [];
      tbody.appendChild(h('tr', {}, ...cells.map((cell) => h('td', { text: String(cell ?? '') })), h('td', {}, h('div', { class: 'row' }, ...actions))));
    });
    return h('section', { class: 'section' }, h('div', { class: 'table-scroll' },
      h('table', {}, h('thead', {}, h('tr', {}, ...columns.map((column) => h('th', { scope: 'col', text: column })), h('th', { scope: 'col', text: 'Actions' }))), tbody)));
  }

  const PAGES = {
    '/users': () => [
      ...pageHeader('All Users', 'Every account that can sign in to the QA Demo Portal.'),
      h('div', { class: 'toolbar' }, h('button', { type: 'button', text: 'Add user' })),
      simpleTable(['Name', 'Email', 'Role', 'Region', 'Status'], snap.users.map((user) => user.cells), {
        actionsFor: (index) => [
          h('button', { class: 'ghost', type: 'button', text: 'Edit' }),
          h('button', { class: 'danger', type: 'button', text: 'Delete' }),
        ],
      }),
    ],
    '/roles': () => [
      ...pageHeader('Roles', 'Role definitions and the number of accounts assigned to each role.'),
      h('div', { class: 'toolbar' }, h('button', { type: 'button', text: 'Add Role' })),
      simpleTable(['Role', 'Description', 'Accounts', 'Status'], snap.roles.map((role) => role.cells), {
        actionsFor: () => [h('button', { class: 'ghost', type: 'button', text: 'Edit' })],
      }),
    ],
    '/applications': () => [
      ...pageHeader('Applications', 'Applications registered by configurator users.'),
      simpleTable(['Application', 'OEM', 'Program', 'Annual volume', 'Owner', 'Status'], snap.applications.map((application) => [
        application.name, application.oem, application.program, num(application.volume), application.owner, application.status,
      ]), {
        actionsFor: () => [h('button', { class: 'ghost', type: 'button', text: 'Edit' })],
      }),
    ],
    '/tasks': () => [
      ...pageHeader('Tasks', 'Work items raised by quotation requests and support enquiries.'),
      simpleTable(['Task', 'Type', 'Owner', 'Status', 'Details'], snap.tasks.map((task) => [task.title, task.type, task.owner, task.status, task.detail]), {
        actionsFor: () => [h('button', { class: 'ghost', type: 'button', text: 'Edit' })],
      }),
    ],
    '/change-log': () => [
      ...pageHeader('Changelog', 'Record-level audit trail for dataset changes.'),
      simpleTable(['When', 'Actor', 'Entity', 'Change'], snap.changelog.map((entry) => [entry.at, entry.actor, entry.entity, entry.action]), {
        actionsFor: (index) => (snap.canUndo ? [h('button', { class: 'ghost', type: 'button', text: 'Undo', onclick: async () => {
          await api('/admin/datasets/machine-options/undo', { method: 'POST', body: { id: index } });
          snap.changelog.splice(index, 1);
          render();
        } })] : []),
      }),
    ],
    '/approvals': () => [
      ...pageHeader('Approvals', 'Pending price and content changes that need a second reviewer.'),
      simpleTable(['Request', 'Entity', 'Requested by', 'Status'], [
        ['APR-1', 'Cost Models', 'Michael Johnson', 'Pending'],
        ['APR-2', 'Landing Content', 'David Wilson', 'Approved'],
      ], { actionsFor: () => [h('button', { class: 'ghost', type: 'button', text: 'Review' })] }),
    ],
    '/analytics': () => [
      ...pageHeader('Analytics', 'Adoption metrics across the demo configurator.'),
      h('div', { class: 'grid-3' }, ...Object.entries(snap.analytics.totals).map(([label, value]) => h('div', { class: 'kpi' },
        h('p', { class: 'text-xs font-semibold uppercase', text: label.replace(/([A-Z])/g, ' $1') }),
        h('p', { class: 'text-xl font-bold', text: num(value) })))),
      h('section', { class: 'section mt-4' }, h('h2', { text: 'By region' }),
        simpleTable(['Region', 'Applications', 'Tasks'], snap.analytics.byRegion.map((entry) => [entry.region, entry.applications, entry.tasks]))),
    ],
    '/dashboard/overview': () => [
      ...pageHeader('Dashboard Overview', 'Operational snapshot of the QA Demo Portal.'),
      h('div', { class: 'grid-3' },
        kpi('Applications', snap.applications.length),
        kpi('Open tasks', snap.tasks.filter((task) => task.status === 'Open').length),
        kpi('Registered users', snap.users.length),
        kpi('Datasets', Object.keys(snap.datasetDetails).length)),
      h('section', { class: 'section mt-4' }, h('h2', { text: 'Recent changelog' }),
        simpleTable(['When', 'Actor', 'Entity', 'Change'], snap.changelog.slice(0, 5).map((entry) => [entry.at, entry.actor, entry.entity, entry.action]))),
    ],
    '/dashboard/reports': () => [
      ...pageHeader('Dashboard Reports', 'Downloadable reports for the demo dataset.'),
      h('div', { class: 'row' },
        h('button', { type: 'button', text: 'Download usage report' }),
        h('button', { class: 'secondary', type: 'button', text: 'Download quotation summary' })),
      simpleTable(['Report', 'Period', 'Rows', 'Status'], [
        ['Usage report', '2026 Q1', '1,240', 'Ready'],
        ['Quotation summary', '2026 Q1', '18', 'Ready'],
      ]),
    ],
    '/profile': () => profilePage('Profile'),
    '/settings/profile': () => profilePage('Profile settings'),
    '/settings/general': () => [
      ...pageHeader('General settings', 'Portal-wide defaults for the QA Demo Portal.'),
      h('section', { class: 'section' },
        h('h2', { text: 'General' }),
        fieldRow('Default region', ['North America', 'Europe', 'Asia Pacific']),
        fieldRow('Weekly digest', ['Enabled', 'Disabled'])),
    ],
    '/settings/permissions': () => [
      ...pageHeader('Permission settings', 'Which roles can reach which admin routes.'),
      h('section', { class: 'section' }, simpleTable(['Role', 'Datasets', 'Pricing', 'Tasks'], [
        ['Admin', 'Read / write', 'Yes', 'Yes'],
        ['Engineering', 'Read / write', 'No', 'Yes'],
        ['Internal Sales', 'Pricing only', 'Yes', 'Yes'],
        ['External/Customer', 'None', 'No', 'Own only'],
        ['Distributor/Partner', 'None', 'No', 'Own only'],
      ])),
    ],
    '/settings/security': () => [
      ...pageHeader('Security settings', 'Session lifetime and sign-in protections.'),
      h('section', { class: 'section' },
        h('h2', { text: 'Sessions' }),
        h('p', { class: 'text-muted', text: 'Demo sessions are cookie based and expire after 8 hours. Failed sign-ins never reveal whether an account exists.' }),
        h('div', { class: 'row' }, h('button', { type: 'button', text: 'Save security settings' }))),
    ],
    '/smtp': () => smtpPage(),
  };

  function kpi(label, value) {
    return h('div', { class: 'kpi' }, h('p', { class: 'text-xs font-semibold uppercase', text: label }), h('p', { class: 'text-xl font-bold', text: num(value) }));
  }

  function fieldRow(label, options) {
    return h('div', {}, h('label', { text: label }),
      h('select', { 'aria-label': label }, ...options.map((option) => h('option', { text: option }))));
  }

  function profilePage(title) {
    const profile = snap.profile ?? { name: snap.user.name, email: snap.user.email, role: snap.user.role, region: snap.user.region };
    return [
      ...pageHeader(title, 'Your demo account details.'),
      h('section', { class: 'section' },
        h('div', { class: 'grid-2' },
          h('div', {}, h('label', { for: 'profile-name', text: 'Name' }), h('input', { id: 'profile-name', type: 'text', value: profile.name })),
          h('div', {}, h('label', { for: 'profile-email', text: 'Email address' }), h('input', { id: 'profile-email', type: 'email', value: profile.email, autocomplete: 'email' })),
          h('div', {}, h('label', { for: 'profile-role', text: 'Role' }), h('input', { id: 'profile-role', type: 'text', value: profile.role })),
          h('div', {}, h('label', { for: 'profile-region', text: 'Region' }), h('input', { id: 'profile-region', type: 'text', value: profile.region }))),
        h('div', { class: 'row mt-4' }, h('button', { type: 'button', text: 'Save profile' }))),
    ];
  }

  function smtpPage() {
    const smtp = snap.smtp;
    const alertBox = h('div');
    const input = (label, key, type = 'text') => h('div', {},
      h('label', { for: `smtp-${key}`, text: label }),
      h('input', { id: `smtp-${key}`, type, value: smtp[key], 'data-key': key }));

    const enabled = h('div', { class: 'row items-center' },
      h('input', { id: 'smtp-enabled', type: 'checkbox', checked: smtp.enabled, style: 'width:auto;margin:0' }),
      h('label', { for: 'smtp-enabled', text: 'SMTP enabled' }));

    const collect = () => Object.fromEntries([...root.querySelectorAll('[data-key]')].map((node) => [node.dataset.key, node.value]));

    const status = h('p', { class: 'text-ok', hidden: true });

    return [
      ...pageHeader('SMTP', 'Configure task notification emails for quotation and support requests.'),
      alertBox,
      h('section', { class: 'section' },
        h('div', { class: 'grid-2' },
          input('From Email', 'fromEmail'),
          input('From Name', 'fromName'),
          input('Relay URL', 'relayUrl'),
          input('Relay Region', 'relayRegion'),
          input('Test Recipient', 'testRecipient')),
        enabled,
        h('div', { class: 'row mt-4' },
          h('button', { class: 'secondary', type: 'button', text: 'Reload', onclick: async () => {
            const res = await api('/bootstrap');
            snap = res;
            render();
          } }),
          h('button', { class: 'secondary', type: 'button', text: 'Send Test', onclick: async () => {
            const res = await api('/admin/smtp/test', { method: 'POST', body: { recipient: smtp.testRecipient } });
            clear(alertBox);
            status.hidden = false;
            status.textContent = res.message ?? 'Test email queued locally.';
          } }),
          h('button', { type: 'button', text: 'Save', onclick: async () => {
            const body = { ...collect(), enabled: root.querySelector('#smtp-enabled').checked };
            const res = await api('/admin/smtp', { method: 'PUT', body });
            if (!res.ok) { clear(alertBox); alertBox.appendChild(h('div', { role: 'alert', text: res.error ?? 'Could not save SMTP settings.' })); return; }
            snap.smtp = res.smtp;
            clear(alertBox);
            status.hidden = false;
            status.textContent = 'SMTP settings saved.';
          } })),
        status),
    ];
  }

  /* ------------------------------------------------------------------ *
   * Router                                                            *
   * ------------------------------------------------------------------ */

  function datasetKeyFor(pathname) {
    const match = /^\/datasets\/([\w-]+)$/.exec(pathname);
    return match ? match[1] : null;
  }

  function render() {
    const pathname = window.location.pathname;
    if (pathname === '/login' || !snap.user) {
      renderLogin();
      return;
    }
    const key = datasetKeyFor(pathname);
    if (key && snap.datasetDetails[key]) {
      const table = snap.datasetDetails[key];
      layout([
        ...pageHeader(table.heading ?? table.title, table.description),
        recordsTable(key),
      ]);
      return;
    }
    if (key && !snap.datasetDetails[key]) {
      layout([h('h1', { text: 'Page Not Found' }), h('p', { text: 'That dataset does not exist in the demo app.' })]);
      return;
    }
    const builder = PAGES[pathname];
    if (!builder) {
      layout([h('h1', { text: 'Page Not Found' }), h('p', { text: `No demo page is mapped to ${pathname}.` })]);
      return;
    }
    layout(builder());
  }

  async function start() {
    snap = await api('/bootstrap');
    if (window.location.pathname !== '/login' && !snap.user) {
      window.location.replace('/login');
      return;
    }
    if (window.location.pathname === '/login' && snap.user) {
      window.location.replace(isPermitted('/users') ? '/users' : '/profile');
      return;
    }
    render();
  }

  document.addEventListener('click', (event) => {
    const link = event.target.closest?.('a[href^="/"]');
    if (!link || event.metaKey || event.ctrlKey) return;
    event.preventDefault();
    const href = link.getAttribute('href');
    if (href === window.location.pathname) return;
    window.history.pushState({}, '', href);
    render();
  });
  window.addEventListener('popstate', render);

  start();
})();
