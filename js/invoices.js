/* =========================================================================
   invoices.js — Invoice management
   Register, details, returns, payments, print/PDF/WhatsApp.
   ========================================================================= */

Invoices = (() => {
  let view = { search: '', dateFilter: 'all', method: 'all', status: 'all', page: 1, perPage: 15, from: '', to: '' };

  async function render(container) {
    view.page = 1;
    container.innerHTML = `
      <div class="toolbar">
        <div class="search-input" style="flex:1">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input class="form-control" id="invSearch" placeholder="بحث برقم الفاتورة أو العميل…" value="${App.escapeHtml(view.search)}">
        </div>
        <select class="form-control" id="invDate" style="max-width:140px">
          <option value="all">كل التواريخ</option>
          <option value="today">اليوم</option>
          <option value="7d">آخر 7 أيام</option>
          <option value="month">هذا الشهر</option>
          <option value="year">هذا العام</option>
          <option value="custom">مخصص</option>
        </select>
        <select class="form-control" id="invMethod" style="max-width:130px">
          <option value="all">كل الطرق</option>
          <option value="cash">نقدي</option>
          <option value="vodafone_cash">فودافون كاش</option>
          <option value="instapay">إنستا باي</option>
          <option value="bank">تحويل بنكي</option>
          <option value="credit">آجل</option>
        </select>
        <select class="form-control" id="invStatus" style="max-width:130px">
          <option value="all">كل الحالات</option>
          <option value="paid">مدفوعة</option>
          <option value="partial">مدفوعة جزئياً</option>
          <option value="unpaid">غير مدفوعة</option>
          <option value="returned">مرتجعة</option>
        </select>
        <button class="btn btn-primary btn-sm" onclick="App.navigate('pos')">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          فاتورة جديدة
        </button>
      </div>
      <div id="invCustomRange" class="toolbar" style="display:none">
        <input type="date" class="form-control" id="invFrom" style="max-width:160px">
        <input type="date" class="form-control" id="invTo" style="max-width:160px">
      </div>
      <div id="invoicesTable"></div>
    `;

    App.$('#invSearch', container).addEventListener('input', App.debounce(() => {
      view.search = App.$('#invSearch').value.trim();
      view.page = 1; drawTable();
    }, 250));
    App.$('#invDate', container).addEventListener('change', (e) => {
      view.dateFilter = e.target.value;
      App.$('#invCustomRange').style.display = e.target.value === 'custom' ? 'flex' : 'none';
      view.page = 1; drawTable();
    });
    App.$('#invMethod', container).addEventListener('change', (e) => { view.method = e.target.value; view.page = 1; drawTable(); });
    App.$('#invStatus', container).addEventListener('change', (e) => { view.status = e.target.value; view.page = 1; drawTable(); });
    App.$('#invFrom', container)?.addEventListener('change', (e) => { view.from = e.target.value; drawTable(); });
    App.$('#invTo', container)?.addEventListener('change', (e) => { view.to = e.target.value; drawTable(); });

    await drawTable();
  }

  async function drawTable() {
    const wrap = document.getElementById('invoicesTable');
    if (!wrap) return;
    let invoices = await DB.getAll('invoices');
    invoices.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Apply filters
    const q = view.search.toLowerCase();
    invoices = invoices.filter(inv => {
      if (q && !(inv.number?.toLowerCase().includes(q) || inv.customerName?.toLowerCase().includes(q))) return false;
      if (view.method !== 'all' && inv.paymentMethod !== view.method) return false;
      if (view.status !== 'all' && inv.status !== view.status) return false;
      if (view.dateFilter !== 'all') {
        const d = new Date(inv.date);
        if (view.dateFilter === 'today') {
          const t = App.todayStart();
          if (d < t) return false;
        } else if (view.dateFilter === '7d') {
          if (d < App.daysAgo(7)) return false;
        } else if (view.dateFilter === 'month') {
          if (d < App.startOfMonth()) return false;
        } else if (view.dateFilter === 'year') {
          if (d < App.startOfYear()) return false;
        } else if (view.dateFilter === 'custom') {
          if (view.from) { const f = new Date(view.from); f.setHours(0,0,0,0); if (d < f) return false; }
          if (view.to)   { const t = new Date(view.to);   t.setHours(23,59,59,999); if (d > t) return false; }
        }
      }
      return true;
    });

    const total = invoices.length;
    const totalPages = Math.max(1, Math.ceil(total / view.perPage));
    if (view.page > totalPages) view.page = totalPages;
    const start = (view.page - 1) * view.perPage;
    const pageItems = invoices.slice(start, start + view.perPage);

    if (!total) {
      wrap.innerHTML = `<div class="empty-state">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <h3>لا توجد فواتير</h3>
        <p>ابدأ بإنشاء فاتورة جديدة من نقطة البيع.</p>
      </div>`;
      return;
    }

    wrap.innerHTML = `
      <div class="table-wrap">
        <div class="table-scroll">
          <table class="data">
            <thead>
              <tr>
                <th>رقم الفاتورة</th>
                <th>التاريخ</th>
                <th>العميل</th>
                <th class="num">الإجمالي</th>
                <th class="num">المدفوع</th>
                <th class="num">المتبقي</th>
                <th>طريقة الدفع</th>
                <th>الحالة</th>
                <th class="center">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              ${pageItems.map(inv => {
                const status = inv.status || 'paid';
                const cls = status === 'paid' ? 'success' : status === 'partial' ? 'warning' : status === 'returned' ? 'info' : 'danger';
                const label = { paid: 'مدفوعة', partial: 'جزئي', unpaid: 'غير مدفوع', returned: 'مرتجعة' }[status] || status;
                const methodLabel = { cash: 'نقدي', vodafone_cash: 'فودافون', instapay: 'إنستا باي', bank: 'تحويل', credit: 'آجل' }[inv.paymentMethod] || inv.paymentMethod;
                return `<tr>
                  <td class="mono text-bold">${App.escapeHtml(inv.number)}</td>
                  <td>${App.fmtDate(inv.date, true)}</td>
                  <td>${App.escapeHtml(inv.customerName || 'عميل نقدي')}</td>
                  <td class="num mono">${App.fmtMoney(inv.total)}</td>
                  <td class="num mono">${App.fmtMoney(inv.paid)}</td>
                  <td class="num mono" style="color:${inv.remaining > 0 ? 'var(--red-600)' : 'inherit'}">${App.fmtMoney(inv.remaining)}</td>
                  <td>${methodLabel}</td>
                  <td><span class="chip chip-${cls}">${label}</span></td>
                  <td class="center">
                    <button class="icon-btn" data-view="${inv.id}" title="عرض"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
                    <button class="icon-btn" data-print="${inv.id}" title="طباعة"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg></button>
                    <button class="icon-btn" data-pay="${inv.id}" title="سداد" ${inv.remaining <= 0.001 ? 'disabled' : ''}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></button>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        <div class="pagination" id="invPagination"></div>
      </div>
    `;

    wrap.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => viewInvoice(b.dataset.view)));
    wrap.querySelectorAll('[data-print]').forEach(b => b.addEventListener('click', () => printInvoice(b.dataset.print)));
    wrap.querySelectorAll('[data-pay]').forEach(b => b.addEventListener('click', () => recordPayment(b.dataset.pay)));

    const pg = wrap.querySelector('#invPagination');
    pg.innerHTML = `
      <button ${view.page <= 1 ? 'disabled' : ''} data-pg="prev">‹ السابق</button>
      <button disabled>صفحة ${view.page} من ${totalPages}</button>
      <button ${view.page >= totalPages ? 'disabled' : ''} data-pg="next">التالي ›</button>
      <span class="text-sm text-muted" style="margin-inline-start:8px">إجمالي: ${total}</span>
    `;
    pg.querySelector('[data-pg="prev"]')?.addEventListener('click', () => { if (view.page > 1) { view.page--; drawTable(); } });
    pg.querySelector('[data-pg="next"]')?.addEventListener('click', () => { if (view.page < totalPages) { view.page++; drawTable(); } });
  }

  async function viewInvoice(id) {
    const inv = await DB.get('invoices', id);
    if (!inv) return;
    const items = inv.items || await DB.query('invoiceItems', i => i.invoiceId === id);
    const settings = App.settings;

    const body = App.el('div', {}, []);
    body.innerHTML = `
      <div class="card mb-4">
        <div class="flex-between">
          <div>
            <div class="text-bold text-xl">${App.escapeHtml(inv.number)}</div>
            <div class="text-sm text-muted">${App.fmtDate(inv.date, true)}</div>
          </div>
          <div class="text-left">
            <div class="text-bold">${App.escapeHtml(inv.customerName || 'عميل نقدي')}</div>
            ${inv.customerPhone ? `<div class="text-sm text-muted">${App.escapeHtml(inv.customerPhone)}</div>` : ''}
          </div>
        </div>
      </div>

      <div class="table-wrap mb-4">
        <div class="table-scroll">
          <table class="data">
            <thead>
              <tr><th>المنتج</th><th class="num">الكمية</th><th class="num">السعر</th><th class="num">الخصم</th><th class="num">الإجمالي</th></tr>
            </thead>
            <tbody>
              ${items.map(it => `<tr>
                <td><div class="text-bold">${App.escapeHtml(it.name)}</div><div class="text-sm text-muted mono">${App.escapeHtml(it.sku || '')}</div></td>
                <td class="num mono">${it.quantity} ${App.escapeHtml(it.unit || '')}</td>
                <td class="num mono">${App.fmtMoney(it.unitPrice)}</td>
                <td class="num mono">${App.fmtMoney(it.discount)}</td>
                <td class="num mono">${App.fmtMoney(it.total)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <h4 class="text-bold mb-3">مدفوعات</h4>
          <div class="flex-between mb-2"><span class="text-muted">طريقة الدفع</span><span>${({ cash: 'نقدي', vodafone_cash: 'فودافون كاش', instapay: 'إنستا باي', bank: 'تحويل بنكي', credit: 'آجل' })[inv.paymentMethod] || inv.paymentMethod}</span></div>
          <div class="flex-between mb-2"><span class="text-muted">المدفوع</span><span class="mono">${App.fmtMoney(inv.paid)}</span></div>
          <div class="flex-between mb-2"><span class="text-muted">المتبقي</span><span class="mono" style="color:${inv.remaining > 0 ? 'var(--red-600)' : 'inherit'}">${App.fmtMoney(inv.remaining)}</span></div>
          ${inv.change > 0 ? `<div class="flex-between"><span class="text-muted">الصرف</span><span class="mono">${App.fmtMoney(inv.change)}</span></div>` : ''}
          ${inv.remaining > 0.001 ? `<button class="btn btn-success btn-block mt-3" onclick="Invoices._recordPayment('${inv.id}'); App.closeModal()">تسجيل دفعة</button>` : ''}
        </div>
        <div class="card">
          <h4 class="text-bold mb-3">الإجماليات</h4>
          <div class="flex-between mb-2"><span class="text-muted">الإجمالي الفرعي</span><span class="mono">${App.fmtMoney(inv.subtotal)}</span></div>
          ${inv.discount > 0 ? `<div class="flex-between mb-2"><span class="text-muted">الخصم</span><span class="mono">− ${App.fmtMoney(inv.discount)}</span></div>` : ''}
          ${inv.tax > 0 ? `<div class="flex-between mb-2"><span class="text-muted">الضريبة</span><span class="mono">${App.fmtMoney(inv.tax)}</span></div>` : ''}
          <hr class="section-divider">
          <div class="flex-between text-bold text-lg"><span>الإجمالي</span><span style="color:var(--primary)">${App.fmtMoney(inv.total)}</span></div>
        </div>
      </div>

      ${inv.notes ? `<div class="card mt-4"><h4 class="text-bold mb-2">ملاحظات</h4><p class="text-muted">${App.escapeHtml(inv.notes)}</p></div>` : ''}

      <div class="flex gap-lg mt-6" style="flex-wrap:wrap">
        <button class="btn btn-primary" onclick="Invoices.printInvoice('${inv.id}')"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> طباعة</button>
        <button class="btn btn-secondary" onclick="Invoices.savePdf('${inv.id}')"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> حفظ PDF</button>
        <button class="btn btn-success" onclick="Invoices.shareWhatsApp('${inv.id}')"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg> مشاركة واتساب</button>
        ${inv.remaining > 0.001 ? `<button class="btn btn-warning" onclick="Invoices._recordPayment('${inv.id}'); App.closeModal()"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> تسجيل دفعة</button>` : ''}
        <button class="btn btn-danger" onclick="Invoices._returnInvoice('${inv.id}'); App.closeModal()"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg> مرتجع</button>
      </div>
    `;

    App.modal({ title: 'تفاصيل الفاتورة', body, size: 'lg' });
  }

  async function recordPayment(invoiceId) {
    const inv = await DB.get('invoices', invoiceId);
    if (!inv || inv.remaining <= 0.001) { App.toast.warn('لا توجد مبالغ مستحقة.'); return; }

    const body = App.el('div', {}, []);
    body.innerHTML = `
      <div class="card mb-4">
        <div class="flex-between"><span class="text-muted">الفاتورة</span><span class="mono">${inv.number}</span></div>
        <div class="flex-between"><span class="text-muted">الإجمالي</span><span class="mono">${App.fmtMoney(inv.total)}</span></div>
        <div class="flex-between"><span class="text-muted">المدفوع</span><span class="mono">${App.fmtMoney(inv.paid)}</span></div>
        <div class="flex-between text-bold text-lg"><span>المتبقي</span><span style="color:var(--red-600)">${App.fmtMoney(inv.remaining)}</span></div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">المبلغ</label>
          <input type="number" step="0.01" min="0.01" max="${inv.remaining.toFixed(2)}" class="form-control" id="payAmt" value="${inv.remaining.toFixed(2)}">
        </div>
        <div class="form-group">
          <label class="form-label">طريقة الدفع</label>
          <select class="form-control" id="payM">
            <option value="cash">نقدي</option>
            <option value="vodafone_cash">فودافون كاش</option>
            <option value="instapay">إنستا باي</option>
            <option value="bank">تحويل بنكي</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">ملاحظات</label>
        <textarea class="form-control" id="payN" rows="2"></textarea>
      </div>
    `;
    const footer = [
      App.el('button', { class: 'btn btn-secondary', onclick: () => m.close() }, ['إلغاء']),
      App.el('button', { class: 'btn btn-success', onclick: save }, ['تأكيد الدفع']),
    ];
    const m = App.modal({ title: 'تسجيل دفعة', body, footer, size: 'sm' });

    async function save() {
      const amount = Number(App.$('#payAmt', body).value || 0);
      const method = App.$('#payM', body).value;
      const notes = App.$('#payN', body).value;
      if (amount <= 0 || amount > inv.remaining + 0.01) { App.toast.error('المبلغ غير صالح.'); return; }
      try {
        await DB.transaction(['invoices', 'payments', 'customers'], async (h) => {
          const cur = await new Promise(res => { const r = h.invoices.get(invoiceId); r.onsuccess = () => res(r.result); });
          if (!cur) throw new Error('الفاتورة غير موجودة.');
          const newPaid = Number(cur.paid) + amount;
          const newRem = Math.max(0, cur.total - newPaid);
          cur.paid = newPaid;
          cur.remaining = newRem;
          cur.status = newRem > 0.001 ? 'partial' : 'paid';
          cur.updatedAt = new Date().toISOString();
          h.invoices.put(cur);
          h.payments.put({
            id: DB.uid('pay'),
            invoiceId,
            customerId: cur.customerId,
            date: new Date().toISOString(),
            amount, method, notes,
          });
          if (cur.customerId) {
            const c = await new Promise(res => { const r = h.customers.get(cur.customerId); r.onsuccess = () => res(r.result); });
            if (c) {
              c.totalPaid = Number(c.totalPaid || 0) + amount;
              c.balance = Math.max(0, Number(c.balance || 0) - amount);
              c.updatedAt = new Date().toISOString();
              h.customers.put(c);
            }
          }
        });
        App.toast.success('تم تسجيل الدفعة.');
        m.close();
        drawTable();
        App.refreshAlertsBadge();
      } catch (e) { App.toast.error(e.message); }
    }
  }

  /* ----- Returns ----- */
  async function returnInvoice(invoiceId) {
    const inv = await DB.get('invoices', invoiceId);
    if (!inv) return;
    const items = inv.items || await DB.query('invoiceItems', i => i.invoiceId === invoiceId);
    const prevReturns = inv.returns || [];
    const returnedQty = {};
    prevReturns.forEach(r => {
      r.items.forEach(it => { returnedQty[it.productId] = (returnedQty[it.productId] || 0) + it.quantity; });
    });

    const body = App.el('div', {}, []);
    body.innerHTML = `
      <div class="card mb-4">
        <div class="text-bold">الفاتورة: ${App.escapeHtml(inv.number)}</div>
        <div class="text-sm text-muted">${App.fmtDate(inv.date, true)} — ${App.escapeHtml(inv.customerName || 'عميل نقدي')}</div>
      </div>
      <h4 class="text-bold mb-2">حدد الأصناف المرتجعة</h4>
      <div class="table-wrap">
        <div class="table-scroll">
          <table class="data">
            <thead><tr><th>المنتج</th><th class="num">الكمية الأصلية</th><th class="num">تم إرجاعه</th><th class="num">الإرجاع الآن</th></tr></thead>
            <tbody>
              ${items.map(it => {
                const rQty = returnedQty[it.productId] || 0;
                const max = it.quantity - rQty;
                return `<tr>
                  <td><div class="text-bold">${App.escapeHtml(it.name)}</div><div class="text-sm text-muted mono">${App.escapeHtml(it.sku || '')}</div></td>
                  <td class="num mono">${it.quantity}</td>
                  <td class="num mono">${rQty}</td>
                  <td class="num"><input type="number" min="0" max="${max}" value="0" data-ret="${it.productId}" data-max="${max}" data-price="${it.unitPrice}" data-cost="${it.cost || 0}" data-name="${App.escapeHtml(it.name)}" data-unit="${App.escapeHtml(it.unit || '')}" style="width:80px; padding:4px; border:1px solid var(--border); border-radius:6px; text-align:center"></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="form-group mt-3">
        <label class="form-label">سبب الإرجاع</label>
        <input class="form-control" id="retReason" placeholder="سبب الإرجاع">
      </div>
    `;
    const footer = [
      App.el('button', { class: 'btn btn-secondary', onclick: () => m.close() }, ['إلغاء']),
      App.el('button', { class: 'btn btn-danger', onclick: save }, ['تأكيد الإرجاع']),
    ];
    const m = App.modal({ title: 'مرتجع فاتورة', body, footer, size: 'lg' });

    async function save() {
      const inputs = body.querySelectorAll('[data-ret]');
      const retItems = [];
      inputs.forEach(inp => {
        const q = Number(inp.value || 0);
        if (q > 0) {
          if (q > Number(inp.dataset.max)) { throw new Error(`الكمية المرتجعة أكبر من المسموح: ${inp.dataset.name}`); }
          retItems.push({
            productId: inp.dataset.ret,
            name: inp.dataset.name,
            unit: inp.dataset.unit,
            quantity: q,
            unitPrice: Number(inp.dataset.price),
            cost: Number(inp.dataset.cost),
          });
        }
      });
      if (!retItems.length) { App.toast.warn('لم يتم تحديد أي أصناف للإرجاع.'); return; }
      const reason = App.$('#retReason', body).value || 'بدون سبب';
      const retAmount = retItems.reduce((s, r) => s + r.unitPrice * r.quantity, 0);
      const retCost = retItems.reduce((s, r) => s + (r.cost || 0) * r.quantity, 0);

      try {
        await DB.transaction(['invoices', 'products', 'inventoryMoves', 'customers'], async (h) => {
          const cur = await new Promise(res => { const r = h.invoices.get(invoiceId); r.onsuccess = () => res(r.result); });
          if (!cur) throw new Error('الفاتورة غير موجودة.');
          const returns = cur.returns || [];
          returns.push({
            id: DB.uid('ret'),
            date: new Date().toISOString(),
            items: retItems,
            amount: retAmount,
            cost: retCost,
            reason,
          });
          cur.returns = returns;
          cur.returnAmount = Number(cur.returnAmount || 0) + retAmount;
          // Adjust paid/remaining: if there was an outstanding balance, reduce from total
          cur.total = Number(cur.total) - retAmount;
          // Recompute status
          if (cur.paid >= cur.total - 0.001) {
            cur.remaining = 0;
            cur.status = cur.paid > cur.total + 0.001 ? 'paid' : 'paid';
            // Overpayment — change should be tracked elsewhere; here we just zero remaining
          } else {
            cur.remaining = cur.total - cur.paid;
            cur.status = cur.remaining > 0.001 ? 'partial' : 'paid';
          }
          if (cur.returnAmount >= cur.subtotal) cur.status = 'returned';
          cur.updatedAt = new Date().toISOString();
          h.invoices.put(cur);

          // Restore stock
          for (const r of retItems) {
            const p = await new Promise(res => { const req = h.products.get(r.productId); req.onsuccess = () => res(req.result); });
            if (p) {
              const before = Number(p.quantity || 0);
              const after = before + r.quantity;
              p.quantity = after;
              p.updatedAt = new Date().toISOString();
              h.products.put(p);
              h.inventoryMoves.put({
                id: DB.uid('mv'),
                productId: r.productId,
                date: new Date().toISOString(),
                type: 'customer_return',
                qtyBefore: before,
                qtyChange: r.quantity,
                qtyAfter: after,
                reason: `مرتجع فاتورة ${cur.number}: ${reason}`,
                source: 'return',
                ref: invoiceId,
                unitCost: p.purchasePrice,
                notes: '',
              });
            }
          }

          // Reverse customer balance if credit was used
          if (cur.customerId) {
            const c = await new Promise(res => { const req = h.customers.get(cur.customerId); req.onsuccess = () => res(req.result); });
            if (c) {
              c.totalPurchases = Math.max(0, Number(c.totalPurchases || 0) - retAmount);
              c.balance = Math.max(0, Number(c.balance || 0) - retAmount);
              c.updatedAt = new Date().toISOString();
              h.customers.put(c);
            }
          }
        });
        App.toast.success(`تم إرجاع ${retItems.length} صنف بقيمة ${App.fmtMoney(retAmount)}.`);
        m.close();
        drawTable();
        App.refreshAlertsBadge();
      } catch (e) { App.toast.error(e.message); }
    }
  }

  /* ----- Print / PDF / WhatsApp ----- */

  function buildInvoiceHtml(inv, items, settings, format = 'a4') {
    const lines = items.map(it => `
      <tr>
        <td>${App.escapeHtml(it.sku || '')}</td>
        <td>${App.escapeHtml(it.name)}</td>
        <td style="text-align:center">${it.quantity} ${App.escapeHtml(it.unit || '')}</td>
        <td style="text-align:left">${App.fmtMoney(it.unitPrice, false)}</td>
        <td style="text-align:left">${App.fmtMoney(it.discount, false)}</td>
        <td style="text-align:left">${App.fmtMoney(it.total, false)}</td>
      </tr>`).join('');

    return `
      <div class="invoice-print">
        <div class="inv-head">
          ${settings.storeLogo ? `<img src="${settings.storeLogo}" alt="logo" style="max-height:60px; margin-bottom:8px">` : ''}
          <div class="inv-store">${App.escapeHtml(settings.storeName || 'متجري')}</div>
          ${settings.storeAddress ? `<div class="inv-store-info">${App.escapeHtml(settings.storeAddress)}</div>` : ''}
          ${settings.storePhone ? `<div class="inv-store-info">${App.escapeHtml(settings.storePhone)}</div>` : ''}
        </div>

        <div class="inv-meta">
          <div><strong>رقم الفاتورة:</strong> ${App.escapeHtml(inv.number)}</div>
          <div><strong>التاريخ:</strong> ${App.fmtDate(inv.date, true)}</div>
        </div>

        <div class="inv-customer">
          <strong>العميل:</strong> ${App.escapeHtml(inv.customerName || 'عميل نقدي')} ${inv.customerPhone ? `— ${App.escapeHtml(inv.customerPhone)}` : ''}
        </div>

        <table>
          <thead>
            <tr>
              <th>الرمز</th><th>المنتج</th><th style="text-align:center">الكمية</th><th style="text-align:left">السعر</th><th style="text-align:left">الخصم</th><th style="text-align:left">الإجمالي</th>
            </tr>
          </thead>
          <tbody>${lines}</tbody>
        </table>

        <div class="inv-totals">
          <div class="row"><span>الإجمالي الفرعي</span><span>${App.fmtMoney(inv.subtotal)}</span></div>
          ${inv.discount > 0 ? `<div class="row"><span>الخصم</span><span>− ${App.fmtMoney(inv.discount)}</span></div>` : ''}
          ${inv.tax > 0 ? `<div class="row"><span>الضريبة</span><span>${App.fmtMoney(inv.tax)}</span></div>` : ''}
          <div class="row grand"><span>الإجمالي</span><span>${App.fmtMoney(inv.total)}</span></div>
          <div class="row"><span>المدفوع</span><span>${App.fmtMoney(inv.paid)}</span></div>
          ${inv.remaining > 0.001 ? `<div class="row"><span>المتبقي</span><span>${App.fmtMoney(inv.remaining)}</span></div>` : ''}
          <div class="row"><span>طريقة الدفع</span><span>${({ cash: 'نقدي', vodafone_cash: 'فودافون كاش', instapay: 'إنستا باي', bank: 'تحويل بنكي', credit: 'آجل' })[inv.paymentMethod] || inv.paymentMethod}</span></div>
        </div>

        <div class="inv-foot">
          <div>شكراً لتعاملكم معنا</div>
          ${settings.returnPolicy ? `<div style="margin-top:6px; font-style:italic">${App.escapeHtml(settings.returnPolicy)}</div>` : ''}
        </div>
      </div>
    `;
  }

  async function printInvoice(id) {
    const inv = await DB.get('invoices', id);
    if (!inv) return;
    const items = inv.items || await DB.query('invoiceItems', i => i.invoiceId === id);
    const settings = App.settings;
    const format = settings.defaultInvoiceFormat || 'a4';
    const area = document.getElementById('printArea');
    area.className = 'print-area' + (format === 'thermal' ? ' thermal' : '');
    area.innerHTML = buildInvoiceHtml(inv, items, settings, format);
    window.print();
    setTimeout(() => { area.innerHTML = ''; }, 1000);
  }

  async function savePdf(id) {
    const inv = await DB.get('invoices', id);
    if (!inv) return;
    const items = inv.items || await DB.query('invoiceItems', i => i.invoiceId === id);
    const settings = App.settings;
    const format = settings.defaultInvoiceFormat || 'a4';
    const area = document.getElementById('printArea');
    area.className = 'print-area' + (format === 'thermal' ? ' thermal' : '');
    area.innerHTML = buildInvoiceHtml(inv, items, settings, format);
    App.toast.info('سيتم فتح نافذة الطباعة. اختر "حفظ كـ PDF" كطابعة لحفظ الفاتورة كملف PDF.');
    setTimeout(() => {
      window.print();
      setTimeout(() => { area.innerHTML = ''; }, 2000);
    }, 200);
  }

  async function shareWhatsApp(id) {
    const inv = await DB.get('invoices', id);
    if (!inv) return;
    const items = inv.items || await DB.query('invoiceItems', i => i.invoiceId === id);
    const settings = App.settings;

    let phone = inv.customerPhone || '';
    if (!phone) {
      const cust = inv.customerId ? await DB.get('customers', inv.customerId) : null;
      phone = cust?.phone || '';
    }

    // Ask for / confirm phone
    const body = App.el('div', {}, []);
    body.innerHTML = `
      <div class="card mb-4">
        <div class="text-bold text-lg mb-2">رقم الفاتورة: ${App.escapeHtml(inv.number)}</div>
        <div class="text-sm text-muted">${App.fmtDate(inv.date, true)}</div>
        <hr class="section-divider">
        <div class="flex-between"><span class="text-muted">الإجمالي</span><span class="text-bold">${App.fmtMoney(inv.total)}</span></div>
        <div class="flex-between"><span class="text-muted">المدفوع</span><span>${App.fmtMoney(inv.paid)}</span></div>
        ${inv.remaining > 0 ? `<div class="flex-between"><span class="text-muted">المتبقي</span><span style="color:var(--red-600)">${App.fmtMoney(inv.remaining)}</span></div>` : ''}
      </div>
      <div class="form-group">
        <label class="form-label">رقم هاتف العميل (مع رمز الدولة)</label>
        <input class="form-control" id="waPhone" value="${App.escapeHtml(phone)}" placeholder="مثال: 201001234567">
        <div class="form-hint">سيتم استخدام صيغة wa.me/<strong>رقم</strong>?text=<strong>الرسالة</strong></div>
      </div>
      <div class="form-group">
        <label class="form-label">نص الرسالة</label>
        <textarea class="form-control" id="waMsg" rows="8"></textarea>
      </div>
      <div class="card" style="background:var(--bg-subtle)">
        <div class="text-sm text-muted">لإرسال ملف PDF: استخدم زر "حفظ PDF" ثم استخدم زر المشاركة في متصفحك أو أرفق الملف يدوياً في واتساب.</div>
      </div>
    `;
    const msg = buildWhatsAppMessage(inv, items, settings);
    body.querySelector('#waMsg').value = msg;
    const footer = [
      App.el('button', { class: 'btn btn-secondary', onclick: () => m.close() }, ['إغلاق']),
      App.el('button', { class: 'btn btn-success', onclick: send }, ['فتح واتساب']),
    ];
    const m = App.modal({ title: 'مشاركة عبر واتساب', body, footer, size: 'sm' });

    function send() {
      let p = body.querySelector('#waPhone').value.replace(/[^\d]/g, '');
      if (!p) { App.toast.warn('أدخل رقم هاتف صحيح.'); return; }
      if (!p.startsWith('20') && settings.whatsappCountryCode === '20' && p.startsWith('0')) {
        p = '20' + p.slice(1);
      } else if (!p.startsWith(settings.whatsappCountryCode) && !p.startsWith('00')) {
        p = settings.whatsappCountryCode + p.replace(/^0+/, '');
      }
      const msg = encodeURIComponent(body.querySelector('#waMsg').value);
      const url = `https://wa.me/${p}?text=${msg}`;
      window.open(url, '_blank');
      App.toast.info('تم فتح واتساب. أكمل الإرسال من هناك.');
      m.close();
    }
  }

  function buildWhatsAppMessage(inv, items, settings) {
    const lines = items.map((it, i) => `${i+1}. ${it.name} — ${it.quantity} × ${App.fmtMoney(it.unitPrice, false)} = ${App.fmtMoney(it.total, false)}`).join('\n');
    return `*${settings.storeName || 'متجري'}*\n` +
      `فاتورة: ${inv.number}\n` +
      `التاريخ: ${App.fmtDate(inv.date, true)}\n` +
      `العميل: ${inv.customerName || 'عميل نقدي'}\n` +
      `------------------------\n${lines}\n` +
      `------------------------\n` +
      `الإجمالي الفرعي: ${App.fmtMoney(inv.subtotal, false)}\n` +
      (inv.discount > 0 ? `الخصم: ${App.fmtMoney(inv.discount, false)}\n` : '') +
      (inv.tax > 0 ? `الضريبة: ${App.fmtMoney(inv.tax, false)}\n` : '') +
      `*الإجمالي: ${App.fmtMoney(inv.total, false)}*\n` +
      `المدفوع: ${App.fmtMoney(inv.paid, false)}\n` +
      (inv.remaining > 0 ? `المتبقي: ${App.fmtMoney(inv.remaining, false)}\n` : '') +
      `طريقة الدفع: ${({ cash: 'نقدي', vodafone_cash: 'فودافون كاش', instapay: 'إنستا باي', bank: 'تحويل بنكي', credit: 'آجل' })[inv.paymentMethod] || inv.paymentMethod}\n` +
      `------------------------\nشكراً لتعاملكم معنا 🌿`;
  }

  return {
    render,
    printInvoice, savePdf, shareWhatsApp,
    _recordPayment: recordPayment,
    _returnInvoice: returnInvoice,
    _view: viewInvoice,
  };
})();
