/**
 * Configurator portal client for the local QA Demo Portal.
 *
 * Routes: /login /register /forget-password /verify-email / and
 * /installation-system (filter functions, solution comparison, machine
 * configuration panel, application CRUD, quotation requests).
 */
(() => {
  const { h, api, clear, money, num, selectControl, modal, confirmDialog } = window.QD;
  const root = document.getElementById('app');
  let snap = null;

  const defaults = () => ({
    region: snap?.user?.region ?? 'North America',
    maxThread: 'M6',
    elementTypes: [],
    processMonitoring: false,
    robotIntegration: false,
    forceMin: '',
    forceMax: '',
    solutions: [],
    compared: false,
    panelSolution: null,
    selectedOptions: [],
    selectedAppId: null,
    appSearch: '',
    autoFeedState: {},
    assumptions: { labourCostPerHour: 68, energyCostPerKwh: 0.24, toolingLifeCycles: 250000 },
  });

  let ui = { ...defaults(), ...uiStateRead() };

  function uiStateRead() {
    const stored = window.QD.uiState.read();
    return stored.testweb ?? {};
  }
  function persist() {
    const stored = window.QD.uiState.read();
    window.QD.uiState.write({ ...stored, testweb: ui });
  }

  /* ------------------------------------------------------------------ *
   * Shared chrome                                                       *
   * ------------------------------------------------------------------ */

  const brandBar = () => h('nav', { 'aria-label': 'Brands', class: 'brandbar' },
    ...snap.brands.map((brand) => h('a', { href: brand.href, text: brand.label })));

  function userMenu() {
    const user = snap.user;
    const mount = h('div', { class: 'user-menu' });
    const trigger = h('button', {
      class: 'secondary', type: 'button', 'aria-haspopup': 'true', 'aria-expanded': 'false',
      onclick: (event) => { event.stopPropagation(); toggle(); },
    },
    h('span', { class: 'avatar rounded-full bg-penn-500', text: user.initials }),
    h('span', { text: user.name }),
    h('span', { class: 'text-xs text-muted', text: user.role }));

    let openNode = null;
    const close = () => { if (openNode) { openNode.remove(); openNode = null; trigger.setAttribute('aria-expanded', 'false'); } };
    function toggle() {
      if (openNode) return close();
      openNode = h('div', { class: 'menu', role: 'menu' },
        h('p', { class: 'who' }, h('strong', { text: user.name }), h('span', { class: 'text-muted', text: user.role })),
        h('a', { href: '/installation-system', text: 'Installation system' }),
        h('button', {
          class: 'danger', type: 'button', text: 'Sign out', onclick: async () => {
            close();
            const res = await api('/auth/logout', { method: 'POST', body: {} });
            window.location.assign(res.redirect ?? '/login');
          },
        }));
      mount.appendChild(openNode);
      trigger.setAttribute('aria-expanded', 'true');
    }
    document.addEventListener('click', close);
    mount.appendChild(trigger);
    return mount;
  }

  const header = () => h('header', { role: 'banner' },
    h('div', { class: 'row items-center' }, h('span', { class: 'brand', text: 'QA Demo Portal' }), brandBar()),
    snap.user ? userMenu() : h('div', { class: 'row' }));

  const shell = (...nodes) => {
    clear(root);
    root.appendChild(h('div', { class: 'app' }, header(), h('main', {}, ...nodes)));
  };

  /* ------------------------------------------------------------------ *
   * Auth screens                                                        *
   * ------------------------------------------------------------------ */

  function renderLogin() {
    clear(root);
    let mode = 'magic';
    const alertBox = h('div');
    const fail = (text) => { clear(alertBox); alertBox.appendChild(h('div', { role: 'alert', text })); };

    const emailField = h('div', {},
      h('label', { for: 'email', text: 'Email address' }),
      h('input', { id: 'email', name: 'email', type: 'email', autocomplete: 'email', placeholder: 'engineering@penn.com' }));
    const passwordWrap = h('div', { class: 'hidden' },
      h('div', {}, h('label', { for: 'password', text: 'Password' }),
        h('input', { id: 'password', name: 'password', type: 'password', autocomplete: 'current-password' })));
    // Visible in both modes: clicking with empty fields shows inline validation.
    const submitWrap = h('div', {}, h('button', { type: 'submit', text: 'Sign in' }));
    const otpSection = h('div', { class: 'hidden' });

    async function verifyOtp() {
      const digits = [...otpSection.querySelectorAll('input')].map((input) => input.value).join('');
      const res = await api('/auth/otp', { method: 'POST', body: { email: email.value.trim(), otp: digits } });
      if (!res.ok) return fail(res.error ?? 'The code you entered is not valid.');
      window.location.assign('/');
    }

    const sendCodeButton = h('button', {
      class: 'secondary', type: 'button', text: 'Send code',
      onclick: async () => {
        const address = email.value.trim();
        if (!address) return fail('Your sign-in could not be completed. Enter your email address first.');
        const res = await api('/auth/magic', { method: 'POST', body: { email: address } });
        const digits = h('div', { class: 'otp-row' });
        for (let index = 1; index <= 8; index += 1) {
          digits.appendChild(h('input', { type: 'text', inputmode: 'numeric', maxlength: '1', 'aria-label': `one-time code digit ${index}` }));
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
      window.location.assign('/');
    }

    const form = h('form', { novalidate: true, onsubmit: onSubmit }, emailField, passwordWrap, otpSection, alertBox, submitWrap);
    const { email, password } = form;

    const hero = h('section', { class: 'card' },
      h('h2', { text: 'Find your installation system' }),
      h('p', { class: 'text-muted', text: 'Compare PEM® self-clinching fastening systems against your application parameters.' }),
      h('button', { type: 'button', text: 'Find your installation system', onclick: () => { window.location.assign('/installation-system'); } }));

    const authCard = h('section', { class: 'auth-card mt-4' },
      h('h1', { text: 'Sign in' }),
      h('p', { class: 'lede', text: 'Sign in to the QA Demo Portal configurator. Demo accounts are listed in test-data/users.json.' }),
      form,
      h('div', { class: 'row mt-2' }, sendCodeButton, toggle),
      h('div', { class: 'row mt-2' },
        h('button', { type: 'button', class: 'secondary', text: 'Register', onclick: () => window.location.assign('/register') }),
        h('a', { href: '/forget-password', text: 'Forgot password?' })),
      h('p', { class: 'text-xs text-muted mt-2', text: 'Try engineering@penn.com with password 12345678' }));

    // Rendered inside the shared shell so the brand links stay in the
    // navigation on the unauthenticated landing surface as well.
    shell(hero, authCard);
    document.body.classList.add('guest');
  }

  function renderRegister() {
    const errors = h('div');
    const input = (id, label, type = 'text', attrs = {}) => h('div', {},
      h('label', { for: id, text: label }),
      h('input', { id, name: id, type, ...attrs }));

    const department = selectControl({
      id: 'departmentId', label: 'Function department', options: snap.catalog.departments,
      placeholder: 'Select department',
    });
    const region = selectControl({
      id: 'regionCode', label: 'Region', options: snap.catalog.regions, placeholder: 'Select region',
    });

    const errorLine = h('p', { class: 'text-error', hidden: true });

    const form = h('form', { novalidate: true, class: 'card' },
      h('h1', { text: 'Create an account' }),
      h('p', { class: 'lede text-muted', text: 'Register a demo configurator account.' }),
      errors, errorLine,
      h('div', { class: 'grid-2' },
        input('firstName', 'First name', 'text', { autocomplete: 'given-name' }),
        input('lastName', 'Last name', 'text', { autocomplete: 'family-name' }),
        input('email', 'Email address', 'email', { autocomplete: 'email' }),
        input('password', 'Password', 'password', { autocomplete: 'new-password' }),
        input('confirmPassword', 'Confirm password', 'password', { autocomplete: 'new-password' }),
        input('company', 'Company', 'text', { autocomplete: 'organization' }),
        input('telephone', 'Telephone', 'tel', { autocomplete: 'tel' }),
        input('companyAddress', 'Company address', 'text')),
      h('div', { class: 'grid-2' },
        h('div', {}, h('label', { text: 'Function department' }), h('div', { class: 'field-inner' }, department)),
        h('div', {}, h('label', { text: 'Region' }), h('div', { class: 'field-inner' }, region))),
      h('div', { class: 'row mt-4' },
        h('button', { type: 'submit', text: 'Create account' }),
        h('a', { href: '/login', text: 'Sign in instead' })));

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const payload = Object.fromEntries([...form.querySelectorAll('input')].map((node) => [node.name, node.value]));
      payload.regionCode = region.getValue();
      payload.departmentId = department.getValue();
      const res = await api('/auth/register', { method: 'POST', body: payload });
      clear(errors);
      if (!res.ok) {
        errorLine.hidden = false;
        errorLine.textContent = res.errors?.[0] ?? 'The registration could not be completed.';
        errorLine.classList.remove('hidden');
        return;
      }
      errorLine.hidden = true;
      errorLine.classList.add('hidden');
      window.location.assign(res.redirect ?? '/verify-email');
    });

    shell(h('section', { class: 'auth-shell' }, form));
  }

  function renderVerifyEmail() {
    shell(h('section', { class: 'auth-card' },
      h('h1', { text: 'Verify your email' }),
      h('p', { class: 'lede', text: 'We sent a verification link to your address. In this demo app nothing leaves your machine.' }),
      h('a', { href: '/login', text: 'Back to sign in' })));
  }

  function renderForgotPassword() {
    const otpWrap = h('div', { class: 'hidden' });
    const message = h('p', { class: 'text-ok', hidden: true });
    const alertBox = h('div');
    const email = h('input', { id: 'email', type: 'email', autocomplete: 'email' });

    const form = h('form', { class: 'auth-card', novalidate: true, onsubmit: async (event) => {
      event.preventDefault();
      const res = await api('/auth/forgot', { method: 'POST', body: { email: email.value.trim() } });
      clear(alertBox);
      if (!res.ok) { alertBox.appendChild(h('div', { role: 'alert', text: res.error ?? 'Unable to send an OTP.' })); return; }
      message.hidden = false;
      message.textContent = res.message ?? 'OTP sent.';
      clear(otpWrap);
      otpWrap.classList.remove('hidden');
      otpWrap.append(h('label', { for: 'otp', text: 'One-time password' }),
        h('input', { id: 'otp', type: 'text', inputmode: 'numeric', value: '12345678' }),
        h('button', { class: 'secondary', type: 'button', text: 'Verify OTP' }));
    } },
    h('h1', { text: 'Forgot password' }),
    h('p', { class: 'lede', text: 'Enter your registered email address and we will send a one-time password.' }),
    h('label', { for: 'email', text: 'Email address' }), email,
    alertBox, message, otpWrap,
    h('div', { class: 'row mt-2' }, h('button', { type: 'submit', text: 'Send OTP' })),
    h('p', { class: 'mt-2' }, h('a', { href: '/login', text: 'Return to sign in' })));

    shell(form);
  }

  function renderHome() {
    shell(h('section', { class: 'card' },
      h('h1', { text: 'QA Demo Portal configurator' }),
      h('p', { class: 'text-muted', text: `Signed in as ${snap.user.name} (${snap.user.role}).` }),
      h('button', { type: 'button', text: 'Find your installation system', onclick: () => window.location.assign('/installation-system') }),
      h('p', { class: 'mt-4 text-muted', text: 'Your demo session is stored in a cookie on this machine only.' })));
  }

  /* ------------------------------------------------------------------ *
   * Installation system                                                 *
   * ------------------------------------------------------------------ */

  const hasCapability = (solution, capability) => solution.features.some((feature) => feature.toLowerCase().includes(capability));

  const matchingSolutions = () => snap.catalog.solutions.filter((solution) => {
    if (ui.elementTypes.length && !solution.elements.some((element) => ui.elementTypes.includes(element))) return false;
    if (ui.maxThread && !equalThread(solution.thread, ui.maxThread) && ui.elementTypes.length) return false;
    // Capability requirements narrow the list to machines that ship the feature.
    if (ui.processMonitoring && !hasCapability(solution, 'process monitoring')) return false;
    if (ui.robotIntegration && !hasCapability(solution, 'robot interface') && !hasCapability(solution, 'robot integration')) return false;
    const min = Number(ui.forceMin || 0);
    const max = Number(ui.forceMax || solution.force[1]);
    if (Number.isNaN(min) || Number.isNaN(max)) return true;
    return solution.force[0] <= max && solution.force[1] >= min;
  });

  const equalThread = (a, b) => a === b;

  // The legend chip must never render the bare word "any", otherwise the
  // standalone "Any" force indicator below would not be uniquely addressable.
  const forceLabel = () => (ui.forceMin || ui.forceMax) ? `${ui.forceMin || 0} - ${ui.forceMax || 'unbounded'} kN` : 'Any kN';
  const forceValueLabel = () => (ui.forceMin || ui.forceMax) ? `${ui.forceMin || 0} - ${ui.forceMax || 'unbounded'} kN` : 'Any';

  function filterSection() {
    const regionControl = selectControl({
      id: 'region-react', label: 'Region', options: snap.catalog.regions, value: ui.region,
      onChange: (value) => { ui.region = value; persist(); paintResults(); },
    });
    const threadControl = selectControl({
      id: 'thread-react', label: 'Max thread', options: snap.catalog.maxThreads, value: ui.maxThread,
      onChange: (value) => { ui.maxThread = value; persist(); paintResults(); },
    });

    const elementButtons = h('div', { class: 'row' }, ...snap.catalog.elementTypes.map((element) => {
      const active = ui.elementTypes.includes(element);
      return h('button', {
        type: 'button', class: active ? 'chip-on' : 'secondary', text: element,
        'aria-pressed': active ? 'true' : 'false',
        onclick: () => {
          ui.elementTypes = active ? ui.elementTypes.filter((entry) => entry !== element) : [...ui.elementTypes, element];
          persist();
          renderFilters();
        },
      });
    }));

    const processMonitoring = h('div', { class: 'row items-center' },
      h('input', { id: 'process-monitoring', type: 'checkbox', checked: ui.processMonitoring, onchange: (event) => { ui.processMonitoring = event.target.checked; persist(); paintResults(); } }),
      h('label', { for: 'process-monitoring', text: 'Process monitoring required' }));
    const robotIntegration = h('div', { class: 'row items-center' },
      h('input', { id: 'robot-integration', type: 'checkbox', checked: ui.robotIntegration, onchange: (event) => { ui.robotIntegration = event.target.checked; persist(); paintResults(); } }),
      h('label', { for: 'robot-integration', text: 'Robot integration required' }));

    const forceMin = h('input', { id: 'force-min', type: 'number', 'aria-label': 'Minimum (kN)', value: ui.forceMin, placeholder: '0', oninput: (event) => { ui.forceMin = event.target.value; persist(); paintResults(); } });
    const forceMax = h('input', { id: 'force-max', type: 'number', 'aria-label': 'Maximum (kN)', value: ui.forceMax, placeholder: '120', oninput: (event) => { ui.forceMax = event.target.value; persist(); paintResults(); } });
    const forceRangeMin = h('input', { id: 'force-range-min', type: 'range', min: '0', max: '120', 'aria-label': 'Minimum installation force', value: ui.forceMin || '0', oninput: (event) => { ui.forceMin = String(event.target.value); forceMin.value = event.target.value; persist(); paintResults(); } });
    const forceRangeMax = h('input', { id: 'force-range-max', type: 'range', min: '0', max: '120', 'aria-label': 'Maximum installation force', value: ui.forceMax || '120', oninput: (event) => { ui.forceMax = String(event.target.value); forceMax.value = event.target.value; persist(); paintResults(); } });

    const forceReset = h('button', {
      class: 'secondary', type: 'button', text: 'Reset',
      onclick: () => { ui.forceMin = ''; ui.forceMax = ''; forceMin.value = ''; forceMax.value = ''; forceRangeMin.value = '0'; forceRangeMax.value = '120'; persist(); paintResults(); },
    });

    const resetFilters = h('button', {
      class: 'ghost', type: 'button', text: 'Reset filters',
      onclick: () => { ui = { ...defaults(), panelSolution: ui.panelSolution, selectedOptions: ui.selectedOptions, selectedAppId: ui.selectedAppId }; persist(); renderInstallationSystem(); },
    });

    return h('section', { class: 'section', id: 'filters' },
      h('h2', { text: 'Filter functions' }),
      h('div', { class: 'grid-3' },
        h('div', {}, h('label', { text: 'Region' }), regionControl),
        h('div', {}, h('label', { text: 'Max thread' }), threadControl),
        h('div', {}, h('label', { text: 'Element types' }), elementButtons)),
      processMonitoring, robotIntegration,
      h('div', { class: 'grid-2' },
        h('div', {}, h('label', { for: 'force-min', text: 'Minimum (kN)' }), forceMin),
        h('div', {}, h('label', { for: 'force-max', text: 'Maximum (kN)' }), forceMax)),
      h('div', { class: 'grid-2' },
        h('div', {}, h('label', { for: 'force-range-min', text: 'Installation force range' }), forceRangeMin),
        h('div', {}, forceRangeMax)),
      h('div', { class: 'row mt-2' }, forceReset, resetFilters,
        h('span', { class: 'force-value', id: 'force-any', text: forceValueLabel() })),
      h('div', { class: 'matching-summary', id: 'matching-summary' },
        h('span', { class: 'text-penn-900', text: String(matchingSolutions().length) }),
        h('span', { text: 'matching product(s)' })));
  }

  function solutionsSection() {
    const list = h('ul', { class: 'stack', style: 'list-style:none;padding:0;margin:0' });
    for (const solution of matchingSolutions()) {
      const checked = ui.solutions.includes(solution.id);
      list.appendChild(h('li', {},
        h('label', { class: `option-card${checked ? ' selected' : ''}` },
          h('input', {
            type: 'checkbox', id: solution.id, checked,
            // The accessible name stays exactly the solution name so tests can
            // target a single checkbox regardless of the surrounding card text.
            'aria-label': solution.name,
            onchange: (event) => {
              ui.solutions = event.target.checked ? [...ui.solutions, solution.id] : ui.solutions.filter((entry) => entry !== solution.id);
              persist();
              renderInstallationSystem();
            },
          }),
          h('span', { text: solution.name }),
          h('span', { class: 'pill', text: solution.category }),
          h('span', { class: 'text-xs text-muted', text: `${solution.force[0]} - ${solution.force[1]} kN` }))));
    }
    return h('section', { class: 'section' },
      h('h2', { text: 'Select solutions you want to compare' }),
      list,
      h('div', { class: 'row mt-4' },
        h('button', { type: 'button', text: 'Compare & Configure Solutions', id: 'compare-configure', onclick: () => { ui.compared = true; persist(); renderInstallationSystem(); } })));
  }

  function comparisonSection() {
    const chosen = snap.catalog.solutions.filter((solution) => ui.solutions.includes(solution.id));
    console.log('[comparisonSection] ui.solutions:', ui.solutions, 'chosen:', chosen.map(s => s.id));
    if (!chosen.length) {
      return h('section', { class: 'section' },
        h('h2', { text: 'Comparison list' }),
        h('p', { class: 'text-muted', text: 'No solutions selected yet. Pick at least one solution above.' }));
    }
    const cards = h('div', { class: 'grid-2' });
    for (const solution of chosen) {
      const isMSPe = solution.id === 'solution-824MSPe' || solution.name.includes('MSPe');
      let autoFeedState = ui.autoFeedState?.[solution.id] ?? true; // default On for MSPe
      console.log('[comparisonSection] solution:', solution.id, solution.name, 'isMSPe:', isMSPe, 'autoFeedState:', autoFeedState);
      cards.appendChild(h('div', { class: 'solution-card' },
        h('h3', { text: solution.name }),
        h('p', { class: 'text-xs text-muted', text: `${solution.brand} · ${solution.category} · ${solution.thread}` }),
        h('p', { text: money(solution.price) }),
        h('ul', { class: 'muted-list' }, ...solution.features.map((feature) => h('li', { text: feature }))),
        isMSPe ? h('button', {
          type: 'button',
          'aria-pressed': autoFeedState ? 'true' : 'false',
          'aria-label': `Auto-Feed ${autoFeedState ? 'On' : 'Off'}`,
          class: `auto-feed-toggle ${autoFeedState ? 'on' : 'off'}`,
          text: `Auto-Feed ${autoFeedState ? 'On' : 'Off'}`,
          onclick: () => {
            autoFeedState = !autoFeedState;
            if (!ui.autoFeedState) ui.autoFeedState = {};
            ui.autoFeedState[solution.id] = autoFeedState;
            persist();
            renderInstallationSystem();
          },
        }) : null,
        h('button', {
          type: 'button', text: 'Configure Solution',
          onclick: () => { ui.panelSolution = solution.id; persist(); renderInstallationSystem(); },
        })));
    }
    return h('section', { class: 'section' }, h('h2', { text: 'Comparison list' }), cards);
  }

  function applicationParamsSection() {
    const list = snap.applications ?? [];
    const selected = list.find((application) => application.id === ui.selectedAppId) ?? null;
    return h('section', { class: 'section' },
      h('h2', { text: 'Enter your application parameters' }),
      h('div', { class: 'grid-2' },
        h('div', { class: 'card' },
          h('h3', { text: 'Option A' }),
          h('p', { class: 'text-muted text-sm', text: 'Describe a new application or reuse one you saved before.' }),
          h('div', { class: 'row' },
            h('button', { type: 'button', text: 'Setup New Application', onclick: () => applicationDialog(null) }),
            h('button', { class: 'secondary', type: 'button', text: 'Use Existing application', onclick: () => useExistingDialog() }))),
        h('div', { class: 'card' },
          h('h3', { text: 'Option B' }),
          selected
            ? h('p', { class: 'font-semibold', text: `Selected: ${selected.name}` })
            : h('p', { class: 'text-muted', text: 'No application selected' }),
          h('div', { class: 'row' },
            h('button', { class: 'secondary', type: 'button', text: 'Clear selection', onclick: () => { ui.selectedAppId = null; persist(); renderInstallationSystem(); } }),
            h('button', { class: 'secondary', type: 'button', text: 'Customize assumptions', onclick: () => assumptionsDialog() })))));
  }

  const applications = () => snap.applications ?? [];

  function kpiSection() {
    const list = snap.applications ?? [];
    const selected = list.find((application) => application.id === ui.selectedAppId);
    const totalVolume = selected ? selected.volume : list.reduce((sum, entry) => sum + entry.volume, 0);
    const fasteners = selected?.fasteners ?? [];
    const perPart = fasteners.reduce((sum, entry) => sum + Number(entry.qtyPerPartA || 0) + Number(entry.qtyPerPartB || 0), 0) || 4;
    const partsPerYear = perPart ? Math.round(totalVolume / perPart) : totalVolume;
    const totalFasteners = partsPerYear * perPart;
    const elementTypes = new Set(fasteners.map((entry) => entry.brand || 'PEM')).size || 2;

    const card = (label, value) => h('div', { class: 'kpi' }, h('p', { text: label }), h('p', { text: value }));
    return h('section', { class: 'section' },
      h('div', { class: 'grid-3' },
        card('Total annual volume', num(totalVolume)),
        card('Total fasteners / year', num(totalFasteners)),
        card('Fasteners / part', num(perPart)),
        card('Element types / part', num(elementTypes)),
        card('Parts / year', num(partsPerYear))));
  }

  function applicationsSection() {
    const list = snap.applications ?? [];
    const wrapper = h('section', { class: 'section' },
      h('h2', { text: `Applications (${list.length})` }));
    if (!list.length) {
      wrapper.appendChild(h('p', { class: 'text-muted', text: 'No applications yet — set up a new application to get started.' }));
    }
    for (const application of list) {
      const selected = application.id === ui.selectedAppId;
      wrapper.appendChild(h('div', { class: `app-card${selected ? ' selected' : ''}` },
        h('h3', { text: application.name }),
        h('p', { class: 'text-xs text-muted', text: `App No. ${application.appNumber || application.id.replace('APP-', '')}` }),
        h('dl', {},
          h('dt', { text: 'OEM' }), h('dd', { text: application.oem || '—' }),
          h('dt', { text: 'Program' }), h('dd', { text: application.program || '—' }),
          h('dt', { text: 'Annual volume' }), h('dd', { text: num(application.volume) }),
          h('dt', { text: 'Batch size' }), h('dd', { text: num(application.batch) }),
          h('dt', { text: 'Material' }), h('dd', { text: application.material || '—' }),
          h('dt', { text: 'Fasteners' }), h('dd', { text: application.fasteners?.length ? application.fasteners.map((entry) => `${entry.brand ?? ''} ${entry.type ?? ''} × ${entry.qtyPerPartA ?? 0}/${entry.qtyPerPartB ?? 0}`).join(', ') : 'None' })),
        h('div', { class: 'row mt-2' },
          h('button', { class: 'secondary', type: 'button', text: 'Edit', onclick: () => applicationDialog(application) }),
          h('button', { class: 'danger', type: 'button', text: 'Remove', onclick: () => confirmDialog({
            title: 'Remove application',
            message: `Remove "${application.name}" from this session?`,
            confirmLabel: 'Remove',
            tone: 'danger',
            onConfirm: async () => {
              const res = await api('/configurator/applications/delete', { method: 'POST', body: { id: application.id } });
              if (res.ok) { snap.applications = res.applications; if (ui.selectedAppId === application.id) ui.selectedAppId = null; persist(); renderInstallationSystem(); }
            },
          }) }),
          h('button', { class: 'ghost', type: 'button', text: 'Use for parameters', onclick: () => { ui.selectedAppId = application.id; persist(); renderInstallationSystem(); } }))));
    }

    wrapper.appendChild(h('div', { class: 'row mt-4' },
      h('button', { type: 'button', text: 'Add new application', onclick: () => applicationDialog(null) }),
      h('button', { class: 'secondary', type: 'button', text: 'Add existing application', onclick: () => useExistingDialog() }),
      list.length ? h('button', { class: 'ghost', type: 'button', text: 'Reset application', onclick: () => { ui.selectedAppId = null; persist(); renderInstallationSystem(); } }) : null));

  return wrapper;
  }

  function actionFooter() {
    const canQuote = snap.canQuote;
    return h('section', { class: 'section' },
      h('div', { class: 'row' },
        h('button', { class: 'secondary', type: 'button', text: 'Request support', onclick: async () => {
          const list = snap.applications ?? [];
          const res = await api('/configurator/rfq', { method: 'POST', body: { solution: activeSolution()?.name, application: list.find((entry) => entry.id === ui.selectedAppId)?.name, email: snap.user.email } });
          window.QD.toast(statusLineTarget(), res.message ?? 'Your request has been submitted.');
        } }),
        canQuote ? h('button', { class: 'secondary', type: 'button', text: 'Download cost analysis' }) : null,
        canQuote ? h('button', { class: 'secondary', type: 'button', text: 'Generate ROI report' }) : null),
      h('p', { class: 'notice', hidden: true }));
  }

  const statusLineTarget = () => root.querySelector('.notice');

  function activeSolution() {
    return snap.catalog.solutions.find((solution) => solution.id === ui.panelSolution) ?? null;
  }

  /* ---------------- configuration panel ---------------- */

  function panelFilters() {
    const select = (labelText, options, onChange) => {
      const id = `panel-${labelText.replace(/\W+/g, '-').toLowerCase()}`;
      const element = h('select', { id, 'aria-label': labelText, onchange: (event) => onChange(event.target.value) },
        ...options.map((option) => h('option', { text: option, value: option })));
      return { label: h('label', { for: id, text: labelText }), element, id };
    };
    return { select };
  }

  function configPanel() {
    const solution = activeSolution();
    if (!solution) return null;
    const filters = panelFilters();
    const state = { group: 'All groups', tracks: 'Single track', force: 'Any' };

    const groupSelect = filters.select('Fastener group', snap.catalog.fastenerGroups, (value) => { state.group = value; paint(); });
    const tracksSelect = filters.select('Feeder tracks', snap.catalog.feederTracks, (value) => { state.tracks = value; paint(); });
    const forceSelect = filters.select('Force', snap.catalog.forceRanges, (value) => { state.force = value; paint(); });

    const allOptions = [...snap.catalog.machineOptions, ...snap.catalog.accessories];
    const visibleOptions = () => allOptions.filter((option) => {
      if (state.group !== 'All groups' && option.group !== 'All groups' && option.group !== state.group) return false;
      if (state.tracks !== 'Single track' && option.tracks !== state.tracks) return false;
      if (state.force !== 'Any' && option.force !== state.force) return false;
      return true;
    });

    const machineMount = h('div');
    const optionsMount = h('div');
    const summaryMount = h('div');
    const totalLine = h('div', { class: 'row items-center justify-between' },
      h('span', { class: 'font-semibold', text: 'Selected options total' }),
      h('span', { class: 'total-value', text: money(0) }));

    function optionCard(option) {
      const input = h('input', {
        type: 'checkbox',
        checked: ui.selectedOptions.includes(option.code),
        onchange: (event) => {
          ui.selectedOptions = event.target.checked
            ? [...new Set([...ui.selectedOptions, option.code])]
            : ui.selectedOptions.filter((code) => code !== option.code);
          persist();
          paint();
        },
      });
      return h('label', { class: `option-card${ui.selectedOptions.includes(option.code) ? ' selected' : ''}` },
        input,
        h('div', { text: `Product: ${option.code}` }),
        h('div', { class: 'text-sm font-semibold', text: option.name }),
        h('div', { class: 'text-xs text-muted', text: `${option.group} · ${option.tracks} · ${option.force}` }),
        h('div', { class: 'text-xs', text: money(option.price) }));
    }

    function paint() {
      clear(machineMount);
      clear(optionsMount);
      const shown = visibleOptions();
      for (const option of shown.filter((entry) => entry.kind === 'machine')) machineMount.appendChild(optionCard(option));
      for (const option of shown.filter((entry) => entry.kind === 'option')) optionsMount.appendChild(optionCard(option));
      const chosen = allOptions.filter((option) => ui.selectedOptions.includes(option.code));
      clear(summaryMount);
      if (!chosen.length) summaryMount.appendChild(h('p', { class: 'text-muted', text: 'No options selected yet.' }));
      for (const option of chosen) {
        summaryMount.appendChild(h('div', { class: 'row items-center justify-between' },
          h('span', { text: `${option.name} (${option.code})` }),
          h('span', { text: money(option.price) }),
          h('button', { class: 'ghost', type: 'button', text: 'Remove', 'aria-label': `remove ${option.code}`, onclick: () => {
            ui.selectedOptions = ui.selectedOptions.filter((code) => code !== option.code);
            persist();
            paint();
          } })));
      }
      totalLine.querySelector('.total-value').textContent = money(chosen.reduce((sum, option) => sum + option.price, 0) + solution.price * (chosen.length ? 1 : 0));
    }
    paint();

    const canQuote = snap.canQuote;
    return h('div', { class: 'panel', id: 'config-panel' },
      h('div', { class: 'panel-head' },
        h('div', { class: 'text-xs font-semibold', text: `Configure solution — ${solution.name}` }),
        h('button', { class: 'secondary', type: 'button', text: 'Close', onclick: () => { ui.panelSolution = null; persist(); renderInstallationSystem(); } })),
      h('section', {},
        h('div', { class: 'text-xs font-semibold', text: 'Filters' }),
        h('p', { class: 'text-xs text-muted', text: 'Filtered by product, fastener group, feeder tracks, and force' }),
        h('div', { class: 'grid-3' },
          h('div', {}, groupSelect.label, groupSelect.element),
          h('div', {}, tracksSelect.label, tracksSelect.element),
          h('div', {}, forceSelect.label, forceSelect.element))),
      h('section', {},
        h('div', { class: 'text-xs font-semibold tracking-wide uppercase', text: 'Machine' }),
        h('div', { class: 'text-sm', text: 'Available machine options' }),
        machineMount),
      h('section', {},
        h('div', { class: 'text-xs font-semibold tracking-wide uppercase', text: 'Options' }),
        optionsMount),
      h('section', {},
        h('div', { class: 'text-sm font-semibold', text: 'Custom Tooling' }),
        h('p', { class: 'text-muted text-sm', text: 'Custom tooling is quoted by engineering once the fastener layout is confirmed.' })),
      h('section', {},
        h('div', { class: 'text-sm font-semibold', text: 'Configuration summary' }),
        summaryMount,
        canQuote ? totalLine : null,
        h('div', { class: 'row mt-4' },
          canQuote ? h('button', { class: 'secondary', type: 'button', text: 'Download quotation' }) : null,
          canQuote ? h('button', { class: 'secondary', type: 'button', text: 'Download Word' }) : null,
          h('button', { class: 'secondary', type: 'button', text: 'Add manual line item' }),
          h('button', { type: 'button', text: 'Request Quotation / Support', onclick: async () => {
            const res = await api('/configurator/rfq', { method: 'POST', body: { solution: solution.name, application: applications().find((entry) => entry.id === ui.selectedAppId)?.name, email: snap.user.email } });
            window.QD.toast(statusLineTarget(), res.message ?? 'Your request has been submitted.');
          } }))));
  }

  /* ---------------- dialogs ---------------- */

  function applicationDialog(existing) {
    const fasteners = existing ? [...(existing.fasteners ?? [])] : [];
    const field = (id, label, type = 'text', value = '') => h('div', {},
      h('label', { for: id, text: label }),
      h('input', { id, type, value, name: id }));

    const fastenerMount = h('div');
    const errorLine = h('p', { class: 'text-error', hidden: true });

    const brandInput = h('input', { id: 'react-select-5-input', type: 'text', placeholder: 'Start typing a brand (e.g., PEM)', autocomplete: 'off' });
    const typeInput = h('input', { type: 'text', placeholder: 'Start typing (e.g., SS / A4 / CLS ...)', name: 'fastener.type', autocomplete: 'off' });
    const qtyA = h('input', { type: 'number', name: 'fastener.qtyPerPartA', value: '0', 'aria-label': 'Qty per part A' });
    const qtyB = h('input', { type: 'number', name: 'fastener.qtyPerPartB', value: '0', 'aria-label': 'Qty per part B' });

    const suggest = (input, options, onPick) => {
      let list = null;
      const close = () => { if (list) { list.remove(); list = null; } };
      const open = () => {
        close();
        list = h('ul', { class: 'react-select-list', role: 'listbox' });
        for (const option of options) {
          list.appendChild(h('li', { role: 'option', tabindex: '-1', text: option, onclick: (event) => { event.stopPropagation(); close(); onPick(option); } }));
        }
        input.parentElement.appendChild(list);
      };
      input.addEventListener('input', () => {
        const needle = input.value.toLowerCase();
        const matches = options.filter((option) => option.toLowerCase().includes(needle));
        if (!matches.length) return close();
        close();
        list = h('ul', { class: 'react-select-list', role: 'listbox' });
        for (const option of matches) {
          list.appendChild(h('li', { role: 'option', tabindex: '-1', text: option, onclick: (event) => { event.stopPropagation(); close(); onPick(option); } }));
        }
        input.parentElement.appendChild(list);
      });
      input.addEventListener('blur', () => setTimeout(close, 120));
      return { open, close };
    };

    let pickedBrand = '';
    let pickedType = '';
    const brandSuggest = suggest(brandInput, ['PEM', 'SHEREX', 'PROFIL', 'Autoriv'], (option) => { pickedBrand = option; brandInput.value = option; });
    brandInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        const needle = brandInput.value.trim();
        const match = ['PEM', 'SHEREX', 'PROFIL', 'Autoriv'].find((option) => option.toLowerCase() === needle.toLowerCase())
          ?? ['PEM', 'SHEREX', 'PROFIL', 'Autoriv'].find((option) => option.toLowerCase().startsWith(needle.toLowerCase()));
        if (match) { pickedBrand = match; brandInput.value = match; brandSuggest.close(); }
      }
    });
    const typeSuggest = suggest(typeInput, ['SS', 'A4', 'CLS', 'SSL', 'FA6'], (option) => { pickedType = option; typeInput.value = option; });

    const paintFasteners = () => {
      clear(fastenerMount);
      if (!fasteners.length) {
        fastenerMount.appendChild(h('p', { class: 'text-muted text-xs', text: 'No fasteners added yet.' }));
        return;
      }
      fasteners.forEach((fastener, index) => {
        fastenerMount.appendChild(h('p', { class: 'text-xs' },
          h('span', { text: `${fastener.brand ?? ''} ${fastener.type ?? ''} — A: ${fastener.qtyPerPartA ?? 0} / B: ${fastener.qtyPerPartB ?? 0} ` }),
          h('button', { class: 'link', type: 'button', text: 'Remove fastener', onclick: () => { fasteners.splice(index, 1); paintFasteners(); } })));
      });
    };
    paintFasteners();

    const dialog = modal({
      labelledBy: 'app-dialog-title',
      children: [
        h('header', {}, h('h2', {
          id: 'app-dialog-title',
          text: existing ? `Edit: ${existing.name}` : 'New application',
        })),
        errorLine,
        h('div', { class: 'grid-2' },
          field('app-name', 'Application name', 'text', existing?.name ?? ''),
          field('app-number', 'App number', 'text', existing?.appNumber ?? ''),
          field('app-oem', 'OEM', 'text', existing?.oem ?? ''),
          field('app-program', 'Program', 'text', existing?.program ?? ''),
          field('app-volume', 'Annual volume', 'number', String(existing?.volume ?? '')),
          field('app-batch-size', 'Batch size', 'number', String(existing?.batch ?? '')),
          field('app-material', 'Material', 'text', existing?.material ?? '')),
        h('h3', { text: 'Fasteners' }),
        h('div', { class: 'grid-2' },
          h('div', {}, h('label', { for: 'react-select-5-input', text: 'Brand' }), brandInput),
          h('div', {}, h('label', { text: 'Type' }), typeInput),
          h('div', {}, h('label', { text: 'Qty per part A' }), qtyA),
          h('div', {}, h('label', { text: 'Qty per part B' }), qtyB)),
        h('div', { class: 'row' }, h('button', {
          class: 'secondary', type: 'button', text: 'Add fastener',
          onclick: () => {
            fasteners.push({ brand: pickedBrand || brandInput.value.trim(), type: pickedType || typeInput.value.trim(), qtyPerPartA: Number(qtyA.value || 0), qtyPerPartB: Number(qtyB.value || 0) });
            pickedBrand = ''; pickedType = '';
            brandInput.value = ''; typeInput.value = ''; qtyA.value = '0'; qtyB.value = '0';
            paintFasteners();
          },
        })),
        fastenerMount,
        h('div', { class: 'row mt-4' },
          h('button', { class: 'secondary', type: 'button', text: 'Cancel', onclick: () => dialog.closeModal() }),
          h('button', { type: 'button', text: 'Save', onclick: async () => {
            const payload = {
              name: document.getElementById('app-name').value,
              appNumber: document.getElementById('app-number').value,
              oem: document.getElementById('app-oem').value,
              program: document.getElementById('app-program').value,
              volume: document.getElementById('app-volume').value,
              batchSize: document.getElementById('app-batch-size').value,
              material: document.getElementById('app-material').value,
              fasteners,
            };
            const endpoint = existing ? '/configurator/applications/update' : '/configurator/applications';
            const res = await api(endpoint, { method: 'POST', body: existing ? { ...payload, id: existing.id } : payload });
            if (!res.ok) {
              errorLine.hidden = false;
              errorLine.textContent = res.error ?? res.errors?.[0] ?? 'The application could not be saved.';
              return;
            }
            snap.applications = res.applications;
            ui.selectedAppId = res.application?.id ?? ui.selectedAppId;
            persist();
            dialog.closeModal();
            renderInstallationSystem();
          } })),
      ],
    });
  }

  function useExistingDialog() {
    const list = applications();
    const tbody = h('tbody');
    const errorLine = h('p', { class: 'text-error', hidden: true });
    const search = h('input', { type: 'search', placeholder: 'Search applications', 'aria-label': 'Search applications' });
    const checked = new Set();

    const paint = () => {
      clear(tbody);
      const needle = search.value.trim().toLowerCase();
      const rows = list.filter((application) => !needle || `${application.name} ${application.oem} ${application.program}`.toLowerCase().includes(needle));
      if (!rows.length) {
        tbody.appendChild(h('tr', {}, h('td', { colspan: '5', text: 'No applications found. Create one with "New application".' })));
        return;
      }
      for (const application of rows) {
        tbody.appendChild(h('tr', {},
          h('td', {}, h('input', {
            type: 'checkbox', 'aria-label': `select ${application.name}`, checked: checked.has(application.id),
            onchange: (event) => { event.target.checked ? checked.add(application.id) : checked.delete(application.id); },
          })),
          h('td', { text: application.name }),
          h('td', { text: application.oem || '—' }),
          h('td', { text: num(application.volume) }),
          h('td', {}, h('div', { class: 'row' },
            h('button', { class: 'ghost', type: 'button', text: 'Edit', onclick: () => { dialog.closeModal(); applicationDialog(application); } }),
            h('button', { class: 'danger', type: 'button', text: 'Delete', onclick: async () => {
              const res = await api('/configurator/applications/delete', { method: 'POST', body: { id: application.id } });
              if (res.ok) { snap.applications = res.applications; dialog.closeModal(); renderInstallationSystem(); useExistingDialog(); }
            } })))));
      }
    };
    paint();

    const dialog = modal({
      labelledBy: 'my-applications-title',
      children: [
        h('header', {}, h('h2', { id: 'my-applications-title', text: 'My Applications' })),
        errorLine,
        h('div', { class: 'toolbar' }, search,
          h('button', { class: 'secondary', type: 'button', text: 'Select all', onclick: () => { list.forEach((application) => checked.add(application.id)); paint(); } }),
          h('button', { class: 'secondary', type: 'button', text: 'Refresh', onclick: async () => {
            const res = await api('/bootstrap');
            snap = res;
            paint();
          } }),
          h('button', { type: 'button', text: 'New application', onclick: () => applicationDialog(null) })),
        h('div', { class: 'table-scroll' }, h('table', {},
          h('thead', {}, h('tr', {}, h('th', { text: '' }), h('th', { text: 'Application' }), h('th', { text: 'OEM' }), h('th', { text: 'Annual volume' }), h('th', { text: 'Actions' }))),
          tbody)),
        h('div', { class: 'row mt-4' },
          h('button', { class: 'secondary', type: 'button', text: 'Close', onclick: () => dialog.closeModal() }),
          h('button', { type: 'button', text: 'OK', onclick: () => {
            const ids = [...checked];
            if (!ids.length) { errorLine.hidden = false; errorLine.textContent = 'Select at least one application to continue.'; return; }
            ui.selectedAppId = ids[0];
            persist();
            dialog.closeModal();
            renderInstallationSystem();
          } })),
      ],
    });
  }

  function assumptionsDialog() {
    const dialog = modal({
      labelledBy: 'assumptions-title',
      children: [
        h('header', {}, h('h2', { id: 'assumptions-title', text: 'Customize assumptions' })),
        ...Object.entries(ui.assumptions).map(([key, value]) => h('div', {},
          h('label', { for: `assumption-${key}`, text: key.replace(/([A-Z])/g, ' $1') }),
          h('input', { id: `assumption-${key}`, type: 'number', step: '0.01', value }))),
        h('div', { class: 'row mt-4' },
          h('button', { class: 'secondary', type: 'button', text: 'Close', onclick: () => dialog.closeModal() }),
          h('button', { type: 'button', text: 'Save', onclick: () => {
            for (const input of document.querySelectorAll('[id^="assumption-"]')) {
              ui.assumptions[input.id.replace('assumption-', '')] = Number(input.value);
            }
            persist();
            dialog.closeModal();
            renderInstallationSystem();
          } })),
      ],
    });
  }

  /* ------------------------------------------------------------------ *
   * Router                                                            *
   * ------------------------------------------------------------------ */

  function renderInstallationSystem() {
    const chips = h('div', { class: 'legend' },
      h('span', { class: 'chip', text: `Region: ${ui.region}` }),
      h('span', { class: 'chip', text: `Element types: ${ui.elementTypes.length ? ui.elementTypes.join(', ') : 'All'}` }),
      h('span', { class: 'chip', text: `Max thread: ${ui.maxThread}` }),
      h('span', { class: 'chip', text: `Force: ${forceLabel()}` }),
      h('span', { class: 'chip', text: `Compare selected: ${ui.solutions.length}` }));

    shell(
      h('p', { class: 'text-sm text-muted', text: 'System Selector & Configurator' }),
      h('h1', { text: 'Installation system' }),
      h('div', { class: 'row' },
        h('span', { class: 'pill', text: 'Handtools' }),
        h('span', { class: 'pill', text: 'Standalone Machines' }),
        h('span', { class: 'pill', text: 'Robotic Integration' }),
        h('span', { class: 'pill', text: 'InDie' }),
        h('span', { class: 'pill', text: 'Custom' })),
      chips,
      filterSection(),
      solutionsSection(),
      comparisonSection(),
      applicationParamsSection(),
      kpiSection(),
      applicationsSection(),
      actionFooter(),
      configPanel(),
    );
  }

  function paintResults() {
    const summary = root.querySelector('#matching-summary');
    if (summary) {
      summary.querySelector('.text-penn-900').textContent = String(matchingSolutions().length);
    }
    const anyChip = root.querySelector('#force-any');
    if (anyChip) anyChip.textContent = forceValueLabel();
    const legend = root.querySelector('.legend');
    if (legend) {
      const labels = [`Region: ${ui.region}`, `Element types: ${ui.elementTypes.length ? ui.elementTypes.join(', ') : 'All'}`, `Max thread: ${ui.maxThread}`, `Force: ${forceLabel()}`, `Compare selected: ${ui.solutions.length}`];
      [...legend.children].forEach((child, index) => { if (labels[index]) child.textContent = labels[index]; });
    }
  }

  function renderFilters() {
    renderInstallationSystem();
  }

  function route() {
    document.body.classList.remove('guest');
    const pathname = window.location.pathname;
    if (!snap.user) {
      if (pathname === '/register') return renderRegister();
      if (pathname === '/forget-password') return renderForgotPassword();
      if (pathname === '/verify-email') return renderVerifyEmail();
      return renderLogin();
    }
    if (pathname === '/register') return renderRegister();
    if (pathname === '/forget-password') return renderForgotPassword();
    if (pathname === '/verify-email') return renderVerifyEmail();
    if (pathname === '/installation-system') return renderInstallationSystem();
    return renderHome();
  }

  async function start() {
    snap = await api('/bootstrap');
    console.log('[testweb] bootstrap snap.applications:', snap.applications);
    console.log('[testweb] sessionStorage:', sessionStorage.getItem('qademo:ui'));
    console.log('[testweb] document.cookie:', document.cookie);
    if (!snap.catalog) {
      window.location.replace('/login');
      return;
    }
    ui = { ...defaults(), ...uiStateRead() };
    route();
  }

  document.addEventListener('click', (event) => {
    const link = event.target.closest?.('a[href^="/"]');
    if (!link || link.getAttribute('href').startsWith('http')) return;
    const href = link.getAttribute('href');
    if (href === '/login' || href === '/register' || href === '/forget-password') {
      event.preventDefault();
      window.history.pushState({}, '', href);
      route();
    }
  });
  window.addEventListener('popstate', route);

  start();
})();
