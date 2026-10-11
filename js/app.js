/* =========================================================================
   app.js — Core application shell
   Navigation, theme, utilities, toast, modal, confirm, formatting, date,
   and the main router that mounts each section module.
   ========================================================================= */

const App = (() => {
  /* ---------- State ---------- */
  const state = {
    currentSection: 'dashboard',
    settings: null,
    isMobile: () => window.matchMedia('(max-width: 1023px)').matches,
  };

  /* ---------- DOM helpers ---------- */
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function el(tag, attrs = {}, children = []) {
    const e = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'dataset') Object.entries(v).forEach(([dk, dv]) => e.dataset[dk] = dv);
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (v !== null && v !== undefined) e.setAttribute(k, v);
    });
    (Array.isArray(children) ? children : [children]).forEach(c => {
      if (c == null) return;
      if (typeof c === 'string' || typeof c === 'number') e.appendChild(document.createTextNode(String(c)));
      else e.appendChild(c);
    });
    return e;
  }

  /* ---------- Formatting ---------- */
  function fmtMoney(n, withSymbol = true) {
    const v = Number(n || 0);
    const s = v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (!withSymbol) return s;
    const sym = state.settings?.currencySymbol || 'ج.م';
    return s + ' ' + sym;
  }

  function fmtNumber(n, dec = 0) {
    return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }

  function fmtDate(d, withTime = false) {
    if (!d) return '—';
    const dt = (d instanceof Date) ? d : new Date(d);
    if (isNaN(dt.getTime())) return '—';
    const s = dt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    if (!withTime) return s;
    return s + ' ' + dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  function fmtDateISO(d) {
    const dt = (d instanceof Date) ? d : new Date(d);
    return dt.toISOString();
  }

  function parseDate(s) {
    if (!s) return null;
    if (s instanceof Date) return s;
    if (typeof s === 'number') return new Date(s);
    // try dd/mm/yyyy
    const m = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
      return isNaN(d.getTime()) ? null : d;
    }
    // try yyyy-mm-dd
    const d2 = new Date(s);
    return isNaN(d2.getTime()) ? null : d2;
  }

  function todayStart() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  function todayEnd() {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  }
  function daysAgo(n) {
    const d = todayStart();
    d.setDate(d.getDate() - n);
    return d;
  }
  function startOfMonth() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }
  function startOfYear() {
    const d = new Date();
    return new Date(d.getFullYear(), 0, 1);
  }

  /* ---------- Toast ---------- */
  const toast = {
    show(msg, type = 'info', title = '', duration = 3500) {
      const root = $('#toastContainer');
      const icons = {
        success: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        error:   '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        warn:    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        info:    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
      };
      const colors = { success: 'success', error: 'error', warn: 'warn', info: 'info' };
      const t = el('div', { class: `toast ${colors[type] || 'info'}` }, [
        el('span', { class: 'toast-icon', html: icons[type] || icons.info }),
        el('div', { class: 'toast-body' }, [
          el('div', { class: 'toast-title', text: title || ({success:'تم', error:'خطأ', warn:'تنبيه', info:'معلومة'})[type] }),
          el('div', { class: 'toast-msg', text: msg }),
        ]),
        el('button', { class: 'toast-close', 'aria-label': 'إغلاق', onclick: () => t.remove() }, [
          el('svg', { viewBox: '0 0 24 24', width: '16', height: '16', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', html: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>' }),
        ]),
      ]);
      root.appendChild(t);
      setTimeout(() => {
        t.style.opacity = '0';
        t.style.transform = 'translateX(-20px)';
        setTimeout(() => t.remove(), 250);
      }, duration);
    },
    success(m, t) { this.show(m, 'success', t); },
    error(m, t)   { this.show(m, 'error', t, 5000); },
    warn(m, t)    { this.show(m, 'warn', t, 4500); },
    info(m, t)    { this.show(m, 'info', t); },
  };

  /* ---------- Modal ---------- */
  function modal({ title, body, footer, size = '', closable = true, onClose } = {}) {
    const root = $('#modalRoot');
    root.hidden = false;
    const m = el('div', { class: `modal ${size ? 'modal-' + size : ''}` }, []);
    const header = el('div', { class: 'modal-header' }, [
      el('h3', { class: 'modal-title', text: title || '' }),
    ]);
    if (closable) {
      header.appendChild(el('button', { class: 'icon-btn', 'aria-label': 'إغلاق', onclick: () => close() }, [
        el('svg', { viewBox: '0 0 24 24', width: '20', height: '20', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', html: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>' }),
      ]));
    }
    const bodyEl = el('div', { class: 'modal-body' });
    if (typeof body === 'string') bodyEl.innerHTML = body;
    else if (body instanceof Node) bodyEl.appendChild(body);
    m.appendChild(header);
    m.appendChild(bodyEl);
    if (footer) {
      const footerEl = el('div', { class: 'modal-footer' });
      if (typeof footer === 'string') footerEl.innerHTML = footer;
      else if (Array.isArray(footer)) footer.forEach(b => footerEl.appendChild(b));
      else if (footer instanceof Node) footerEl.appendChild(footer);
      m.appendChild(footerEl);
    }
    root.appendChild(m);

    function close() {
      root.innerHTML = '';
      root.hidden = true;
      if (onClose) onClose();
    }
    // Click outside to close
    root.onclick = (e) => { if (e.target === root && closable) close(); };
    // Esc to close
    const onKey = (e) => { if (e.key === 'Escape' && closable) { close(); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);

    return { el: m, close, body: bodyEl };
  }

  function closeModal() {
    const root = $('#modalRoot');
    root.innerHTML = '';
    root.hidden = true;
  }

  /* ---------- Confirm ---------- */
  function confirm({ title, message, confirmText = 'تأكيد', cancelText = 'إلغاء', danger = true, onConfirm, onCancel }) {
    const root = $('#confirmRoot');
    root.hidden = false;
    const icon = danger
      ? '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
      : '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    const c = el('div', { class: 'confirm' }, [
      el('div', { class: 'confirm-icon', html: icon }),
      el('h3', { class: 'confirm-title', text: title || 'تأكيد' }),
      el('p',  { class: 'confirm-msg', text: message || '' }),
      el('div', { class: 'confirm-actions' }, [
        el('button', { class: 'btn btn-secondary btn-sm', onclick: () => { close(); if (onCancel) onCancel(); } }, [cancelText]),
        el('button', { class: `btn btn-sm ${danger ? 'btn-danger' : 'btn-primary'}`, onclick: () => { close(); if (onConfirm) onConfirm(); } }, [confirmText]),
      ]),
    ]);
    root.appendChild(c);
    function close() { root.innerHTML = ''; root.hidden = true; }
    return { el: c, close };
  }

  /* ---------- Theme ---------- */
  async function initTheme() {
    const saved = await DB.getSettings();
    state.settings = saved;
    const theme = (await DB.getMeta('theme'))?.value || 'light';
    document.documentElement.dataset.theme = theme;
    updateThemeToggle(theme);
  }
  function updateThemeToggle(theme) {
    document.documentElement.dataset.theme = theme;
    const sun = $('.icon-sun'), moon = $('.icon-moon');
    if (sun && moon) {
      sun.style.display = theme === 'dark' ? 'none' : 'block';
      moon.style.display = theme === 'dark' ? 'block' : 'none';
    }
  }
  async function toggleTheme() {
    const cur = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    await DB.setMeta('theme', cur);
    updateThemeToggle(cur);
  }

  /* ---------- Navigation ---------- */
  const SECTIONS = [
    { id: 'dashboard', label: 'لوحة التحكم', module: () => Dashboard },
    { id: 'pos',       label: 'نقطة البيع',  module: () => POS },
    { id: 'invoices',  label: 'الفواتير',    module: () => Invoices },
    { id: 'products',  label: 'المنتجات',    module: () => Products },
    { id: 'inventory', label: 'المخزون',     module: () => Inventory },
    { id: 'purchases', label: 'المشتريات',   module: () => Purchases },
    { id: 'customers', label: 'العملاء',     module: () => Customers },
    { id: 'suppliers', label: 'الموردون',    module: () => Suppliers },
    { id: 'expenses',  label: 'المصروفات',   module: () => Expenses },
    { id: 'alerts',    label: 'التنبيهات',  module: () => Alerts },
    { id: 'reports',   label: 'التقارير',    module: () => Reports },
    { id: 'settings',  label: 'الإعدادات',   module: () => Settings },
  ];

  async function navigate(sectionId) {
    if (!sectionId) sectionId = 'dashboard';
    const def = SECTIONS.find(s => s.id === sectionId);
    if (!def) { navigate('dashboard'); return; }
    state.currentSection = sectionId;

    $$('.nav-item').forEach(a => a.classList.toggle('active', a.dataset.section === sectionId));
    $('#pageTitle').textContent = def.label;
    const content = $('#content');
    content.innerHTML = '<div class="loader-wrap"><div class="spinner"></div><p>جاري التحميل…</p></div>';
    // Close mobile sidebar
    document.getElementById('app').dataset.sidebarOpen = 'false';
    $('#sidebarOverlay').hidden = true;

    try {
      const mod = def.module();
      if (mod && typeof mod.render === 'function') {
        await mod.render(content);
      } else {
        content.innerHTML = `<div class="empty-state"><h3>${def.label}</h3><p>القسم قيد التطوير.</p></div>`;
      }
    } catch (err) {
      console.error(err);
      content.innerHTML = `<div class="empty-state"><h3>تعذّر تحميل القسم</h3><p>${err.message}</p></div>`;
    }
    if (location.hash !== '#' + sectionId) {
      history.replaceState(null, '', '#' + sectionId);
    }
  }

  /* ---------- Sidebar ---------- */
  function initSidebar() {
    $('#sidebarToggle').addEventListener('click', async () => {
      const app = $('#app');
      const collapsed = app.dataset.sidebarCollapsed === 'true';
      app.dataset.sidebarCollapsed = !collapsed;
      await DB.setMeta('sidebarCollapsed', !collapsed);
    });
    $('#mobileMenuBtn').addEventListener('click', () => {
      const app = $('#app');
      const open = app.dataset.sidebarOpen === 'true';
      app.dataset.sidebarOpen = !open;
      $('#sidebarOverlay').hidden = open;
    });
    $('#sidebarOverlay').addEventListener('click', () => {
      $('#app').dataset.sidebarOpen = 'false';
      $('#sidebarOverlay').hidden = true;
    });
    $('#themeToggle').addEventListener('click', toggleTheme);

    $$('.nav-item').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(a.dataset.section);
      });
    });

    $('[data-action="quick-sale"]')?.addEventListener('click', () => navigate('pos'));

    // Restore sidebar collapsed state
    DB.getMeta('sidebarCollapsed').then(m => {
      if (m) $('#app').dataset.sidebarCollapsed = m.value ? 'true' : 'false';
    });

    window.addEventListener('hashchange', () => {
      const h = location.hash.replace('#', '');
      if (h && h !== state.currentSection) navigate(h);
    });
  }

  /* ---------- Alerts badge ---------- */
  async function refreshAlertsBadge() {
    try {
      const products = await DB.getAll('products');
      const settings = state.settings;
      const expDays = settings?.expirationWarningDays ?? 14;
      const minDefault = settings?.defaultMinStock ?? 5;
      let count = 0;
      products.forEach(p => {
        const qty = Number(p.quantity || 0);
        const minStock = Number(p.minStock ?? minDefault);
        if (qty <= minStock) count++;
        if (p.expirationDate) {
          const d = new Date(p.expirationDate);
          const days = Math.ceil((d - Date.now()) / 86400000);
          if (days <= expDays) count++;
        }
      });
      const customers = await DB.getAll('customers');
      customers.forEach(c => { if (Number(c.balance || 0) > 0.001) count++; });
      const suppliers = await DB.getAll('suppliers');
      suppliers.forEach(s => { if (Number(s.balance || 0) > 0.001) count++; });

      const badge = $('#alertsBadge');
      if (count > 0) { badge.textContent = count > 99 ? '99+' : count; badge.hidden = false; }
      else { badge.hidden = true; }
    } catch (e) { /* ignore */ }
  }

  /* ---------- Init ---------- */
  async function init() {
    try {
      await DB.open();
      await initTheme();
      $('#brandStoreName').textContent = state.settings.storeName || 'متجري';
      initSidebar();
      await refreshAlertsBadge();
      const startSection = location.hash.replace('#', '') || 'dashboard';
      await navigate(startSection);
      // Periodic refresh
      setInterval(refreshAlertsBadge, 60000);
      window.addEventListener('online', () => toast.info('عاد الاتصال بالإنترنت.'));
      window.addEventListener('offline', () => toast.warn('انقطع الاتصال بالإنترنت. سيستمر النظام في العمل محلياً.'));
      // Register service worker for PWA / offline
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./service-worker.js')
          .then(reg => console.log('SW registered:', reg.scope))
          .catch(err => console.warn('SW registration failed:', err));
      }
    } catch (err) {
      console.error(err);
      $('#content').innerHTML = `<div class="empty-state"><h3>تعذّر بدء التطبيق</h3><p>${err.message}</p></div>`;
    }
  }

  /* ---------- Public utilities ---------- */
  function download(filename, content, mime = 'application/octet-stream') {
    const blob = (content instanceof Blob) ? content : new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function csvSafe(v) {
    if (v == null) return '';
    let s = String(v);
    if (/[",\n\r\t]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    // Formula injection protection
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return s;
  }

  function debounce(fn, ms = 250) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  /* ---------- Section stub registry ---------- */
  // Sections will register themselves as global variables (Dashboard, POS, Invoices, ...)
  // Each module must expose: async render(container)

  /* ---------- Public API ---------- */
  return {
    state, $, $$, el,
    fmtMoney, fmtNumber, fmtDate, fmtDateISO, parseDate,
    todayStart, todayEnd, daysAgo, startOfMonth, startOfYear,
    toast, modal, closeModal, confirm,
    navigate, refreshAlertsBadge,
    download, escapeHtml, csvSafe, debounce,
    init,
    get settings() { return state.settings; },
    async saveSettings(obj) { await DB.saveSettings(obj); state.settings = await DB.getSettings(); $('#brandStoreName').textContent = state.settings.storeName || 'متجري'; },
  };
})();

// Expose global aliases for each section (defined in their own files)
var Dashboard, POS, Invoices, Products, Inventory, Purchases, Customers, Suppliers, Expenses, Alerts, Reports, Settings;
