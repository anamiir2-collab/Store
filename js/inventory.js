/* =========================================================================
   inventory.js — Inventory page
   Stock overview, manual adjustments, full movement history.
   ========================================================================= */

Inventory = (() => {
  let view = { tab: 'overview', search: '', page: 1, perPage: 20 };

  async function render(container) {
    view.page = 1;
    container.innerHTML = `
      <div class="tabs">
        <button class="tab ${view.tab === 'overview' ? 'active' : ''}" data-tab="overview">نظرة عامة</button>
        <button class="tab ${view.tab === 'movements' ? 'active' : ''}" data-tab="movements">سجل الحركات</button>
        <button class="tab ${view.tab === 'adjust' ? 'active' : ''}" data-tab="adjust">تسوية مخزون</button>
      </div>
      <div id="invContent"></div>
    `;
    container.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
      view.tab = t.dataset.tab;
      container.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === t));
      drawContent();
    }));
    await drawContent();
  }

  async function drawContent() {
    const c = document.getElementById('invContent');
    if (!c) return;
    if (view.tab === 'overview') return drawOverview(c);
    if (view.tab === 'movements') return drawMovements(c);
    if (view.tab === 'adjust') return drawAdjust(c);
  }

  async function drawOverview(c) {
    const products = await DB.getAll('products');
    const totalCost = products.reduce((s, p) => s + (Number(p.purchasePrice || 0) * Number(p.quantity || 0)), 0);
    const totalRetail = products.reduce((s, p) => s + (Number(p.sellingPrice || 0) * Number(p.quantity || 0)), 0);
    const lowStock = products.filter(p => Number(p.quantity) <= Number(p.minStock || 0));
    const outStock = products.filter(p => Number(p.quantity) <= 0);

    c.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon teal"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7h.01"/><path d="M3 5h18v14H3z"/><path d="M8 7v10M12 7v10M16 7v10"/></svg></div>
          <div class="stat-body"><div class="stat-label">إجمالي المنتجات</div><div class="stat-value">${App.fmtNumber(products.length)}</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon blue"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
          <div class="stat-body"><div class="stat-label">قيمة التكلفة</div><div class="stat-value">${App.fmtMoney(totalCost)}</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>
          <div class="stat-body"><div class="stat-label">قيمة البيع المتوقعة</div><div class="stat-value">${App.fmtMoney(totalRetail)}</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon amber"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg></div>
          <div class="stat-body"><div class="stat-label">منتجات منخفضة</div><div class="stat-value">${App.fmtNumber(lowStock.length)}</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon red"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div>
          <div class="stat-body"><div class="stat-label">نفذ من المخزون</div><div class="stat-value">${App.fmtNumber(outStock.length)}</div></div>
        </div>
      </div>

      <div class="toolbar">
        <div class="search-input" style="flex:1">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input class="form-control" id="invSearch" placeholder="بحث عن منتج…" value="${App.escapeHtml(view.search)}">
        </div>
        <button class="btn btn-secondary btn-sm" onclick="ImportExport.exportInventory()">تصدير Excel</button>
      </div>

      <div class="table-wrap">
        <div class="table-scroll">
          <table class="data">
            <thead>
              <tr>
                <th>الرمز</th><th>المنتج</th><th>الفئة</th>
                <th class="num">الكمية</th><th class="num">الحد الأدنى</th>
                <th class="num">التكلفة</th><th class="num">قيمة التكلفة</th>
                <th class="num">السعر</th><th class="num">قيمة البيع</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              ${products.length ? products.filter(p => !view.search || p.name.includes(view.search) || p.sku.includes(view.search)).map(p => {
                const ss = Products.stockStatus(p);
                const cv = Number(p.purchasePrice || 0) * Number(p.quantity || 0);
                const rv = Number(p.sellingPrice || 0) * Number(p.quantity || 0);
                return `<tr>
                  <td class="mono">${App.escapeHtml(p.sku)}</td>
                  <td>${App.escapeHtml(p.name)}</td>
                  <td>${App.escapeHtml(p.category) || '—'}</td>
                  <td class="num mono">${App.fmtNumber(p.quantity, 2)} ${App.escapeHtml(p.unit || '')}</td>
                  <td class="num mono">${App.fmtNumber(p.minStock, 2)}</td>
                  <td class="num mono">${App.fmtMoney(p.purchasePrice)}</td>
                  <td class="num mono">${App.fmtMoney(cv)}</td>
                  <td class="num mono">${App.fmtMoney(p.sellingPrice)}</td>
                  <td class="num mono">${App.fmtMoney(rv)}</td>
                  <td><span class="chip chip-${ss.cls}">${ss.label}</span></td>
                </tr>`;
              }).join('') : '<tr><td colspan="10" class="text-center text-muted">لا توجد منتجات.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
    const s = App.$('#invSearch', c);
    s?.addEventListener('input', App.debounce(() => { view.search = s.value.trim(); drawOverview(c); }, 250));
  }

  async function drawMovements(c) {
    const moves = await DB.getAll('inventoryMoves');
    moves.sort((a, b) => new Date(b.date) - new Date(a.date));
    const products = await DB.getAll('products');
    const pMap = new Map(products.map(p => [p.id, p]));

    c.innerHTML = `
      <div class="toolbar">
        <div class="search-input" style="flex:1">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input class="form-control" id="movSearch" placeholder="بحث برمز المنتج أو السبب…">
        </div>
        <select class="form-control" id="movType" style="max-width:160px">
          <option value="">كل الأنواع</option>
          <option value="opening">رصيد افتتاحي</option>
          <option value="sale">بيع</option>
          <option value="purchase">شراء</option>
          <option value="customer_return">مرتجع عميل</option>
          <option value="supplier_return">مرتجع مورد</option>
          <option value="manual_add">إضافة يدوية</option>
          <option value="manual_sub">خصم يدوي</option>
          <option value="correction">تسوية</option>
          <option value="excel_import">استيراد Excel</option>
        </select>
        <button class="btn btn-secondary btn-sm" onclick="ImportExport.exportMovements()">تصدير Excel</button>
      </div>
      <div class="table-wrap">
        <div class="table-scroll" style="max-height:70vh">
          <table class="data">
            <thead>
              <tr><th>التاريخ</th><th>المنتج</th><th>النوع</th><th class="num">قبل</th><th class="num">التغيير</th><th class="num">بعد</th><th>السبب</th><th>المرجع</th></tr>
            </thead>
            <tbody id="movBody">
              ${moves.slice(0, view.perPage).map(m => {
                const p = pMap.get(m.productId);
                const typeLabel = ({ opening: 'افتتاحي', sale: 'بيع', purchase: 'شراء', customer_return: 'مرتجع عميل', supplier_return: 'مرتجع مورد', manual_add: 'إضافة يدوية', manual_sub: 'خصم يدوي', correction: 'تسوية', transfer: 'تحويل', import_add: 'استيراد', import_replace: 'استبدال' })[m.type] || m.type;
                const cls = ({ sale: 'danger', manual_sub: 'danger', supplier_return: 'danger', import_replace: 'warning', opening: 'info', purchase: 'success', customer_return: 'success', manual_add: 'success', import_add: 'success', correction: 'warning' })[m.type] || 'neutral';
                return `<tr>
                  <td>${App.fmtDate(m.date, true)}</td>
                  <td><div class="text-bold">${App.escapeHtml(p?.name || '—')}</div><div class="text-sm text-muted mono">${App.escapeHtml(p?.sku || '')}</div></td>
                  <td><span class="chip chip-${cls}">${typeLabel}</span></td>
                  <td class="num mono">${App.fmtNumber(m.qtyBefore, 2)}</td>
                  <td class="num mono" style="color:${m.qtyChange >= 0 ? 'var(--green-600)' : 'var(--red-600)'}">${m.qtyChange >= 0 ? '+' : ''}${App.fmtNumber(m.qtyChange, 2)}</td>
                  <td class="num mono">${App.fmtNumber(m.qtyAfter, 2)}</td>
                  <td>${App.escapeHtml(m.reason || '')}</td>
                  <td class="mono text-sm text-muted">${App.escapeHtml(m.ref || '')}</td>
                </tr>`;
              }).join('')}
              ${moves.length === 0 ? '<tr><td colspan="8" class="text-center text-muted">لا توجد حركات.</td></tr>' : ''}
            </tbody>
          </table>
        </div>
        ${moves.length > view.perPage ? `<div class="pagination"><button id="loadMoreMov">عرض المزيد (${moves.length})</button></div>` : ''}
      </div>
    `;
    let limit = view.perPage;
    App.$('#loadMoreMov', c)?.addEventListener('click', () => {
      limit += 50;
      const body = App.$('#movBody', c);
      body.innerHTML = moves.slice(0, limit).map(m => {
        const p = pMap.get(m.productId);
        const typeLabel = ({ opening: 'افتتاحي', sale: 'بيع', purchase: 'شراء', customer_return: 'مرتجع عميل', supplier_return: 'مرتجع مورد', manual_add: 'إضافة يدوية', manual_sub: 'خصم يدوي', correction: 'تسوية' })[m.type] || m.type;
        const cls = ({ sale: 'danger', manual_sub: 'danger', supplier_return: 'danger', opening: 'info', purchase: 'success', customer_return: 'success', manual_add: 'success' })[m.type] || 'neutral';
        return `<tr>
          <td>${App.fmtDate(m.date, true)}</td>
          <td><div class="text-bold">${App.escapeHtml(p?.name || '—')}</div><div class="text-sm text-muted mono">${App.escapeHtml(p?.sku || '')}</div></td>
          <td><span class="chip chip-${cls}">${typeLabel}</span></td>
          <td class="num mono">${App.fmtNumber(m.qtyBefore, 2)}</td>
          <td class="num mono" style="color:${m.qtyChange >= 0 ? 'var(--green-600)' : 'var(--red-600)'}">${m.qtyChange >= 0 ? '+' : ''}${App.fmtNumber(m.qtyChange, 2)}</td>
          <td class="num mono">${App.fmtNumber(m.qtyAfter, 2)}</td>
          <td>${App.escapeHtml(m.reason || '')}</td>
          <td class="mono text-sm text-muted">${App.escapeHtml(m.ref || '')}</td>
        </tr>`;
      }).join('');
    });

    const s = App.$('#movSearch', c);
    s?.addEventListener('input', App.debounce(() => {
      const q = s.value.toLowerCase().trim();
      const filtered = q ? moves.filter(m => {
        const p = pMap.get(m.productId);
        return (p?.name || '').toLowerCase().includes(q) || (p?.sku || '').toLowerCase().includes(q) || (m.reason || '').toLowerCase().includes(q);
      }) : moves;
      const body = App.$('#movBody', c);
      body.innerHTML = filtered.slice(0, limit).map(m => {
        const p = pMap.get(m.productId);
        const typeLabel = ({ opening: 'افتتاحي', sale: 'بيع', purchase: 'شراء', customer_return: 'مرتجع عميل', supplier_return: 'مرتجع مورد', manual_add: 'إضافة يدوية', manual_sub: 'خصم يدوي', correction: 'تسوية' })[m.type] || m.type;
        const cls = ({ sale: 'danger', manual_sub: 'danger', supplier_return: 'danger', opening: 'info', purchase: 'success', customer_return: 'success', manual_add: 'success' })[m.type] || 'neutral';
        return `<tr>
          <td>${App.fmtDate(m.date, true)}</td>
          <td><div class="text-bold">${App.escapeHtml(p?.name || '—')}</div><div class="text-sm text-muted mono">${App.escapeHtml(p?.sku || '')}</div></td>
          <td><span class="chip chip-${cls}">${typeLabel}</span></td>
          <td class="num mono">${App.fmtNumber(m.qtyBefore, 2)}</td>
          <td class="num mono" style="color:${m.qtyChange >= 0 ? 'var(--green-600)' : 'var(--red-600)'}">${m.qtyChange >= 0 ? '+' : ''}${App.fmtNumber(m.qtyChange, 2)}</td>
          <td class="num mono">${App.fmtNumber(m.qtyAfter, 2)}</td>
          <td>${App.escapeHtml(m.reason || '')}</td>
          <td class="mono text-sm text-muted">${App.escapeHtml(m.ref || '')}</td>
        </tr>`;
      }).join('') || '<tr><td colspan="8" class="text-center text-muted">لا توجد نتائج.</td></tr>';
    }, 250));
  }

  async function drawAdjust(c) {
    const products = await DB.getAll('products');
    const body = App.el('div', {}, []);
    body.innerHTML = `
      <div class="card mb-4">
        <h4 class="text-bold mb-3">تسوية مخزون يدوية</h4>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">المنتج <span class="req">*</span></label>
            <select class="form-control" id="adjProd">
              <option value="">— اختر —</option>
              ${products.map(p => `<option value="${p.id}">${App.escapeHtml(p.name)} — ${App.escapeHtml(p.sku)} (متوفر: ${App.fmtNumber(p.quantity, 2)})</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">نوع الحركة <span class="req">*</span></label>
            <select class="form-control" id="adjType">
              <option value="manual_add">إضافة كمية</option>
              <option value="manual_sub">خصم كمية</option>
              <option value="correction">تسوية للقيمة الفعلية</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">القيمة <span class="req">*</span></label>
            <input type="number" step="0.001" min="0" class="form-control" id="adjQty" placeholder="الكمية">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">السبب</label>
          <input class="form-control" id="adjReason" placeholder="مثال: تلف، فاقد، جرد، إلخ">
        </div>
        <button class="btn btn-primary" id="adjSave">تسجيل الحركة</button>
      </div>

      <div class="card">
        <h4 class="text-bold mb-2">سجل الاستيراد</h4>
        <div id="impHistory"></div>
      </div>
    `;
    c.innerHTML = '';
    c.appendChild(body);

    App.$('#adjSave', body).addEventListener('click', saveAdjust);
    await drawImportHistory();
  }

  async function drawImportHistory() {
    const imports = await DB.getAll('imports');
    imports.sort((a, b) => new Date(b.date) - new Date(a.date));
    const wrap = document.getElementById('impHistory');
    if (!wrap) return;
    if (!imports.length) {
      wrap.innerHTML = '<p class="text-muted text-center">لا توجد عمليات استيراد سابقة.</p>';
      return;
    }
    wrap.innerHTML = `<div class="table-scroll"><table class="data">
      <thead><tr><th>التاريخ</th><th>الملف</th><th class="num">جديد</th><th class="num">محدّث</th><th class="num">متخطّى</th><th>طريقة الدمج</th><th class="center">تراجع</th></tr></thead>
      <tbody>
        ${imports.map(im => `<tr>
          <td>${App.fmtDate(im.date, true)}</td>
          <td>${App.escapeHtml(im.fileName)}</td>
          <td class="num mono">${im.newCount}</td>
          <td class="num mono">${im.updatedCount}</td>
          <td class="num mono">${im.skippedCount}</td>
          <td>${im.mergeMode}</td>
          <td class="center"><button class="btn btn-secondary btn-sm" data-rollback="${im.id}">تراجع</button></td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;
    wrap.querySelectorAll('[data-rollback]').forEach(b => b.addEventListener('click', () => rollback(b.dataset.rollback)));
  }

  async function rollback(importId) {
    App.confirm({
      title: 'تراجع عن استيراد',
      message: 'سيتم عكس حركات المخزون المرتبطة بهذا الاستيراد. لا يمكن التراجع عن الحركات التي تم استخدامها لاحقاً في عمليات بيع أو شراء. متابعة؟',
      confirmText: 'تراجع',
      onConfirm: async () => {
        try {
          const imp = await DB.get('imports', importId);
          if (!imp) return;
          const moves = (await DB.query('inventoryMoves', m => m.ref === importId)).sort((a, b) => new Date(a.date) - new Date(b.date));
          await DB.transaction(['products', 'inventoryMoves', 'imports'], async (h) => {
            for (const m of moves) {
              // Check no later movement on same product (in DB)
              const allLater = await new Promise(res => {
                const idx = h.inventoryMoves.store.index('productId');
                const r = idx.getAll(m.productId);
                r.onsuccess = () => res(r.result);
              });
              const hasLater = allLater.some(x => new Date(x.date) > new Date(m.date));
              if (hasLater) {
                App.toast.warn(`تعذّر التراجع عن حركة ${m.type} لمنتج ${m.productId} لوجود حركات أحدث.`);
                continue;
              }
              const p = await new Promise(res => { const r = h.products.get(m.productId); r.onsuccess = () => res(r.result); });
              if (!p) continue;
              p.quantity = Math.max(0, Number(p.quantity || 0) - Number(m.qtyChange || 0));
              p.updatedAt = new Date().toISOString();
              h.products.put(p);
              h.inventoryMoves.delete(m.id);
            }
            h.imports.delete(importId);
          });
          App.toast.success('تم التراجع عن الاستيراد.');
          drawImportHistory();
          App.refreshAlertsBadge();
        } catch (e) { App.toast.error(e.message); }
      },
    });
  }

  async function saveAdjust() {
    const pid = document.getElementById('adjProd').value;
    const type = document.getElementById('adjType').value;
    const qty = Number(document.getElementById('adjQty').value || 0);
    const reason = document.getElementById('adjReason').value || 'تسوية يدوية';
    if (!pid) { App.toast.warn('اختر المنتج.'); return; }
    if (qty <= 0) { App.toast.warn('القيمة غير صالحة.'); return; }
    try {
      await DB.transaction(['products', 'inventoryMoves'], async (h) => {
        const p = await new Promise(res => { const r = h.products.get(pid); r.onsuccess = () => res(r.result); });
        if (!p) throw new Error('المنتج غير موجود.');
        const before = Number(p.quantity || 0);
        let change = 0;
        if (type === 'manual_add') change = qty;
        else if (type === 'manual_sub') {
          if (qty > before) { App.toast.warn('الكمية المراد خصمها أكبر من المخزون الحالي.'); return; }
          change = -qty;
        } else if (type === 'correction') {
          change = qty - before;
        }
        if (change === 0) { App.toast.info('لا يوجد تغيير.'); return; }
        const after = before + change;
        p.quantity = after;
        p.updatedAt = new Date().toISOString();
        h.products.put(p);
        h.inventoryMoves.put({
          id: DB.uid('mv'),
          productId: pid,
          date: new Date().toISOString(),
          type,
          qtyBefore: before,
          qtyChange: change,
          qtyAfter: after,
          reason,
          source: 'manual',
          ref: null,
          unitCost: p.purchasePrice,
          notes: '',
        });
      });
      App.toast.success('تم تسجيل الحركة.');
      drawAdjust(document.getElementById('invContent'));
      App.refreshAlertsBadge();
    } catch (e) { App.toast.error(e.message); }
  }

  return { render };
})();
