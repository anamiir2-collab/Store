/* =========================================================================
   purchases.js — Suppliers + purchase invoices
   ========================================================================= */

Purchases = (() => {
  let view = { tab: 'invoices', page: 1, perPage: 15 };

  async function render(container) {
    view.page = 1;
    container.innerHTML = `
      <div class="tabs">
        <button class="tab ${view.tab === 'invoices' ? 'active' : ''}" data-tab="invoices">فواتير المشتريات</button>
        <button class="tab ${view.tab === 'new' ? 'active' : ''}" data-tab="new">فاتورة شراء جديدة</button>
      </div>
      <div id="purContent"></div>
    `;
    container.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
      view.tab = t.dataset.tab;
      container.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === t));
      drawContent();
    }));
    await drawContent();
  }

  async function drawContent() {
    const c = document.getElementById('purContent');
    if (!c) return;
    if (view.tab === 'invoices') return drawInvoices(c);
    if (view.tab === 'new') return drawNew(c);
  }

  async function drawInvoices(c) {
    const purchases = await DB.getAll('purchases');
    purchases.sort((a, b) => new Date(b.date) - new Date(a.date));
    const suppliers = await DB.getAll('suppliers');
    const sMap = new Map(suppliers.map(s => [s.id, s]));

    c.innerHTML = `
      <div class="toolbar">
        <div class="search-input" style="flex:1">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input class="form-control" id="purSearch" placeholder="بحث برقم الفاتورة أو المورد…">
        </div>
        <button class="btn btn-secondary btn-sm" onclick="ImportExport.exportPurchases()">تصدير Excel</button>
      </div>
      <div class="table-wrap">
        <div class="table-scroll">
          <table class="data">
            <thead>
              <tr><th>رقم الفاتورة</th><th>التاريخ</th><th>المورد</th><th class="num">الإجمالي</th><th class="num">المدفوع</th><th class="num">المتبقي</th><th class="center">إجراءات</th></tr>
            </thead>
            <tbody>
              ${purchases.length ? purchases.map(p => {
                const s = sMap.get(p.supplierId);
                return `<tr>
                  <td class="mono">${App.escapeHtml(p.number)}</td>
                  <td>${App.fmtDate(p.date, true)}</td>
                  <td>${App.escapeHtml(s?.name || '—')}</td>
                  <td class="num mono">${App.fmtMoney(p.total)}</td>
                  <td class="num mono">${App.fmtMoney(p.paid)}</td>
                  <td class="num mono" style="color:${p.remaining > 0 ? 'var(--red-600)' : 'inherit'}">${App.fmtMoney(p.remaining)}</td>
                  <td class="center">
                    <button class="icon-btn" data-pay="${p.id}" ${p.remaining <= 0.001 ? 'disabled' : ''} title="سداد"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></button>
                  </td>
                </tr>`;
              }).join('') : '<tr><td colspan="7" class="text-center text-muted">لا توجد فواتير مشتريات.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
    c.querySelectorAll('[data-pay]').forEach(b => b.addEventListener('click', () => paySupplier(b.dataset.pay)));
  }

  async function drawNew(c) {
    const products = await DB.getAll('products');
    const suppliers = await DB.getAll('suppliers');
    const cart = [];

    const body = App.el('div', {}, []);
    body.innerHTML = `
      <div class="grid-2">
        <div class="card">
          <h4 class="text-bold mb-3">بيانات الفاتورة</h4>
          <div class="form-group">
            <label class="form-label">المورد</label>
            <select class="form-control" id="pSupplier">
              <option value="">— اختر المورد —</option>
              ${suppliers.map(s => `<option value="${s.id}">${App.escapeHtml(s.name)}</option>`).join('')}
            </select>
            <button class="btn btn-link btn-sm" onclick="Suppliers._openForm(); App.closeModal()">+ إضافة مورد</button>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">رقم الفاتورة</label>
              <input class="form-control" id="pNumber" placeholder="تلقائي" value="PUR-${String(Date.now()).slice(-6)}">
            </div>
            <div class="form-group">
              <label class="form-label">التاريخ</label>
              <input type="date" class="form-control" id="pDate" value="${new Date().toISOString().slice(0,10)}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">إضافة منتج للفاتورة</label>
            <select class="form-control" id="pProduct">
              <option value="">— اختر المنتج —</option>
              ${products.map(p => `<option value="${p.id}" data-cost="${p.purchasePrice}" data-name="${App.escapeHtml(p.name)}" data-unit="${App.escapeHtml(p.unit || '')}">${App.escapeHtml(p.name)} — ${App.escapeHtml(p.sku)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="card">
          <h4 class="text-bold mb-3">أصناف الفاتورة</h4>
          <div id="purItems" class="mb-3" style="max-height:300px; overflow-y:auto"></div>
          <div class="flex-between text-bold text-lg"><span>الإجمالي:</span><span class="mono" id="purTotal">${App.fmtMoney(0)}</span></div>
        </div>
      </div>

      <div class="card mt-4">
        <h4 class="text-bold mb-3">السداد</h4>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">طريقة الدفع</label>
            <select class="form-control" id="pMethod">
              <option value="cash">نقدي</option>
              <option value="bank">تحويل بنكي</option>
              <option value="credit">آجل</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">المبلغ المدفوع</label>
            <input type="number" step="0.01" min="0" class="form-control" id="pPaid" value="0">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">ملاحظات</label>
          <textarea class="form-control" id="pNotes" rows="2"></textarea>
        </div>
        <button class="btn btn-primary btn-block" id="pSave">حفظ فاتورة الشراء</button>
      </div>
    `;

    App.$('#pProduct', body).addEventListener('change', () => {
      const sel = App.$('#pProduct', body);
      const opt = sel.options[sel.selectedIndex];
      if (!opt || !opt.value) return;
      cart.push({
        productId: opt.value,
        name: opt.dataset.name,
        unit: opt.dataset.unit,
        unitCost: Number(opt.dataset.cost || 0),
        quantity: 1,
      });
      sel.value = '';
      drawItems();
    });

    function drawItems() {
      const wrap = App.$('#purItems', body);
      if (!cart.length) { wrap.innerHTML = '<p class="text-muted text-center">لم تتم إضافة أصناف.</p>'; }
      else {
        wrap.innerHTML = cart.map((it, idx) => `
          <div class="cart-item">
            <div>
              <div class="cart-item-name">${App.escapeHtml(it.name)}</div>
              <div style="display:flex; gap:6px; margin-top:6px; align-items:center">
                <input type="number" min="1" step="0.001" value="${it.quantity}" style="width:80px; padding:4px; border:1px solid var(--border); border-radius:6px" onchange="this.dataset.idx=${idx}; POS._setQty && 0; (function(e){cart[+e.target.dataset.idx].quantity=Number(e.target.value); drawItems();})(event)">
                <input type="number" min="0" step="0.01" value="${it.unitCost}" style="width:90px; padding:4px; border:1px solid var(--border); border-radius:6px" onchange="(function(e){cart[+e.target.dataset.idx].unitCost=Number(e.target.value); drawItems();})(event)" data-idx="${idx}">
                <span class="text-sm text-muted">${App.escapeHtml(it.unit || '')}</span>
              </div>
            </div>
            <div class="cart-item-total">${App.fmtMoney(it.quantity * it.unitCost)}</div>
            <button class="cart-item-remove" onclick="cart.splice(${idx},1); drawItems();">×</button>
          </div>
        `).join('');
      }
      const total = cart.reduce((s, it) => s + it.quantity * it.unitCost, 0);
      App.$('#purTotal', body).textContent = App.fmtMoney(total);
      body.dataset.total = total;
    }
    // Make cart and drawItems accessible
    body._cart = cart;
    body._drawItems = drawItems;
    // Override oninput handlers properly
    body.querySelectorAll('[onchange]').forEach(inp => {
      const code = inp.getAttribute('onchange');
      inp.removeAttribute('onchange');
      inp.addEventListener('change', (e) => {
        const idx = +e.target.dataset.idx;
        if (e.target.type === 'number') {
          if (e.target.min === '1' || e.target.step === '0.001') {
            cart[idx].quantity = Number(e.target.value);
          } else {
            cart[idx].unitCost = Number(e.target.value);
          }
        }
        drawItems();
      });
    });
    body.querySelectorAll('[onclick^="cart.splice"]').forEach(btn => {
      const idx = Number(btn.getAttribute('onclick').match(/splice\((\d+)/)?.[1] || 0);
      btn.removeAttribute('onclick');
      btn.addEventListener('click', () => { cart.splice(idx, 1); drawItems(); });
    });

    drawItems();

    App.$('#pSave', body).addEventListener('click', async () => {
      if (!cart.length) { App.toast.warn('أضف أصنافاً للفاتورة.'); return; }
      const supplierId = App.$('#pSupplier', body).value;
      const number = App.$('#pNumber', body).value;
      const date = App.$('#pDate', body).value;
      const method = App.$('#pMethod', body).value;
      const paid = Number(App.$('#pPaid', body).value || 0);
      const notes = App.$('#pNotes', body).value;
      const total = Number(body.dataset.total);
      if (!supplierId) { App.toast.warn('اختر المورد.'); return; }
      try {
        await DB.transaction(['purchases', 'purchaseItems', 'products', 'inventoryMoves', 'suppliers'], async (h) => {
          const id = DB.uid('pur');
          const dateISO = new Date(date).toISOString();
          for (const it of cart) {
            const p = await new Promise(res => { const r = h.products.get(it.productId); r.onsuccess = () => res(r.result); });
            if (!p) continue;
            const before = Number(p.quantity || 0);
            const after = before + it.quantity;
            // Update purchase cost (weighted average)
            const oldTotalCost = Number(p.purchasePrice || 0) * before;
            const newTotalCost = oldTotalCost + (it.unitCost * it.quantity);
            const newCost = (before + it.quantity) > 0 ? newTotalCost / (before + it.quantity) : it.unitCost;
            p.purchasePrice = App.settings.weightedAvgCost ? newCost : it.unitCost;
            p.quantity = after;
            p.updatedAt = dateISO;
            h.products.put(p);
            h.purchaseItems.put({
              id: DB.uid('pit'),
              purchaseId: id,
              productId: it.productId,
              name: it.name,
              unit: it.unit,
              quantity: it.quantity,
              unitCost: it.unitCost,
              total: it.quantity * it.unitCost,
            });
            h.inventoryMoves.put({
              id: DB.uid('mv'),
              productId: it.productId,
              date: dateISO,
              type: 'purchase',
              qtyBefore: before,
              qtyChange: it.quantity,
              qtyAfter: after,
              reason: `شراء فاتورة ${number}`,
              source: 'purchase',
              ref: id,
              unitCost: it.unitCost,
              notes: '',
            });
          }
          const purchase = {
            id, number, date: dateISO, supplierId,
            items: cart,
            subtotal: total, discount: 0, tax: 0,
            total, paid, remaining: total - paid,
            method, notes,
            createdAt: dateISO,
          };
          h.purchases.put(purchase);
          // Update supplier balance
          const s = await new Promise(res => { const r = h.suppliers.get(supplierId); r.onsuccess = () => res(r.result); });
          if (s) {
            s.balance = Number(s.balance || 0) + (total - paid);
            s.updatedAt = dateISO;
            h.suppliers.put(s);
          }
        });
        App.toast.success('تم حفظ فاتورة الشراء.');
        view.tab = 'invoices';
        drawContent();
        App.refreshAlertsBadge();
      } catch (e) { App.toast.error(e.message); }
    });

    c.innerHTML = '';
    c.appendChild(body);
  }

  async function paySupplier(purchaseId) {
    const p = await DB.get('purchases', purchaseId);
    if (!p || p.remaining <= 0.001) return;
    const body = App.el('div', {}, []);
    body.innerHTML = `
      <div class="card mb-4">
        <div class="flex-between"><span class="text-muted">الفاتورة</span><span class="mono">${p.number}</span></div>
        <div class="flex-between"><span class="text-muted">الإجمالي</span><span class="mono">${App.fmtMoney(p.total)}</span></div>
        <div class="flex-between"><span class="text-muted">المدفوع</span><span class="mono">${App.fmtMoney(p.paid)}</span></div>
        <div class="flex-between text-bold text-lg"><span>المتبقي</span><span style="color:var(--red-600)">${App.fmtMoney(p.remaining)}</span></div>
      </div>
      <div class="form-group">
        <label class="form-label">المبلغ</label>
        <input type="number" step="0.01" min="0.01" max="${p.remaining.toFixed(2)}" class="form-control" id="supAmt" value="${p.remaining.toFixed(2)}">
      </div>
    `;
    const footer = [
      App.el('button', { class: 'btn btn-secondary', onclick: () => m.close() }, ['إلغاء']),
      App.el('button', { class: 'btn btn-success', onclick: save }, ['تأكيد']),
    ];
    const m = App.modal({ title: 'سداد للمورد', body, footer, size: 'sm' });

    async function save() {
      const amt = Number(App.$('#supAmt', body).value || 0);
      if (amt <= 0 || amt > p.remaining + 0.01) { App.toast.error('المبلغ غير صالح.'); return; }
      try {
        await DB.transaction(['purchases', 'suppliers'], async (h) => {
          const cur = await new Promise(res => { const r = h.purchases.get(purchaseId); r.onsuccess = () => res(r.result); });
          cur.paid = Number(cur.paid) + amt;
          cur.remaining = Math.max(0, cur.total - cur.paid);
          cur.updatedAt = new Date().toISOString();
          h.purchases.put(cur);
          if (cur.supplierId) {
            const s = await new Promise(res => { const r = h.suppliers.get(cur.supplierId); r.onsuccess = () => res(r.result); });
            if (s) {
              s.balance = Math.max(0, Number(s.balance || 0) - amt);
              s.updatedAt = new Date().toISOString();
              h.suppliers.put(s);
            }
          }
        });
        App.toast.success('تم تسجيل السداد.');
        m.close();
        drawContent();
        App.refreshAlertsBadge();
      } catch (e) { App.toast.error(e.message); }
    }
  }

  return { render };
})();

/* =========================================================================
   suppliers.js — Supplier management
   ========================================================================= */

Suppliers = (() => {
  async function render(container) {
    const suppliers = await DB.getAll('suppliers');
    container.innerHTML = `
      <div class="toolbar">
        <div class="spacer"></div>
        <button class="btn btn-primary btn-sm" onclick="Suppliers._openForm()">+ مورد جديد</button>
        <button class="btn btn-secondary btn-sm" onclick="ImportExport.exportSuppliers()">تصدير Excel</button>
      </div>
      <div class="table-wrap">
        <div class="table-scroll">
          <table class="data">
            <thead><tr><th>الاسم</th><th>الهاتف</th><th>العنوان</th><th class="num">الرصيد المستحق</th><th class="center">إجراءات</th></tr></thead>
            <tbody>
              ${suppliers.length ? suppliers.map(s => `<tr>
                <td class="text-bold">${App.escapeHtml(s.name)}</td>
                <td class="mono">${App.escapeHtml(s.phone || '—')}</td>
                <td>${App.escapeHtml(s.address || '—')}</td>
                <td class="num mono" style="color:${s.balance > 0 ? 'var(--red-600)' : 'inherit'}">${App.fmtMoney(s.balance)}</td>
                <td class="center">
                  <button class="icon-btn" data-edit="${s.id}"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                  <button class="icon-btn" data-del="${s.id}"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                </td>
              </tr>`).join('') : '<tr><td colspan="5" class="text-center text-muted">لا يوجد موردون.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
    container.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openForm(b.dataset.edit)));
    container.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => onDelete(b.dataset.del)));
  }

  async function openForm(id) {
    const s = id ? await DB.get('suppliers', id) : null;
    const body = App.el('div', {}, []);
    body.innerHTML = `
      <div class="form-group">
        <label class="form-label">الاسم <span class="req">*</span></label>
        <input class="form-control" id="s_name" value="${App.escapeHtml(s?.name || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">الهاتف</label>
        <input class="form-control" id="s_phone" value="${App.escapeHtml(s?.phone || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">العنوان</label>
        <textarea class="form-control" id="s_address" rows="2">${App.escapeHtml(s?.address || '')}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">ملاحظات</label>
        <textarea class="form-control" id="s_notes" rows="2">${App.escapeHtml(s?.notes || '')}</textarea>
      </div>
    `;
    const footer = [
      App.el('button', { class: 'btn btn-secondary', onclick: () => m.close() }, ['إلغاء']),
      App.el('button', { class: 'btn btn-primary', onclick: save }, [s ? 'حفظ' : 'إضافة']),
    ];
    const m = App.modal({ title: s ? 'تعديل مورد' : 'مورد جديد', body, footer, size: 'sm' });

    async function save() {
      const name = App.$('#s_name', body).value.trim();
      if (!name) { App.toast.warn('الاسم مطلوب.'); return; }
      const obj = {
        id: s?.id || DB.uid('sup'),
        name,
        phone: App.$('#s_phone', body).value,
        address: App.$('#s_address', body).value,
        notes: App.$('#s_notes', body).value,
        balance: s?.balance || 0,
        createdAt: s?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await DB.put('suppliers', obj);
      App.toast.success(s ? 'تم حفظ التعديلات.' : 'تمت إضافة المورد.');
      m.close();
      App.navigate('suppliers');
    }
  }

  async function onDelete(id) {
    App.confirm({
      title: 'حذف المورد',
      message: 'هل تريد حذف هذا المورد؟',
      onConfirm: async () => {
        await DB.remove('suppliers', id);
        App.toast.success('تم الحذف.');
        App.navigate('suppliers');
      },
    });
  }

  return { render, _openForm: openForm };
})();
