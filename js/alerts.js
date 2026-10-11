/* =========================================================================
   alerts.js — System alerts
   ========================================================================= */

Alerts = (() => {
  async function render(container) {
    const alerts = await generateAlerts();
    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon red"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div>
          <div class="stat-body"><div class="stat-label">نفذ من المخزون</div><div class="stat-value">${App.fmtNumber(alerts.filter(a => a.type === 'out_of_stock').length)}</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon amber"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg></div>
          <div class="stat-body"><div class="stat-label">مخزون منخفض</div><div class="stat-value">${App.fmtNumber(alerts.filter(a => a.type === 'low_stock').length)}</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon amber"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11H7a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2h-2"/><path d="M12 11V7a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v0"/></svg></div>
          <div class="stat-body"><div class="stat-label">قرب الانتهاء</div><div class="stat-value">${App.fmtNumber(alerts.filter(a => a.type === 'expiring').length)}</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon red"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
          <div class="stat-body"><div class="stat-label">منتهي الصلاحية</div><div class="stat-value">${App.fmtNumber(alerts.filter(a => a.type === 'expired').length)}</div></div>
        </div>
      </div>

      <h3 class="text-bold mb-3">كل التنبيهات (${alerts.length})</h3>
      ${alerts.length ? `<div class="alert-list">${alerts.map(a => `
        <div class="alert-item ${a.cls}">
          <div class="alert-icon">${a.icon}</div>
          <div class="alert-body">
            <div class="alert-title">${App.escapeHtml(a.title)}</div>
            <div class="alert-desc">${App.escapeHtml(a.desc)}</div>
          </div>
          ${a.action ? `<button class="btn btn-secondary btn-sm" onclick="${a.action}">${a.actionLabel || 'فتح'}</button>` : ''}
        </div>
      `).join('')}</div>` : '<div class="empty-state"><svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><h3>لا توجد تنبيهات</h3><p>كل شيء على ما يرام.</p></div>'}
    `;
  }

  async function generateAlerts() {
    const out = [];
    const products = await DB.getAll('products');
    const customers = await DB.getAll('customers');
    const suppliers = await DB.getAll('suppliers');
    const expDays = App.settings.expirationWarningDays ?? 14;

    products.forEach(p => {
      const qty = Number(p.quantity || 0);
      const min = Number(p.minStock ?? 0);
      if (qty <= 0) {
        out.push({
          type: 'out_of_stock', cls: 'danger',
          icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
          title: `نفذ من المخزون: ${p.name}`,
          desc: `الرمز ${p.sku} — الكمية الحالية: 0`,
          action: 'App.navigate(\'products\')', actionLabel: 'فتح المنتجات',
        });
      } else if (qty <= min) {
        out.push({
          type: 'low_stock', cls: 'warning',
          icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>',
          title: `مخزون منخفض: ${p.name}`,
          desc: `الكمية ${qty} — الحد الأدنى ${min}`,
          action: 'App.navigate(\'products\')', actionLabel: 'فتح المنتجات',
        });
      }
      if (p.expirationDate) {
        const d = new Date(p.expirationDate);
        const days = Math.ceil((d - Date.now()) / 86400000);
        if (days < 0) {
          out.push({
            type: 'expired', cls: 'danger',
            icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
            title: `منتج منتهي الصلاحية: ${p.name}`,
            desc: `تاريخ الانتهاء: ${App.fmtDate(p.expirationDate)} — تجاوز بـ ${Math.abs(days)} يوم`,
            action: 'App.navigate(\'products\')', actionLabel: 'فتح المنتجات',
          });
        } else if (days <= expDays) {
          out.push({
            type: 'expiring', cls: 'warning',
            icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg>',
            title: `قرب انتهاء الصلاحية: ${p.name}`,
            desc: `ينتهي خلال ${days} يوم — ${App.fmtDate(p.expirationDate)}`,
            action: 'App.navigate(\'products\')', actionLabel: 'فتح المنتجات',
          });
        }
      }
    });

    customers.forEach(c => {
      if (Number(c.balance || 0) > 0.001) {
        out.push({
          type: 'customer_balance', cls: 'warning',
          icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>',
          title: `رصيد مستحق من العميل: ${c.name}`,
          desc: `المستحق: ${App.fmtMoney(c.balance)} ${c.phone ? '— ' + c.phone : ''}`,
          action: 'App.navigate(\'customers\')', actionLabel: 'فتح العملاء',
        });
      }
    });
    suppliers.forEach(s => {
      if (Number(s.balance || 0) > 0.001) {
        out.push({
          type: 'supplier_balance', cls: 'warning',
          icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/></svg>',
          title: `مستحق لمورد: ${s.name}`,
          desc: `المستحق: ${App.fmtMoney(s.balance)}`,
          action: 'App.navigate(\'suppliers\')', actionLabel: 'فتح الموردين',
        });
      }
    });

    return out;
  }

  return { render, generateAlerts };
})();
