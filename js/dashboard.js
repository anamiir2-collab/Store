/* =========================================================================
   dashboard.js — Main dashboard
   ========================================================================= */

Dashboard = (() => {
  let chart7d = null;

  async function render(container) {
    const today = App.todayStart();
    const todayEnd = App.todayEnd();
    const invoices = await DB.getAll('invoices');
    const products = await DB.getAll('products');
    const customers = await DB.getAll('customers');
    const expenses = await DB.getAll('expenses');
    const movements = await DB.getAll('inventoryMoves');

    // Today's metrics
    const todayInv = invoices.filter(i => {
      const d = new Date(i.date);
      return d >= today && d <= todayEnd;
    });
    const todaySales = todayInv.reduce((s, i) => s + Number(i.total || 0), 0);
    const todayPaid = todayInv.reduce((s, i) => s + Number(i.paid || 0), 0);
    const todayGrossProfit = todayInv.reduce((s, inv) => {
      const items = inv.items || [];
      return s + items.reduce((ss, it) => ss + (Number(it.unitPrice || 0) * Number(it.quantity || 0) - Number(it.discount || 0) - Number(it.cost || 0) * Number(it.quantity || 0)), 0);
    }, 0);
    const todayExpenses = expenses.filter(e => {
      const d = new Date(e.date);
      return d >= today && d <= todayEnd;
    }).reduce((s, e) => s + Number(e.amount || 0), 0);

    const lowStock = products.filter(p => Number(p.quantity || 0) <= Number(p.minStock || 0));
    const expiring = products.filter(p => {
      if (!p.expirationDate) return false;
      const days = Math.ceil((new Date(p.expirationDate) - Date.now()) / 86400000);
      return days >= 0 && days <= (App.settings.expirationWarningDays ?? 14);
    });
    const expired = products.filter(p => {
      if (!p.expirationDate) return false;
      return new Date(p.expirationDate) < new Date();
    });

    const totalCost = products.reduce((s, p) => s + (Number(p.purchasePrice || 0) * Number(p.quantity || 0)), 0);
    const totalRetail = products.reduce((s, p) => s + (Number(p.sellingPrice || 0) * Number(p.quantity || 0)), 0);
    const customerBalances = customers.reduce((s, c) => s + Number(c.balance || 0), 0);

    const recentInvoices = invoices.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
    const recentMoves = movements.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);

    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon teal"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></div>
          <div class="stat-body"><div class="stat-label">مبيعات اليوم</div><div class="stat-value">${App.fmtMoney(todaySales)}</div><div class="stat-hint">مدفوع: ${App.fmtMoney(todayPaid)}</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>
          <div class="stat-body"><div class="stat-label">ربح اليوم الإجمالي</div><div class="stat-value">${App.fmtMoney(todayGrossProfit)}</div><div class="stat-hint">صافي: ${App.fmtMoney(todayGrossProfit - todayExpenses)}</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon blue"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
          <div class="stat-body"><div class="stat-label">فواتير اليوم</div><div class="stat-value">${App.fmtNumber(todayInv.length)}</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon purple"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div>
          <div class="stat-body"><div class="stat-label">إجمالي المنتجات</div><div class="stat-value">${App.fmtNumber(products.length)}</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon amber"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg></div>
          <div class="stat-body"><div class="stat-label">مخزون منخفض</div><div class="stat-value">${App.fmtNumber(lowStock.length)}</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon red"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div>
          <div class="stat-body"><div class="stat-label">منتهي الصلاحية</div><div class="stat-value">${App.fmtNumber(expired.length)}</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon blue"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
          <div class="stat-body"><div class="stat-label">قيمة المخزون (تكلفة)</div><div class="stat-value">${App.fmtMoney(totalCost)}</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>
          <div class="stat-body"><div class="stat-label">قيمة المخزون (بيع)</div><div class="stat-value">${App.fmtMoney(totalRetail)}</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon amber"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div>
          <div class="stat-body"><div class="stat-label">مستحقات العملاء</div><div class="stat-value">${App.fmtMoney(customerBalances)}</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon teal"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11H7a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2h-2"/><path d="M12 11V7a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v0"/></svg></div>
          <div class="stat-body"><div class="stat-label">مصروفات اليوم</div><div class="stat-value">${App.fmtMoney(todayExpenses)}</div></div>
        </div>
      </div>

      <div class="grid-2 mb-6">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">مبيعات آخر 7 أيام</h3>
          </div>
          <div style="height:280px"><canvas id="chart7d"></canvas></div>
        </div>
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">إجراءات سريعة</h3>
          </div>
          <div class="quick-actions">
            <div class="quick-action" onclick="App.navigate('pos')">
              <div class="quick-action-icon"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg></div>
              <div><div class="quick-action-label">بيع جديد</div><div class="quick-action-sub">إنشاء فاتورة</div></div>
            </div>
            <div class="quick-action" onclick="App.navigate('products')">
              <div class="quick-action-icon"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></div>
              <div><div class="quick-action-label">منتج جديد</div><div class="quick-action-sub">إضافة للكتالوج</div></div>
            </div>
            <div class="quick-action" onclick="App.navigate('purchases')">
              <div class="quick-action-icon"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/></svg></div>
              <div><div class="quick-action-label">تسجيل شراء</div><div class="quick-action-sub">فاتورة مورد</div></div>
            </div>
            <div class="quick-action" onclick="App.navigate('reports')">
              <div class="quick-action-icon"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></div>
              <div><div class="quick-action-label">التقارير</div><div class="quick-action-sub">تحليل الأداء</div></div>
            </div>
          </div>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">أحدث الفواتير</h3>
            <button class="btn btn-ghost btn-sm" onclick="App.navigate('invoices')">عرض الكل</button>
          </div>
          <div class="table-scroll">
            <table class="data">
              <thead><tr><th>الرقم</th><th>العميل</th><th class="num">الإجمالي</th><th>الحالة</th></tr></thead>
              <tbody>
                ${recentInvoices.length ? recentInvoices.map(inv => `<tr style="cursor:pointer" onclick="Invoices._view('${inv.id}')">
                  <td class="mono">${App.escapeHtml(inv.number)}</td>
                  <td>${App.escapeHtml(inv.customerName || 'نقدي')}</td>
                  <td class="num mono">${App.fmtMoney(inv.total)}</td>
                  <td><span class="chip chip-${inv.status === 'paid' ? 'success' : inv.status === 'partial' ? 'warning' : 'danger'}">${({paid:'مدفوعة', partial:'جزئي', unpaid:'غير مدفوع', returned:'مرتجعة'})[inv.status] || inv.status}</span></td>
                </tr>`).join('') : '<tr><td colspan="4" class="text-center text-muted">لا توجد فواتير بعد.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">أحدث حركات المخزون</h3>
            <button class="btn btn-ghost btn-sm" onclick="App.navigate('inventory')">عرض الكل</button>
          </div>
          <div class="table-scroll">
            <table class="data">
              <thead><tr><th>المنتج</th><th>النوع</th><th class="num">التغيير</th><th>التاريخ</th></tr></thead>
              <tbody>
                ${recentMoves.length ? recentMoves.map(m => {
                  const p = products.find(x => x.id === m.productId);
                  const cls = m.qtyChange >= 0 ? 'success' : 'danger';
                  return `<tr>
                    <td>${App.escapeHtml(p?.name || '—')}</td>
                    <td><span class="chip chip-${cls}">${({sale:'بيع', purchase:'شراء', opening:'افتتاحي', customer_return:'مرتجع', manual_add:'إضافة', manual_sub:'خصم', correction:'تسوية', import_add:'استيراد'})[m.type] || m.type}</span></td>
                    <td class="num mono" style="color:${m.qtyChange >= 0 ? 'var(--green-600)' : 'var(--red-600)'}">${m.qtyChange >= 0 ? '+' : ''}${App.fmtNumber(m.qtyChange, 2)}</td>
                    <td class="text-sm">${App.fmtDate(m.date, true)}</td>
                  </tr>`;
                }).join('') : '<tr><td colspan="4" class="text-center text-muted">لا توجد حركات.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // Render chart
    setTimeout(() => drawChart(invoices), 100);
  }

  function drawChart(invoices) {
    const ctx = document.getElementById('chart7d');
    if (!ctx) return;
    if (typeof Chart === 'undefined') {
      ctx.parentElement.innerHTML = '<div class="empty-state"><p>تعذّر تحميل مكتبة الرسوم البيانية.</p></div>';
      return;
    }
    const days = [];
    const labels = [];
    const today = App.todayStart();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push(d);
      labels.push(d.toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric' }));
    }
    const data = days.map(d => {
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      return invoices
        .filter(inv => {
          const id = new Date(inv.date);
          return id >= d && id < next;
        })
        .reduce((s, i) => s + Number(i.total || 0), 0);
    });

    if (chart7d) chart7d.destroy();
    chart7d = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'المبيعات',
          data,
          backgroundColor: '#0d9488',
          borderColor: '#0f766e',
          borderWidth: 0,
          borderRadius: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { rtl: true, callbacks: { label: (c) => App.fmtMoney(c.parsed.y) } },
        },
        scales: {
          y: { beginAtZero: true, ticks: { callback: (v) => App.fmtNumber(v) } },
        },
      },
    });
  }

  return { render };
})();
