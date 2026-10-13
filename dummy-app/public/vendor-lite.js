/**
 * vendor-lite.js — dependency-free DOM/API helpers shared by both portals.
 *
 * There is no framework runtime here on purpose: the demo app must start with
 * `node dummy-app/server.js` alone. Everything is plain ES2020 + DOM.
 */
window.QD = (() => {
  const API_PREFIX = '/api';

  function h(tag, props, ...children) {
    const [attrs, ...kids] = (props && typeof props === 'object' && !Array.isArray(props) && !(props instanceof Node))
      ? [props, ...children]
      : [{}, props, ...children];
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs ?? {})) {
      if (value === undefined || value === null || value === false) continue;
      if (key === 'class') el.className = value;
      else if (key === 'text') el.textContent = String(value);
      else if (key === 'html') el.innerHTML = value;
      else if (key === 'dataset') Object.assign(el.dataset, value);
      else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
      else if (key === 'checked' || key === 'disabled' || key === 'hidden') el[key] = Boolean(value);
      else if (key === 'value') el.value = String(value);
      else el.setAttribute(key, value === true ? '' : String(value));
    }
    append(el, kids);
    return el;
  }

  function append(parent, nodes) {
    for (const node of nodes.flat(4)) {
      if (node === undefined || node === null || node === false || node === true) continue;
      parent.appendChild(node instanceof Node ? node : document.createTextNode(String(node)));
    }
    return parent;
  }

  function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
    return el;
  }

  async function api(pathname, { method = 'GET', body } = {}) {
    const res = await fetch(`${API_PREFIX}${pathname}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
    let payload = {};
    try { payload = await res.json(); } catch { /* empty response */ }
    return { status: res.status, ok: res.ok, ...payload };
  }

  const money = (value) => `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const num = (value) => Number(value || 0).toLocaleString('en-US');
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  /** Persist transient UI state so a page refresh keeps the session's choices. */
  const uiState = {
    key: 'qademo:ui',
    read() {
      try { return JSON.parse(sessionStorage.getItem(this.key) ?? '{}'); } catch { return {}; }
    },
    write(patch) {
      const next = { ...this.read(), ...patch };
      sessionStorage.setItem(this.key, JSON.stringify(next));
      return next;
    },
    reset() { sessionStorage.removeItem(this.key); },
  };

  /**
   * react-select-looking single select. Renders `class="react-select"` plus a
   * `-singleValue` node and `role="option"` items, which is what the maintained
   * specs assert on.
   */
  function selectControl({ id, label, options, value, placeholder = 'Select…', disabled = false, onChange }) {
    let current = value ?? null;
    const valueNode = h('span', { class: 'react-select-singleValue', text: current ?? placeholder });
    const control = h('div', {
      class: 'react-select',
      id,
      role: 'combobox',
      'aria-expanded': 'false',
      'aria-haspopup': 'listbox',
      'aria-label': label,
      tabindex: '0',
      'aria-disabled': disabled ? 'true' : 'false',
    }, valueNode);
    if (disabled) control.setAttribute('aria-disabled', 'true');

    let list = null;
    const close = () => {
      if (!list) return;
      list.remove();
      list = null;
      control.setAttribute('aria-expanded', 'false');
    };
    const open = () => {
      if (disabled || list) return;
      list = h('ul', { class: 'react-select-list', role: 'listbox', 'aria-label': `${label} options` });
      for (const option of options) {
        const li = h('li', {
          role: 'option',
          tabindex: '-1',
          'aria-selected': option === current ? 'true' : 'false',
          text: option,
          onclick: (event) => {
            event.stopPropagation();
            current = option;
            valueNode.textContent = option;
            close();
            if (onChange) onChange(option);
          },
        });
        list.appendChild(li);
      }
      control.parentElement.appendChild(list);
      control.setAttribute('aria-expanded', 'true');
    };
    control.addEventListener('click', (event) => {
      event.stopPropagation();
      if (list) close(); else open();
    });
    control.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); list ? close() : open(); }
    });
    document.addEventListener('click', close);
    control.setValue = (next) => { current = next; valueNode.textContent = next ?? placeholder; };
    control.getValue = () => current;
    return control;
  }

  /**
   * Modal with the `.fixed.inset-0.z-50` overlay combination and a `role="dialog"`
   * surface. The × button carries aria-label="Close".
   */
  function modal({ labelledBy, children, onClose }) {
    const body = h('div', { class: 'dialog', role: 'document' }, ...children);
    const overlay = h('div', { class: 'fixed inset-0 z-50 overlay', 'data-modal': labelledBy ?? 'modal' }, body);
    body.setAttribute('role', 'dialog');
    body.setAttribute('aria-modal', 'true');
    if (labelledBy) body.setAttribute('aria-labelledby', labelledBy);
    overlay.querySelector('.dialog').appendChild(h('button', {
      class: 'icon-button modal-x',
      type: 'button',
      'aria-label': 'Close',
      text: '×',
      onclick: () => { close(); if (onClose) onClose(); },
    }));
    function close() {
      overlay.remove();
      document.body.classList.remove('modal-open');
    }
    overlay.closeModal = close;
    document.body.classList.add('modal-open');
    document.body.appendChild(overlay);
    return overlay;
  }

  function confirmDialog({ title, message, confirmLabel = 'Confirm', onConfirm, tone = 'primary' }) {
    const dialog = modal({
      labelledBy: 'confirm-title',
      children: [
        h('header', {}, h('h2', { id: 'confirm-title', text: title })),
        h('p', { class: 'page-lede', text: message }),
        h('div', { class: 'row' },
          h('button', { class: 'secondary', type: 'button', text: 'Cancel', onclick: () => dialog.closeModal() }),
          h('button', { class: tone, type: 'button', text: confirmLabel, onclick: () => { dialog.closeModal(); onConfirm(); } })),
      ],
    });
    return dialog;
  }

  function toast(root, text, tone = 'notice') {
    const node = h('p', { class: tone, role: 'status', text });
    clear(root);
    root.appendChild(node);
    return node;
  }

  function field({ id, label, type = 'text', value = '', placeholder = '', attrs = {} }) {
    const input = h('input', { id, type, value, placeholder, name: id, ...attrs });
    return h('div', {}, h('label', { for: id, text: label }), input);
  }

  return { h, append, clear, api, money, num, esc, uiState, selectControl, modal, confirmDialog, toast, field };
})();
