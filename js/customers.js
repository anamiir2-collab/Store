/* =========================================================================
   customers.js — Customer management + statements
   ========================================================================= */

Customers = (() => {
  let view = { search: '', page: 1, perPage: 15 };

  async function render(container) {
    view.page = 1;
    container.innerHTML = `
      <div class="toolbar">
        <div class="search-input" style="flex:1">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input class="form-control" id="custSearch" placeholder="بحث بالاسم أو الهاتف…">
        </div>
        <button class="btn btn-primary btn-sm" id="custAdd"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> عميل جديد</button>
        <button class="btn btn-secondary btn-sm" onclick="ImportExport.exportCustomers()">تصدير Excel</button>
      </div>
      <div id="custTable"></div>
    `;
    App.$('#custSearch', container).addEventListener('input', App.debounce(() => { view.search = App.$('#custSearch').value.trim(); drawTable(); }, 250));
    App.$('#custAdd', container).addEventListener('click', () => openForm());
    await drawTable();
  }

  async function drawTable() {
    const wrap = document.getElementById('custTable');
    if (!wrap) return;
    let customers = await DB.getAll('customers');
    const q = view.search.toLowerCase();
    if (q) customers = customers.filter(c => c.name?.toLowerCase().includes(q) || c.phone?.toLowerCase().includes(q));

    if (!customers.length) {
      wrap.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg><h3>لا يوجد عملاء</h3><p>ابدأ بإضافة عميل جديد.</p></div>`;
      return;
    }

    wrap.innerHTML = `
      <div class="table-wrap">
        <div class="table-scroll">
          <table class="data">
            <thead>
              <tr><th>الاسم</th><th>الهاتف</th><th class="num">إجمالي المشتريات</th><th class="num">المدفوع</th><th class="num">الرصيد المستحق</th><th class="center">إجراءات</th></tr>
            </thead>
            <tbody>
              ${customers.map(c => `<tr>
                <td class="text-bold">${App.escapeHtml(c.name)}</td>
                <td class="mono">${App.escapeHtml(c.phone || '—')}</td>
                <td class="num mono">${App.fmtMoney(c.totalPurchases || 0)}</td>
                <td class="num mono">${App.fmtMoney(c.totalPaid || 0)}</td>
                <td class="num mono" style="color:${c.balance > 0 ? 'var(--red-600)' : 'inherit'}">${App.fmtMoney(c.balance || 0)}</td>
                <td class="center">
                  <button class="icon-btn" data-edit="${c.id}" title="تعديل"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                  <button class="icon-btn" data-statement="${c.id}" title="كشف حساب"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></button>
                  ${c.balance > 0 ? `<button class="icon-btn" data-pay="${c.id}" title="تحصيل"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></button>` : ''}
                  <button class="icon-btn" data-del="${c.id}" title="حذف"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    wrap.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openForm(b.dataset.edit)));
    wrap.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => onDelete(b.dataset.del)));
    wrap.querySelectorAll('[data-statement]').forEach(b => b.addEventListener('click', () => statement(b.dataset.statement)));
    wrap.querySelectorAll('[data-pay]').forEach(b => b.addEventListener('click', () => collectPayment(b.dataset.pay)));
  }

  async function openForm(id) {
    const c = id ? await DB.get('customers', id) : null;
    const body = App.el('div', {}, []);
    body.innerHTML = `
      <div class="form-group">
        <label class="form-label">الاسم <span class="req">*</span></label>
        <input class="form-control" id="c_name" value="${App.escapeHtml(c?.name || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">الهاتف</label>
        <input class="form-control" id="c_phone" value="${App.escapeHtml(c?.phone || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">العنوان</label>
        <textarea class="form-control" id="c_address" rows="2">${App.escapeHtml(c?.address || '')}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">ملاحظات</label>
        <textarea class="form-control" id="c_notes" rows="2">${App.escapeHtml(c?.notes || '')}</textarea>
      </div>
    `;
    const footer = [
      App.el('button', { class: 'btn btn-secondary', onclick: () => m.close() }, ['إلغاء']),
      App.el('button', { class: 'btn btn-primary', onclick: save }, [c ? 'حفظ' : 'إضافة']),
    ];
    const m = App.modal({ title: c ? 'تعديل عميل' : 'عميل جديد', body, footer, size: 'sm' });

    async function save() {
      const name = App.$('#c_name', body).value.trim();
      if (!name) { App.toast.warn('الاسم مطلوب.'); return; }
      const obj = {
        id: c?.id || DB.uid('cust'),
        name,
        phone: App.$('#c_phone', body).value,
        address: App.$('#c_address', body).value,
        notes: App.$('#c_notes', body).value,
        totalPurchases: c?.totalPurchases || 0,
        totalPaid: c?.totalPaid || 0,
        balance: c?.balance || 0,
        createdAt: c?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await DB.put('customers', obj);
      App.toast.success(c ? 'تم حفظ التعديلات.' : 'تمت إضافة العميل.');
      m.close();
      drawTable();
    }
  }

  async function onDelete(id) {
    const c = await DB.get('customers', id);
    if (c && c.balance > 0) {
      App.toast.warn('لا يمكن حذف عميل له رصيد مستحق. سدد الرصيد أولاً.');
      return;
    }
    App.confirm({
      title: 'حذف العميل',
      message: `هل تريد حذف "${App.escapeHtml(c?.name || '')}"؟`,
      onConfirm: async () => {
        await DB.remove('customers', id);
        App.toast.success('تم الحذف.');
        drawTable();
      },
    });
  }

  async function statement(id) {
    const c = await DB.get('customers', id);
    if (!c) return;
    const invoices = (await DB.query('invoices', i => i.customerId === id)).sort((a, b) => new Date(a.date) - new Date(b.date));
    const payments = (await DB.query('payments', p => p.customerId === id)).sort((a, b) => new Date(a.date) - new Date(b.date));

    const body = App.el('div', {}, []);
    body.innerHTML = `
      <div class="card mb-4">
        <div class="flex-between">
          <div>
            <div class="text-bold text-xl">${App.escapeHtml(c.name)}</div>
            <div class="text-sm text-muted">${App.escapeHtml(c.phone || '')} ${c.address ? '— ' + App.escapeHtml(c.address) : ''}</div>
          </div>
          <div class="text-left">
            <div class="text-sm text-muted">الرصيد الحالي</div>
            <div class="text-bold text-xl" style="color:${c.balance > 0 ? 'var(--red-600)' : 'var(--green-600)'}">${App.fmtMoney(c.balance)}</div>
          </div>
        </div>
      </div>
      <h4 class="text-bold mb-2">العمليات</h4>
      <div class="table-wrap">
        <div class="table-scroll" style="max-height:400px">
          <table class="data">
            <thead><tr><th>التاريخ</th><th>النوع</th><th>المرجع</th><th class="num">مدين</th><th class="num">دائن</th><th class="num">الرصيد</th></tr></thead>
            <tbody>
              ${(() => {
                const events = [];
                invoices.forEach(i => events.push({ date: i.date, type: 'فاتورة', ref: i.number, debit: i.total, credit: 0 }));
                payments.forEach(p => events.push({ date: p.date, type: 'سداد', ref: p.method, debit: 0, credit: p.amount }));
                events.sort((a, b) => new Date(a.date) - new Date(b.date));
                let bal = 0;
                return events.map(e => {
                  bal += e.debit - e.credit;
                  return `<tr>
                    <td>${App.fmtDate(e.date, true)}</td>
                    <td><span class="chip chip-${e.type === 'فاتورة' ? 'info' : 'success'}">${e.type}</span></td>
                    <td class="mono">${App.escapeHtml(e.ref || '')}</td>
                    <td class="num mono">${e.debit ? App.fmtMoney(e.debit) : '—'}</td>
                    <td class="num mono">${e.credit ? App.fmtMoney(e.credit) : '—'}</td>
                    <td class="num mono text-bold">${App.fmtMoney(bal)}</td>
                  </tr>`;
                }).join('');
              })()}
            </tbody>
          </table>
        </div>
      </div>
    `;
    const footer = [
      App.el('button', { class: 'btn btn-primary', onclick: () => { App.download(`كشف_حساب_${c.name}.html`, `<html dir="rtl"><head><meta charset="utf-8"><title>كشف حساب</title><style>body{font-family:Cairo,sans-serif;padding:20px} table{width:100%; border-collapse:collapse} th,td{padding:8px; border:1px solid #ddd; text-align:right} th{background:#0d9488; color:#fff}</style></head><body><h1>${c.name}</h1>${body.innerHTML}</body></html>`, 'text/html'); } }, ['تنزيل كـ HTML']),
      App.el('button', { class: 'btn btn-secondary', onclick: () => m.close() }, ['إغلاق']),
    ];
    const m = App.modal({ title: 'كشف حساب', body, footer, size: 'lg' });
  }

  async function collectPayment(id) {
    const c = await DB.get('customers', id);
    if (!c || c.balance <= 0) return;
    const body = App.el('div', {}, []);
    body.innerHTML = `
      <div class="card mb-4">
        <div class="flex-between"><span class="text-muted">العميل</span><span class="text-bold">${App.escapeHtml(c.name)}</span></div>
        <div class="flex-between"><span class="text-muted">الرصيد المستحق</span><span class="text-bold text-lg" style="color:var(--red-600)">${App.fmtMoney(c.balance)}</span></div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">المبلغ</label>
          <input type="number" step="0.01" min="0.01" max="${c.balance.toFixed(2)}" class="form-control" id="collAmt" value="${c.balance.toFixed(2)}">
        </div>
        <div class="form-group">
          <label class="form-label">طريقة الدفع</label>
          <select class="form-control" id="collMethod">
            <option value="cash">نقدي</option>
            <option value="vodafone_cash">فودافون كاش</option>
            <option value="instapay">إنستا باي</option>
            <option value="bank">تحويل بنكي</option>
          </select>
        </div>
      </div>
    `;
    const footer = [
      App.el('button', { class: 'btn btn-secondary', onclick: () => m.close() }, ['إلغاء']),
      App.el('button', { class: 'btn btn-success', onclick: save }, ['تأكيد التحصيل']),
    ];
    const m = App.modal({ title: 'تحصيل دفعة', body, footer, size: 'sm' });

    async function save() {
      const amt = Number(App.$('#collAmt', body).value || 0);
      const method = App.$('#collMethod', body).value;
      if (amt <= 0 || amt > c.balance + 0.01) { App.toast.error('المبلغ غير صالح.'); return; }
      try {
        await DB.transaction(['customers', 'payments'], async (h) => {
          const cur = await new Promise(res => { const r = h.customers.get(id); r.onsuccess = () => res(r.result); });
          cur.totalPaid = Number(cur.totalPaid || 0) + amt;
          cur.balance = Math.max(0, Number(cur.balance || 0) - amt);
          cur.updatedAt = new Date().toISOString();
          h.customers.put(cur);
          h.payments.put({
            id: DB.uid('pay'),
            invoiceId: null,
            customerId: id,
            date: new Date().toISOString(),
            amount: amt,
            method,
            notes: 'تحصيل مباشر',
          });
        });
        App.toast.success('تم التحصيل.');
        m.close();
        drawTable();
        App.refreshAlertsBadge();
      } catch (e) { App.toast.error(e.message); }
    }
  }

  return { render, openForm };
})();
