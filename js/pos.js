/* =========================================================================
   pos.js — Point of Sale
   Product search, cart, checkout, payments, stock deduction.
   ========================================================================= */

POS = (() => {
  let cart = []; // [{ productId, name, sku, unit, unitPrice, cost, quantity, discount, tax }]
  let selectedCustomer = null;

  async function render(container) {
    cart = [];
    selectedCustomer = null;
    container.innerHTML = `
      <div class="pos-layout">
        <div class="pos-products">
          <div class="toolbar" style="margin-bottom:8px">
            <div class="search-input" style="flex:1">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input class="form-control" id="posSearch" placeholder="ابحث بالاسم أو الرمز أو الباركود — أو امسح الباركود" autocomplete="off">
            </div>
            <select class="form-control" id="posCategory" style="max-width:160px">
              <option value="">كل الفئات</option>
            </select>
          </div>
          <div class="product-grid" id="productGrid"></div>
        </div>
        <aside class="cart" id="cartPanel"></aside>
      </div>
    `;

    const search = App.$('#posSearch', container);
    search.addEventListener('input', App.debounce(() => drawProducts(), 200));
    App.$('#posCategory', container).addEventListener('change', drawProducts);
    search.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const code = search.value.trim();
        if (code) findAndAddByCode(code);
      }
    });

    await drawProducts();
    drawCart();
  }

  async function drawProducts() {
    const grid = document.getElementById('productGrid');
    if (!grid) return;
    const search = document.getElementById('posSearch');
    const q = (search?.value || '').toLowerCase().trim();
    const cat = document.getElementById('posCategory')?.value || '';

    let products = await DB.getAll('products');
    products = products.filter(p => !p.archived);

    // Populate categories
    const catSel = document.getElementById('posCategory');
    if (catSel) {
      const cur = catSel.value;
      const cats = [...new Set(products.map(p => p.category).filter(Boolean))].sort();
      catSel.innerHTML = '<option value="">كل الفئات</option>' + cats.map(c => `<option value="${App.escapeHtml(c)}" ${c === cur ? 'selected' : ''}>${App.escapeHtml(c)}</option>`).join('');
    }

    if (q) {
      products = products.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q)
      );
    }
    if (cat) products = products.filter(p => p.category === cat);

    products = products.slice(0, 60);

    if (!products.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><h3>لا توجد منتجات مطابقة</h3></div>`;
      return;
    }

    grid.innerHTML = products.map(p => {
      const qty = Number(p.quantity || 0);
      const out = qty <= 0;
      return `<div class="product-card ${out ? 'out-of-stock' : ''}" data-pid="${p.id}">
        ${out ? '<span class="chip chip-danger pc-badge">نفذ</span>' : (qty <= (p.minStock || 0) ? '<span class="chip chip-warning pc-badge">منخفض</span>' : '')}
        <div class="pc-name">${App.escapeHtml(p.name)}</div>
        <div class="pc-price">${App.fmtMoney(p.sellingPrice)}</div>
        <div class="pc-stock">المخزون: ${App.fmtNumber(qty)} ${App.escapeHtml(p.unit || '')}</div>
      </div>`;
    }).join('');

    grid.querySelectorAll('.product-card').forEach(card => {
      card.addEventListener('click', () => addToCart(card.dataset.pid));
    });
  }

  async function findAndAddByCode(code) {
    const products = await DB.getAll('products');
    const p = products.find(x => !x.archived && (x.sku?.toLowerCase() === code.toLowerCase() || x.barcode === code));
    if (!p) { App.toast.warn('لم يتم العثور على منتج بهذا الرمز.'); return; }
    addToCart(p.id);
    document.getElementById('posSearch').value = '';
    drawProducts();
  }

  async function addToCart(pid) {
    const p = await DB.get('products', pid);
    if (!p) return;
    const qty = Number(p.quantity || 0);
    const allowNeg = App.settings.allowNegativeStock;
    if (qty <= 0 && !allowNeg) {
      App.toast.warn('المنتج غير متوفر في المخزون.');
      return;
    }
    const existing = cart.find(i => i.productId === pid);
    if (existing) {
      if (!allowNeg && existing.quantity + 1 > qty) {
        App.toast.warn('لا يمكن بيع كمية أكبر من المخزون المتاح.');
        return;
      }
      existing.quantity += 1;
    } else {
      cart.push({
        productId: p.id,
        name: p.name,
        sku: p.sku,
        unit: p.unit,
        unitPrice: Number(p.sellingPrice || 0),
        cost: Number(p.purchasePrice || 0),
        quantity: 1,
        discount: 0,
        tax: 0,
      });
    }
    drawCart();
  }

  function changeQty(pid, delta) {
    const it = cart.find(i => i.productId === pid);
    if (!it) return;
    const newQty = it.quantity + delta;
    if (newQty <= 0) { cart = cart.filter(i => i.productId !== pid); }
    else {
      const allowNeg = App.settings.allowNegativeStock;
      if (delta > 0 && !allowNeg) {
        DB.get('products', pid).then(p => {
          if (newQty > Number(p.quantity || 0)) {
            App.toast.warn(`الكمية المتاحة: ${p.quantity} ${p.unit || ''}`);
            return;
          }
          it.quantity = newQty;
          drawCart();
        });
        return;
      }
      it.quantity = newQty;
    }
    drawCart();
  }

  function setQty(pid, val) {
    const it = cart.find(i => i.productId === pid);
    if (!it) return;
    const n = Number(val);
    if (isNaN(n) || n <= 0) { cart = cart.filter(i => i.productId !== pid); drawCart(); return; }
    it.quantity = n;
    drawCart();
  }

  function setPrice(pid, val) {
    const it = cart.find(i => i.productId === pid);
    if (!it) return;
    it.unitPrice = Number(val) || 0;
    drawCart();
  }

  function setDiscount(pid, val) {
    const it = cart.find(i => i.productId === pid);
    if (!it) return;
    it.discount = Number(val) || 0;
    drawCart();
  }

  function removeItem(pid) {
    cart = cart.filter(i => i.productId !== pid);
    drawCart();
  }

  function clearCart() {
    cart = [];
    selectedCustomer = null;
    drawCart();
  }

  function calcTotals() {
    let subtotal = 0, lineDiscounts = 0, lineTax = 0;
    cart.forEach(it => {
      const gross = it.unitPrice * it.quantity;
      const net = gross - (it.discount || 0);
      subtotal += net;
      lineDiscounts += it.discount || 0;
      if (it.tax) lineTax += net * it.tax / 100;
    });
    return { subtotal, lineDiscounts, lineTax };
  }

  function drawCart() {
    const panel = document.getElementById('cartPanel');
    if (!panel) return;
    if (!cart.length) {
      panel.innerHTML = `
        <div class="cart-title"><span>السلة</span><button class="icon-btn" onclick="POS._clearCart()" title="تفريغ"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button></div>
        <div class="empty-state">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          <h3>السلة فارغة</h3>
          <p>اضغط على منتج أو امسح الباركود لإضافته.</p>
        </div>
      `;
      return;
    }

    const { subtotal, lineDiscounts, lineTax } = calcTotals();
    const taxRate = Number(App.settings.taxRate || 0);
    const overallDiscount = Number(panel.dataset.overallDiscount || 0);
    const taxAmt = App.settings.taxInclusive ? 0 : (subtotal - overallDiscount) * taxRate / 100;
    const total = subtotal - overallDiscount + taxAmt + lineTax;

    panel.dataset.total = total;
    panel.innerHTML = `
      <div class="cart-title">
        <span>السلة (${cart.length})</span>
        <button class="icon-btn" onclick="POS._clearCart()" title="تفريغ"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>
      </div>

      <div class="cart-items">
        ${cart.map(it => `
          <div class="cart-item">
            <div>
              <div class="cart-item-name">${App.escapeHtml(it.name)}</div>
              <div class="cart-item-code mono">${App.escapeHtml(it.sku)} · ${App.fmtMoney(it.unitPrice)}</div>
              <div class="qty-control" style="margin-top:6px">
                <button onclick="POS._changeQty('${it.productId}', -1)">−</button>
                <input type="number" min="1" step="1" value="${it.quantity}" onchange="POS._setQty('${it.productId}', this.value)">
                <button onclick="POS._changeQty('${it.productId}', 1)">+</button>
              </div>
              <input type="number" min="0" step="0.01" value="${it.discount}" placeholder="خصم السطر" style="width:100%; margin-top:6px; padding:4px 8px; border:1px solid var(--border); border-radius:6px; font-size:12px" onchange="POS._setDiscount('${it.productId}', this.value)">
            </div>
            <div class="cart-item-total">${App.fmtMoney(it.unitPrice * it.quantity - (it.discount || 0))}</div>
            <button class="cart-item-remove" onclick="POS._removeItem('${it.productId}')" title="حذف"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
        `).join('')}
      </div>

      <div class="cart-summary">
        <div class="line"><span>الإجمالي الفرعي</span><span class="mono">${App.fmtMoney(subtotal)}</span></div>
        ${lineDiscounts > 0 ? `<div class="line"><span>خصم الأصناف</span><span class="mono">− ${App.fmtMoney(lineDiscounts)}</span></div>` : ''}
        <div class="line">
          <span>خصم إجمالي</span>
          <input type="number" min="0" step="0.01" value="${overallDiscount}" style="width:100px; padding:2px 6px; border:1px solid var(--border); border-radius:6px; text-align:left" onchange="POS._setOverallDiscount(this.value)">
        </div>
        ${taxRate > 0 ? `<div class="line"><span>ضريبة (${taxRate}%)</span><span class="mono">${App.fmtMoney(taxAmt)}</span></div>` : ''}
        <div class="line total"><span>الإجمالي</span><span>${App.fmtMoney(total)}</span></div>
      </div>

      <div class="cart-actions">
        <button class="btn btn-secondary" onclick="POS._selectCustomer()">العميل: ${selectedCustomer ? App.escapeHtml(selectedCustomer.name) : 'نقدي'}</button>
        <button class="btn btn-primary" onclick="POS._checkout()">إتمام البيع</button>
      </div>
    `;
  }

  function setOverallDiscount(val) {
    const panel = document.getElementById('cartPanel');
    if (!panel) return;
    panel.dataset.overallDiscount = Number(val) || 0;
    drawCart();
  }

  async function selectCustomer() {
    const customers = await DB.getAll('customers');
    const body = App.el('div', {}, []);
    body.innerHTML = `
      <div class="search-input mb-3">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input class="form-control" id="custSearch" placeholder="بحث بالاسم أو الهاتف" oninput="this.nextElementSibling.querySelectorAll('div').forEach(d=>{d.style.display=d.textContent.toLowerCase().includes(this.value.toLowerCase())?'block':'none'})">
      </div>
      <div style="max-height:300px; overflow-y:auto">
        ${customers.length ? customers.map(c => `<div class="cart-item" style="cursor:pointer; padding:10px" onclick="POS._setCustomer('${c.id}'); App.closeModal()">
          <div><div class="text-bold">${App.escapeHtml(c.name)}</div><div class="text-sm text-muted">${App.escapeHtml(c.phone || '')}</div></div>
          ${c.balance > 0 ? `<span class="chip chip-warning">مستحق: ${App.fmtMoney(c.balance)}</span>` : ''}
        </div>`).join('') : '<p class="text-muted text-center">لا يوجد عملاء مسجلون.</p>'}
      </div>
      <hr class="section-divider">
      <button class="btn btn-secondary btn-block" onclick="POS._newCustomer()">إضافة عميل جديد</button>
    `;
    App.modal({ title: 'اختيار العميل', body, size: 'sm' });
  }

  async function setCustomer(id) {
    selectedCustomer = id ? await DB.get('customers', id) : null;
    drawCart();
  }

  async function newCustomer() {
    App.closeModal();
    if (window.Customers) Customers.openForm();
  }

  async function checkout() {
    if (!cart.length) { App.toast.warn('السلة فارغة.'); return; }
    const panel = document.getElementById('cartPanel');
    const total = Number(panel.dataset.total || 0);
    const taxRate = Number(App.settings.taxRate || 0);
    const overallDiscount = Number(panel.dataset.overallDiscount || 0);
    const { subtotal, lineDiscounts, lineTax } = calcTotals();
    const taxAmt = App.settings.taxInclusive ? 0 : (subtotal - overallDiscount) * taxRate / 100;

    const body = App.el('div', {}, []);
    body.innerHTML = `
      <div class="card mb-4">
        <div class="flex-between"><span class="text-muted">الإجمالي الفرعي</span><span class="mono">${App.fmtMoney(subtotal)}</span></div>
        ${overallDiscount > 0 ? `<div class="flex-between"><span class="text-muted">خصم</span><span class="mono">− ${App.fmtMoney(overallDiscount)}</span></div>` : ''}
        ${taxRate > 0 ? `<div class="flex-between"><span class="text-muted">ضريبة (${taxRate}%)</span><span class="mono">${App.fmtMoney(taxAmt)}</span></div>` : ''}
        <hr class="section-divider">
        <div class="flex-between text-xl text-bold"><span>الإجمالي</span><span style="color:var(--primary)">${App.fmtMoney(total)}</span></div>
      </div>

      <div class="form-group">
        <label class="form-label">طريقة الدفع</label>
        <select class="form-control" id="payMethod">
          <option value="cash" ${App.settings.defaultPaymentMethod === 'cash' ? 'selected' : ''}>نقدي</option>
          <option value="vodafone_cash" ${App.settings.defaultPaymentMethod === 'vodafone_cash' ? 'selected' : ''}>فودافون كاش</option>
          <option value="instapay" ${App.settings.defaultPaymentMethod === 'instapay' ? 'selected' : ''}>إنستا باي</option>
          <option value="bank" ${App.settings.defaultPaymentMethod === 'bank' ? 'selected' : ''}>تحويل بنكي</option>
          <option value="credit" ${App.settings.defaultPaymentMethod === 'credit' ? 'selected' : ''}>آجل</option>
          <option value="other">أخرى</option>
        </select>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">المبلغ المدفوع</label>
          <input type="number" step="0.01" min="0" class="form-control" id="payAmount" value="${total.toFixed(2)}" oninput="POS._updateRemaining()">
          ${selectedCustomer && selectedCustomer.balance > 0 ? `<div class="form-hint" style="color:var(--amber-600)">رصيد سابق مستحق: ${App.fmtMoney(selectedCustomer.balance)}</div>` : ''}
        </div>
        <div class="form-group">
          <label class="form-label">المتبقي / الصرف</label>
          <input type="text" class="form-control" id="payRemaining" readonly value="0.00">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">ملاحظات</label>
        <textarea class="form-control" id="payNotes" rows="2"></textarea>
      </div>

      <div class="form-group">
        <label class="form-label"><input type="checkbox" class="form-check" id="chkPrint"> طباعة الفاتورة بعد الحفظ</label>
      </div>
    `;

    const footer = [
      App.el('button', { class: 'btn btn-secondary', onclick: () => m.close() }, ['إلغاء']),
      App.el('button', { class: 'btn btn-success', onclick: () => doSale() }, ['تأكيد البيع']),
    ];

    const m = App.modal({ title: 'إتمام البيع', body, footer, size: 'sm' });

    async function doSale() {
      const method = App.$('#payMethod', body).value;
      const paid = Number(App.$('#payAmount', body).value || 0);
      const notes = App.$('#payNotes', body).value;
      const print = App.$('#chkPrint', body).checked;
      const isCredit = method === 'credit';
      const finalPaid = isCredit ? paid : Math.min(paid, total);
      const remaining = total - finalPaid;
      const change = (paid - total > 0) ? (paid - total) : 0;

      if (!isCredit && paid < 0) { App.toast.error('المبلغ المدفوع غير صالح.'); return; }

      try {
        const invoice = await finalizeSale({
          cart, customer: selectedCustomer,
          subtotal, lineDiscounts, overallDiscount,
          tax: taxAmt, total,
          paid: finalPaid, remaining, change,
          method, notes,
        });
        App.toast.success(`تم إنشاء الفاتورة ${invoice.number}.`);
        m.close();
        if (print && window.Invoices) {
          Invoices.printInvoice(invoice.id);
        }
        clearCart();
        App.refreshAlertsBadge();
        // Reload POS
        App.navigate('pos');
      } catch (e) {
        console.error(e);
        App.toast.error(e.message);
      }
    }
  }

  async function finalizeSale({ cart, customer, subtotal, lineDiscounts, overallDiscount, tax, total, paid, remaining, change, method, notes }) {
    const number = await DB.consumeInvoiceNumber();
    const invoiceId = DB.uid('inv');
    const dateISO = new Date().toISOString();

    // Get latest product states
    const products = await DB.getAll('products');
    const pMap = new Map(products.map(p => [p.id, p]));

    return DB.transaction(['products', 'invoices', 'invoiceItems', 'payments', 'customers', 'inventoryMoves'], async (h) => {
      // Validate stock
      for (const it of cart) {
        const p = pMap.get(it.productId);
        if (!p) throw new Error('منتج غير موجود: ' + it.name);
        if (!App.settings.allowNegativeStock && it.quantity > Number(p.quantity || 0)) {
          throw new Error(`الكمية المطلوبة من "${p.name}" أكبر من المخزون.`);
        }
      }

      // Snapshot items & deduct stock
      const items = [];
      for (const it of cart) {
        const p = pMap.get(it.productId);
        const before = Number(p.quantity || 0);
        const after = before - it.quantity;
        p.quantity = after;
        p.updatedAt = dateISO;
        h.products.put(p);
        const lineTotal = it.unitPrice * it.quantity - (it.discount || 0);
        const itemSnap = {
          id: DB.uid('it'),
          invoiceId,
          productId: it.productId,
          sku: p.sku,
          name: p.name,
          unit: p.unit,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          cost: Number(p.purchasePrice || 0),
          discount: it.discount || 0,
          tax: 0,
          total: lineTotal,
        };
        items.push(itemSnap);
        h.invoiceItems.put(itemSnap);
        h.inventoryMoves.put({
          id: DB.uid('mv'),
          productId: it.productId,
          date: dateISO,
          type: 'sale',
          qtyBefore: before,
          qtyChange: -it.quantity,
          qtyAfter: after,
          reason: `بيع فاتورة ${number}`,
          source: 'sale',
          ref: invoiceId,
          unitCost: p.purchasePrice,
          notes: '',
        });
      }

      // Invoice snapshot (immutable)
      const invoice = {
        id: invoiceId,
        number,
        date: dateISO,
        customerId: customer?.id || null,
        customerName: customer?.name || 'عميل نقدي',
        customerPhone: customer?.phone || '',
        items: items.map(i => ({ ...i })),
        subtotal,
        lineDiscounts,
        discount: overallDiscount,
        tax,
        total,
        paid,
        remaining,
        change,
        paymentMethod: method,
        status: remaining > 0.001 ? (paid > 0.001 ? 'partial' : 'unpaid') : 'paid',
        notes,
        returns: [],
        returnAmount: 0,
        createdAt: dateISO,
        updatedAt: dateISO,
      };
      h.invoices.put(invoice);

      // Payment record
      const payment = {
        id: DB.uid('pay'),
        invoiceId,
        customerId: customer?.id || null,
        date: dateISO,
        amount: paid,
        method,
        notes,
      };
      h.payments.put(payment);

      // Update customer balance
      if (customer) {
        const c = await new Promise(res => {
          const r = h.customers.get(customer.id);
          r.onsuccess = () => res(r.result);
        });
        if (c) {
          c.totalPurchases = Number(c.totalPurchases || 0) + total;
          c.totalPaid = Number(c.totalPaid || 0) + paid;
          c.balance = Number(c.balance || 0) + remaining;
          c.updatedAt = dateISO;
          h.customers.put(c);
        }
      }
      return invoice;
    });
  }

  function updateRemaining() {
    const total = Number(document.getElementById('cartPanel')?.dataset.total || 0);
    const paid = Number(document.getElementById('payAmount')?.value || 0);
    const rem = total - paid;
    const remEl = document.getElementById('payRemaining');
    if (remEl) {
      remEl.value = (rem >= 0 ? rem : 0).toFixed(2) + (rem < 0 ? ` (صرف: ${Math.abs(rem).toFixed(2)})` : '');
      remEl.style.color = rem > 0 ? 'var(--red-600)' : 'var(--green-600)';
    }
  }

  // Expose internal handlers for inline onclick
  return {
    render,
    _changeQty: changeQty,
    _setQty: setQty,
    _setPrice: setPrice,
    _setDiscount: setDiscount,
    _removeItem: removeItem,
    _clearCart: clearCart,
    _selectCustomer: selectCustomer,
    _setCustomer: setCustomer,
    _newCustomer: newCustomer,
    _checkout: checkout,
    _setOverallDiscount: setOverallDiscount,
    _updateRemaining: updateRemaining,
  };
})();
