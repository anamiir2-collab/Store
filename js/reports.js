/* =========================================================================
   reports.js — Reports & analytics with date filtering and charts
   ========================================================================= */

Reports = (() => {
  let view = { range: 'today', from: '', to: '' };

  async function render(container) {
    container.innerHTML = `
      <div class="toolbar">
        <select class="form-control" id="repRange" style="max-width:160px">
          <option value="today">اليوم</option>
          <option value="7d">آخر 7 أيام</option>
          <option value="month">هذا الشهر</option>
          <option value="year">هذا العام</option>
          <option value="custom">مخصص</option>
        </select>
        <input type="date" class="form-control" id="repFrom" style="max-width:160px; display:none">
        <input type="date" class="form-control" id="repTo" style="max-width:160px; display:none">
        <div class="spacer"></div>
      </div>
      <div id="repContent"></div>
    `;
    const range = App.$('#repRange', container);
    const from = App.$('#repFrom', container);
    const to = App.$('#repTo', container);
    view.range = range.value = 'today';
    range.addEventListener('change', () => {
      view.range = range.value;
      const show = range.value === 'custom';
      from.style.display = show ? 'block' : 'none';
      to.style.display = show ? 'block' : 'none';
      drawContent();
    });
    from.addEventListener('change', () => { view.from = from.value; drawContent(); });
    to.addEventListener('change', () => { view.to = to.value; drawContent(); });
    await drawContent();
  }

  function getRange() {
    if (view.range === 'today') return { from: App.todayStart(), to: App.todayEnd() };
    if (view.range === '7d') return { from: App.daysAgo(7), to: App.todayEnd() };
    if (view.range === 'month') return { from: App.startOfMonth(), to: App.todayEnd() };
    if (view.range === 'year') return { from: App.startOfYear(), to: App.todayEnd() };
    if (view.range === 'custom') {
      const f = view.from ? new Date(view.from) : new Date(0);
      f.setHours(0,0,0,0);
      const t = view.to ? new Date(view.to) : new Date();
      t.setHours(23,59,59,999);
      return { from: f, to: t };
    }
  }

  async function drawContent() {
    const c = document.getElementById('repContent');
    if (!c) return;
    const { from, to } = getRange();

    const invoices = (await DB.getAll('invoices')).filter(i => {
      const d = new Date(i.date);
      return d >= from && d <= to;
    });
    const expenses = (await DB.getAll('expenses')).filter(e => {
      const d = new Date(e.date);
      return d >= from && d <= to;
    });
    const products = await DB.getAll('products');
    const customers = await DB.getAll('customers');
    const suppliers = await DB.getAll('suppliers');
    const payments = (await DB.getAll('payments')).filter(p => {
      const d = new Date(p.date);
      return d >= from && d <= to;
    });

    const totalSales = invoices.reduce((s, i) => s + Number(i.total || 0), 0);
    const totalDiscounts = invoices.reduce((s, i) => s + Number(i.discount || 0) + (i.lineDiscounts || 0), 0);
    const totalTax = invoices.reduce((s, i) => s + Number(i.tax || 0), 0);
    const totalReturns = invoices.reduce((s, i) => s + Number(i.returnAmount || 0), 0);
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

    // Cost of goods sold (from invoice item snapshots)
    let cogs = 0, grossProfit = 0;
    const productSales = {}; // {pid: {qty, revenue, cost}}
    invoices.forEach(inv => {
      const items = inv.items || [];
      items.forEach(it => {
        const lineRevenue = Number(it.unitPrice || 0) * Number(it.quantity || 0) - Number(it.discount || 0);
        const lineCost = Number(it.cost || 0) * Number(it.quantity || 0);
        cogs += lineCost;
        grossProfit += lineRevenue - lineCost;
        if (!productSales[it.productId]) productSales[it.productId] = { name: it.name, sku: it.sku, qty: 0, revenue: 0, cost: 0 };
        productSales[it.productId].qty += Number(it.quantity || 0);
        productSales[it.productId].revenue += lineRevenue;
        productSales[it.productId].cost += lineCost;
      });
    });
    // Subtract returns
    invoices.forEach(inv => {
      (inv.returns || []).forEach(r => {
        r.items.forEach(it => {
          cogs -= Number(it.cost || 0) * Number(it.quantity || 0);
          grossProfit -= Number(it.unitPrice || 0) * Number(it.quantity || 0) - Number(it.cost || 0) * Number(it.quantity || 0);
          if (productSales[it.productId]) {
            productSales[it.productId].qty -= Number(it.quantity || 0);
            productSales[it.productId].revenue -= Number(it.unitPrice || 0) * Number(it.quantity || 0);
            productSales[it.productId].cost -= Number(it.cost || 0) * Number(it.quantity || 0);
          }
        });
      });
    });

    const netProfit = grossProfit - totalExpenses;
    const avgInvoice = invoices.length ? totalSales / invoices.length : 0;
    const totalCost = products.reduce((s, p) => s + (Number(p.purchasePrice || 0) * Number(p.quantity || 0)), 0);
    const totalRetail = products.reduce((s, p) => s + (Number(p.sellingPrice || 0) * Number(p.quantity || 0)), 0);
    const customerReceivables = customers.reduce((s, c) => s + Number(c.balance || 0), 0);
    const supplierPayables = suppliers.reduce((s, c) => s + Number(c.balance || 0), 0);

    // Payment methods
    const byMethod = {};
    payments.forEach(p => { byMethod[p.method] = (byMethod[p.method] || 0) + Number(p.amount || 0); });

    // Top products
    const topProducts = Object.values(productSales).sort((a, b) => b.qty - a.qty).slice(0, 10);

    // Low stock products
    const lowStock = products.filter(p => Number(p.quantity || 0) <= Number(p.minStock || 0));

    c.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon teal"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/></svg></div>
          <div class="stat-body"><div class="stat-label">إجمالي المبيعات</div><div class="stat-value">${App.fmtMoney(totalSales)}</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>
          <div class="stat-body"><div class="stat-label">إجمالي الربح</div><div class="stat-value">${App.fmtMoney(grossProfit)}</div><div class="stat-hint">تكلفة البضاعة: ${App.fmtMoney(cogs)}</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon ${netProfit >= 0 ? 'green' : 'red'}"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
          <div class="stat-body"><div class="stat-label">صافي الربح</div><div class="stat-value" style="color:${netProfit >= 0 ? 'var(--green-600)' : 'var(--red-600)'}">${App.fmtMoney(netProfit)}</div><div class="stat-hint">بعد مصروفات: ${App.fmtMoney(totalExpenses)}</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon blue"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg></div>
          <div class="stat-body"><div class="stat-label">عدد الفواتير</div><div class="stat-value">${App.fmtNumber(invoices.length)}</div><div class="stat-hint">متوسط: ${App.fmtMoney(avgInvoice)}</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon amber"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7h.01"/><path d="M3 5h18v14H3z"/></svg></div>
          <div class="stat-body"><div class="stat-label">إجمالي الخصومات</div><div class="stat-value">${App.fmtMoney(totalDiscounts)}</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon purple"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/></svg></div>
          <div class="stat-body"><div class="stat-label">إجمالي الضريبة</div><div class="stat-value">${App.fmtMoney(totalTax)}</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon red"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg></div>
          <div class="stat-body"><div class="stat-label">المرتجعات</div><div class="stat-value">${App.fmtMoney(totalReturns)}</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon blue"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
          <div class="stat-body"><div class="stat-label">قيمة المخزون</div><div class="stat-value">${App.fmtMoney(totalCost)}</div><div class="stat-hint">بيع متوقع: ${App.fmtMoney(totalRetail)}</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon amber"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div>
          <div class="stat-body"><div class="stat-label">مستحقات العملاء</div><div class="stat-value">${App.fmtMoney(customerReceivables)}</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon red"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/></svg></div>
          <div class="stat-body"><div class="stat-label">مستحقات الموردين</div><div class="stat-value">${App.fmtMoney(supplierPayables)}</div></div>
        </div>
      </div>

      <div class="grid-2 mb-6">
        <div class="card">
          <div class="card-header"><h3 class="card-title">المبيعات حسب طريقة الدفع</h3></div>
          ${Object.keys(byMethod).length ? `<div style="height:240px"><canvas id="chartPay"></canvas></div>` : '<div class="empty-state"><p>لا توجد مبيعات في الفترة.</p></div>'}
        </div>
        <div class="card">
          <div class="card-header"><h3 class="card-title">أعلى المنتجات مبيعاً</h3></div>
          <div class="table-scroll">
            <table class="data">
              <thead><tr><th>المنتج</th><th class="num">الكمية</th><th class="num">الإيراد</th><th class="num">الربح</th></tr></thead>
              <tbody>
                ${topProducts.length ? topProducts.map(p => `<tr>
                  <td><div class="text-bold">${App.escapeHtml(p.name)}</div><div class="text-sm text-muted mono">${App.escapeHtml(p.sku || '')}</div></td>
                  <td class="num mono">${App.fmtNumber(p.qty, 2)}</td>
                  <td class="num mono">${App.fmtMoney(p.revenue)}</td>
                  <td class="num mono" style="color:var(--green-600)">${App.fmtMoney(p.revenue - p.cost)}</td>
                </tr>`).join('') : '<tr><td colspan="4" class="text-center text-muted">لا توجد بيانات.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="card mb-6">
        <div class="card-header">
          <h3 class="card-title">منتجات منخفضة المخزون (${lowStock.length})</h3>
          <button class="btn btn-secondary btn-sm" onclick="ImportExport.exportInventory()">تصدير Excel</button>
        </div>
        <div class="table-scroll">
          <table class="data">
            <thead><tr><th>الرمز</th><th>المنتج</th><th class="num">الكمية</th><th class="num">الحد الأدنى</th><th>الحالة</th></tr></thead>
            <tbody>
              ${lowStock.length ? lowStock.slice(0, 20).map(p => {
                const ss = Products.stockStatus(p);
                return `<tr>
                  <td class="mono">${App.escapeHtml(p.sku)}</td>
                  <td>${App.escapeHtml(p.name)}</td>
                  <td class="num mono">${App.fmtNumber(p.quantity, 2)}</td>
                  <td class="num mono">${App.fmtNumber(p.minStock, 2)}</td>
                  <td><span class="chip chip-${ss.cls}">${ss.label}</span></td>
                </tr>`;
              }).join('') : '<tr><td colspan="5" class="text-center text-muted">كل المنتجات ضمن الحد الآمن.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-header"><h3 class="card-title">المصروفات حسب الفئة</h3></div>
          ${expenses.length ? `<div style="height:240px"><canvas id="chartExp"></canvas></div>` : '<div class="empty-state"><p>لا توجد مصروفات.</p></div>'}
        </div>
        <div class="card">
          <div class="card-header"><h3 class="card-title">تفاصيل إضافية</h3></div>
          <div class="flex-between mb-2"><span class="text-muted">متوسط قيمة الفاتورة</span><span class="mono">${App.fmtMoney(avgInvoice)}</span></div>
          <div class="flex-between mb-2"><span class="text-muted">إجمالي الخصومات</span><span class="mono">${App.fmtMoney(totalDiscounts)}</span></div>
          <div class="flex-between mb-2"><span class="text-muted">إجمالي الضريبة</span><span class="mono">${App.fmtMoney(totalTax)}</span></div>
          <div class="flex-between mb-2"><span class="text-muted">إجمالي المرتجعات</span><span class="mono">${App.fmtMoney(totalReturns)}</span></div>
          <hr class="section-divider">
          <div class="flex-between mb-2"><span class="text-muted">إجمالي الإيراد</span><span class="mono">${App.fmtMoney(totalSales)}</span></div>
          <div class="flex-between mb-2"><span class="text-muted">تكلفة البضاعة المباعة</span><span class="mono">${App.fmtMoney(cogs)}</span></div>
          <div class="flex-between mb-2"><span class="text-muted">إجمالي الربح</span><span class="mono" style="color:var(--green-600)">${App.fmtMoney(grossProfit)}</span></div>
          <div class="flex-between mb-2"><span class="text-muted">المصروفات</span><span class="mono" style="color:var(--red-600)">− ${App.fmtMoney(totalExpenses)}</span></div>
          <div class="flex-between text-bold text-lg"><span>صافي الربح</span><span style="color:${netProfit >= 0 ? 'var(--green-600)' : 'var(--red-600)'}">${App.fmtMoney(netProfit)}</span></div>
        </div>
      </div>
    `;

    setTimeout(() => drawCharts(byMethod, expenses), 100);
  }

  function drawCharts(byMethod, expenses) {
    if (typeof Chart === 'undefined') return;
    const methodLabels = { cash: 'نقدي', vodafone_cash: 'فودافون', instapay: 'إنستا باي', bank: 'تحويل', credit: 'آجل' };

    // Payment method pie
    const ctxPay = document.getElementById('chartPay');
    if (ctxPay) {
      const entries = Object.entries(byMethod);
      new Chart(ctxPay, {
        type: 'doughnut',
        data: {
          labels: entries.map(([k]) => methodLabels[k] || k),
          datasets: [{ data: entries.map(([_, v]) => v), backgroundColor: ['#0d9488', '#f59e0b', '#3b82f6', '#8b5cf6', '#ef4444', '#64748b'] }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', rtl: true }, tooltip: { rtl: true, callbacks: { label: (c) => `${c.label}: ${App.fmtMoney(c.parsed)}` } } },
        },
      });
    }

    // Expenses by category
    const ctxExp = document.getElementById('chartExp');
    if (ctxExp) {
      const byCat = {};
      expenses.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount || 0); });
      const entries = Object.entries(byCat);
      new Chart(ctxExp, {
        type: 'bar',
        data: {
          labels: entries.map(([k]) => k),
          datasets: [{ data: entries.map(([_, v]) => v), backgroundColor: '#ef4444', borderRadius: 6 }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { rtl: true } },
          scales: { y: { beginAtZero: true, ticks: { callback: (v) => App.fmtNumber(v) } } },
        },
      });
    }
  }

  return { render };
})();
