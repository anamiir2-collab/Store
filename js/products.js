/* =========================================================================
   products.js — Product management
   Full CRUD, search, filter, sort, paginate, archive, low-stock detection
   ========================================================================= */

Products = (() => {
  let listView = { search: '', category: '', stock: 'all', sort: 'name', sortDir: 'asc', page: 1, perPage: 12 };

  function normalizeProduct(p) {
    return {
      id: p.id || DB.uid('prod'),
      sku: (p.sku || '').trim(),
      name: (p.name || '').trim(),
      category: (p.category || '').trim(),
      barcode: (p.barcode || '').trim(),
      purchasePrice: Number(p.purchasePrice || 0),
      sellingPrice: Number(p.sellingPrice || 0),
      quantity: Number(p.quantity || 0),
      minStock: Number(p.minStock ?? App.settings.defaultMinStock ?? 5),
      unit: p.unit || 'قطعة',
      expirationDate: p.expirationDate || null,
      supplierId: p.supplierId || null,
      notes: p.notes || '',
      costMethod: p.costMethod || 'weighted', // weighted | last | fixed
      archived: !!p.archived,
      createdAt: p.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async function saveProduct(p) {
    const n = normalizeProduct(p);
    if (!n.name) throw new Error('اسم المنتج مطلوب.');
    if (!n.sku) throw new Error('رمز المنتج (SKU) مطلوب.');
    // Validate unique SKU
    const existing = await DB.query('products', x => x.sku.toLowerCase() === n.sku.toLowerCase() && x.id !== n.id);
    if (existing.length) throw new Error('رمز المنتج (SKU) مستخدم مسبقاً.');
    if (n.sellingPrice < 0 || n.purchasePrice < 0) throw new Error('السعر لا يمكن أن يكون سالباً.');
    if (n.quantity < 0) throw new Error('الكمية لا يمكن أن تكون سالبة.');

    const isNew = !(await DB.get('products', n.id));
    if (isNew && n.quantity > 0) {
      // Opening stock movement
      await DB.transaction(['products', 'inventoryMoves'], async (h) => {
        h.products.put(n);
        const move = {
          id: DB.uid('mv'),
          productId: n.id,
          date: new Date().toISOString(),
          type: 'opening',
          qtyBefore: 0,
          qtyChange: n.quantity,
          qtyAfter: n.quantity,
          reason: 'رصيد افتتاحي',
          source: 'manual',
          ref: null,
          unitCost: n.purchasePrice,
          notes: '',
        };
        h.inventoryMoves.put(move);
      });
    } else {
      await DB.put('products', n);
    }
    return n;
  }

  async function deleteProduct(id) {
    // Check if used in any invoice
    const used = await DB.query('invoiceItems', x => x.productId === id);
    if (used.length) {
      // Archive instead
      const p = await DB.get('products', id);
      if (p) { p.archived = true; p.updatedAt = new Date().toISOString(); await DB.put('products', p); }
      throw new Error('لا يمكن حذف المنتج لاستخدامه في فواتير. تمت أرشفته بدلاً من ذلك.');
    }
    await DB.remove('products', id);
  }

  function getCategories(products) {
    const set = new Set();
    products.forEach(p => { if (p.category) set.add(p.category); });
    return Array.from(set).sort();
  }

  function stockStatus(p) {
    const qty = Number(p.quantity || 0);
    const min = Number(p.minStock ?? 0);
    if (qty <= 0) return { label: 'نفذ', cls: 'danger' };
    if (qty <= min) return { label: 'منخفض', cls: 'warning' };
    return { label: 'متوفر', cls: 'success' };
  }

  function expirationStatus(p) {
    if (!p.expirationDate) return null;
    const d = new Date(p.expirationDate);
    if (isNaN(d.getTime())) return null;
    const days = Math.ceil((d - Date.now()) / 86400000);
    const warn = App.settings.expirationWarningDays ?? 14;
    if (days < 0) return { label: 'منتهي', cls: 'danger', days };
    if (days <= warn) return { label: `خلال ${days} يوم`, cls: 'warning', days };
    return null;
  }

  /* ----- Render ----- */
  async function render(container) {
    listView.page = 1;
    await draw(container);
  }

  async function draw(container) {
    container.innerHTML = `
      <div class="toolbar">
        <div class="search-input">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input class="form-control" id="prodSearch" placeholder="بحث بالاسم أو الرمز أو الباركود…" value="${App.escapeHtml(listView.search)}">
        </div>
        <select class="form-control" id="prodCategory" style="max-width:180px">
          <option value="">كل الفئات</option>
        </select>
        <select class="form-control" id="prodStock" style="max-width:140px">
          <option value="all">كل الحالات</option>
          <option value="in">متوفر</option>
          <option value="low">منخفض</option>
          <option value="out">نفذ</option>
          <option value="expiring">قرب الانتهاء</option>
          <option value="expired">منتهي</option>
        </select>
        <div class="spacer"></div>
        <button class="btn btn-secondary btn-sm" id="btnImport"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> استيراد Excel</button>
        <button class="btn btn-secondary btn-sm" id="btnExport"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> تصدير Excel</button>
        <button class="btn btn-primary btn-sm" id="btnAddProduct"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> منتج جديد</button>
      </div>
      <div id="productsTable"></div>
    `;

    // Bind events
    const search = App.$('#prodSearch', container);
    search.addEventListener('input', App.debounce(() => {
      listView.search = search.value.trim();
      listView.page = 1;
      drawTable();
    }, 250));
    App.$('#prodCategory', container).addEventListener('change', (e) => {
      listView.category = e.target.value; listView.page = 1; drawTable();
    });
    App.$('#prodStock', container).addEventListener('change', (e) => {
      listView.stock = e.target.value; listView.page = 1; drawTable();
    });
    App.$('#btnAddProduct', container).addEventListener('click', () => openProductForm());
    App.$('#btnImport', container).addEventListener('click', () => App.navigate('settings'));
    App.$('#btnExport', container).addEventListener('click', () => {
      if (window.ImportExport) ImportExport.exportProducts();
    });

    await drawTable();
  }

  async function drawTable() {
    const wrap = document.getElementById('productsTable');
    if (!wrap) return;
    let products = await DB.getAll('products');

    // Populate categories
    const cats = getCategories(products);
    const sel = document.getElementById('prodCategory');
    const cur = listView.category;
    sel.innerHTML = '<option value="">كل الفئات</option>' + cats.map(c => `<option value="${App.escapeHtml(c)}" ${c === cur ? 'selected' : ''}>${App.escapeHtml(c)}</option>`).join('');

    // Filter
    const q = listView.search.toLowerCase();
    products = products.filter(p => {
      if (p.archived) return false;
      if (q && !(p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q) || p.barcode?.toLowerCase().includes(q))) return false;
      if (listView.category && p.category !== listView.category) return false;
      const ss = stockStatus(p);
      const es = expirationStatus(p);
      if (listView.stock === 'in' && ss.cls !== 'success') return false;
      if (listView.stock === 'low' && ss.cls !== 'warning') return false;
      if (listView.stock === 'out' && ss.cls !== 'danger') return false;
      if (listView.stock === 'expiring' && !(es && es.cls === 'warning')) return false;
      if (listView.stock === 'expired' && !(es && es.cls === 'danger')) return false;
      return true;
    });

    // Sort
    const dir = listView.sortDir === 'asc' ? 1 : -1;
    products.sort((a, b) => {
      let av, bv;
      switch (listView.sort) {
        case 'sku': av = a.sku; bv = b.sku; break;
        case 'price': av = a.sellingPrice; bv = b.sellingPrice; break;
        case 'stock': av = a.quantity; bv = b.quantity; break;
        case 'category': av = a.category; bv = b.category; break;
        default: av = a.name; bv = b.name;
      }
      if (typeof av === 'number') return (av - bv) * dir;
      return String(av || '').localeCompare(String(bv || ''), 'ar') * dir;
    });

    // Paginate
    const total = products.length;
    const perPage = listView.perPage;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    if (listView.page > totalPages) listView.page = totalPages;
    const start = (listView.page - 1) * perPage;
    const pageItems = products.slice(start, start + perPage);

    if (total === 0) {
      wrap.innerHTML = `<div class="empty-state">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
        <h3>لا توجد منتجات</h3>
        <p>ابدأ بإضافة منتج جديد أو استيراد قائمة من Excel.</p>
      </div>`;
      return;
    }

    const sortClass = (k) => `sortable ${listView.sort === k ? (listView.sortDir === 'asc' ? 'sort-asc' : 'sort-desc') : ''}`;
    wrap.innerHTML = `
      <div class="table-wrap">
        <div class="table-scroll">
          <table class="data">
            <thead>
              <tr>
                <th class="${sortClass('sku')}" data-sort="sku">الرمز</th>
                <th class="${sortClass('name')}" data-sort="name">المنتج</th>
                <th class="${sortClass('category')}" data-sort="category">الفئة</th>
                <th class="num ${sortClass('price')}" data-sort="price">السعر</th>
                <th class="num ${sortClass('stock')}" data-sort="stock">المخزون</th>
                <th>الحالة</th>
                <th>الانتهاء</th>
                <th class="center">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              ${pageItems.map(p => {
                const ss = stockStatus(p);
                const es = expirationStatus(p);
                return `<tr>
                  <td class="mono">${App.escapeHtml(p.sku)}</td>
                  <td><div class="text-bold">${App.escapeHtml(p.name)}</div>${p.barcode ? `<div class="text-sm text-muted">${App.escapeHtml(p.barcode)}</div>` : ''}</td>
                  <td>${App.escapeHtml(p.category) || '—'}</td>
                  <td class="num mono">${App.fmtMoney(p.sellingPrice)}</td>
                  <td class="num mono">${App.fmtNumber(p.quantity)} ${App.escapeHtml(p.unit || '')}</td>
                  <td><span class="chip chip-${ss.cls}">${ss.label}</span></td>
                  <td>${es ? `<span class="chip chip-${es.cls}">${es.label}</span>` : '<span class="text-muted">—</span>'}</td>
                  <td class="center">
                    <button class="icon-btn" data-edit="${p.id}" title="تعديل"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                    <button class="icon-btn" data-del="${p.id}" title="حذف"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        <div class="pagination" id="prodPagination"></div>
      </div>
    `;

    // Sort headers
    wrap.querySelectorAll('th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const k = th.dataset.sort;
        if (listView.sort === k) listView.sortDir = listView.sortDir === 'asc' ? 'desc' : 'asc';
        else { listView.sort = k; listView.sortDir = 'asc'; }
        drawTable();
      });
    });

    // Row buttons
    wrap.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openProductForm(b.dataset.edit)));
    wrap.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => onDelete(b.dataset.del)));

    // Pagination
    const pg = wrap.querySelector('#prodPagination');
    pg.innerHTML = `
      <button ${listView.page <= 1 ? 'disabled' : ''} data-pg="prev">‹ السابق</button>
      <button disabled>صفحة ${listView.page} من ${totalPages}</button>
      <button ${listView.page >= totalPages ? 'disabled' : ''} data-pg="next">التالي ›</button>
      <span class="text-sm text-muted" style="margin-inline-start:8px">إجمالي: ${total} منتج</span>
    `;
    pg.querySelector('[data-pg="prev"]')?.addEventListener('click', () => { if (listView.page > 1) { listView.page--; drawTable(); } });
    pg.querySelector('[data-pg="next"]')?.addEventListener('click', () => { if (listView.page < totalPages) { listView.page++; drawTable(); } });
  }

  async function onDelete(id) {
    const p = await DB.get('products', id);
    if (!p) return;
    App.confirm({
      title: 'حذف المنتج',
      message: `هل تريد حذف "${App.escapeHtml(p.name)}"؟ إذا كان مستخدماً في فواتير سيتمت أرشفته بدلاً من حذفه.`,
      confirmText: 'حذف',
      onConfirm: async () => {
        try { await deleteProduct(id); App.toast.success('تم حذف المنتج.'); drawTable(); App.refreshAlertsBadge(); }
        catch (e) { App.toast.warn(e.message); drawTable(); }
      },
    });
  }

  /* ----- Product form ----- */
  async function openProductForm(id) {
    const p = id ? await DB.get('products', id) : null;
    const suppliers = await DB.getAll('suppliers');

    const body = App.el('div', { class: 'form-row' }, []);
    body.innerHTML = `
      <div class="form-group">
        <label class="form-label">رمز المنتج (SKU) <span class="req">*</span></label>
        <input class="form-control" id="f_sku" value="${App.escapeHtml(p?.sku || '')}" placeholder="مثال: PRD-001">
      </div>
      <div class="form-group">
        <label class="form-label">اسم المنتج <span class="req">*</span></label>
        <input class="form-control" id="f_name" value="${App.escapeHtml(p?.name || '')}" placeholder="اسم المنتج">
      </div>
      <div class="form-group">
        <label class="form-label">الفئة</label>
        <input class="form-control" id="f_category" value="${App.escapeHtml(p?.category || '')}" placeholder="مثال: مشروبات" list="catList">
        <datalist id="catList">
          ${(await DB.getAll('products')).map(x => x.category ? `<option value="${App.escapeHtml(x.category)}">` : '').join('')}
        </datalist>
      </div>
      <div class="form-group">
        <label class="form-label">الباركود</label>
        <input class="form-control" id="f_barcode" value="${App.escapeHtml(p?.barcode || '')}" placeholder="باركود">
      </div>
      <div class="form-group">
        <label class="form-label">سعر الشراء</label>
        <input type="number" step="0.01" min="0" class="form-control" id="f_purchasePrice" value="${p?.purchasePrice ?? ''}">
      </div>
      <div class="form-group">
        <label class="form-label">سعر البيع</label>
        <input type="number" step="0.01" min="0" class="form-control" id="f_sellingPrice" value="${p?.sellingPrice ?? ''}">
      </div>
      <div class="form-group">
        <label class="form-label">الكمية ${p ? '' : '(رصيد افتتاحي)'}</label>
        <input type="number" step="0.001" min="0" class="form-control" id="f_quantity" value="${p?.quantity ?? 0}" ${p ? 'disabled' : ''}>
        ${p ? '<div class="form-hint">لتعديل الكمية استخدم صفحة المخزون أو حركة مخزون.</div>' : ''}
      </div>
      <div class="form-group">
        <label class="form-label">الحد الأدنى للمخزون</label>
        <input type="number" step="0.001" min="0" class="form-control" id="f_minStock" value="${p?.minStock ?? App.settings.defaultMinStock ?? 5}">
      </div>
      <div class="form-group">
        <label class="form-label">الوحدة</label>
        <input class="form-control" id="f_unit" value="${App.escapeHtml(p?.unit || 'قطعة')}" placeholder="قطعة / كجم / لتر">
      </div>
      <div class="form-group">
        <label class="form-label">تاريخ الانتهاء</label>
        <input type="date" class="form-control" id="f_expirationDate" value="${p?.expirationDate ? p.expirationDate.slice(0,10) : ''}">
      </div>
      <div class="form-group">
        <label class="form-label">المورد</label>
        <select class="form-control" id="f_supplierId">
          <option value="">— بدون —</option>
          ${suppliers.map(s => `<option value="${s.id}" ${p?.supplierId === s.id ? 'selected' : ''}>${App.escapeHtml(s.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label class="form-label">ملاحظات</label>
        <textarea class="form-control" id="f_notes" rows="2">${App.escapeHtml(p?.notes || '')}</textarea>
      </div>
    `;

    const footer = [
      App.el('button', { class: 'btn btn-secondary', onclick: () => m.close() }, ['إلغاء']),
      App.el('button', { class: 'btn btn-primary', onclick: () => onSave() }, [p ? 'حفظ التعديلات' : 'إضافة المنتج']),
    ];

    const m = App.modal({ title: p ? 'تعديل منتج' : 'منتج جديد', body, footer, size: 'lg' });

    async function onSave() {
      const data = {
        id: p?.id,
        sku: App.$('#f_sku', body).value,
        name: App.$('#f_name', body).value,
        category: App.$('#f_category', body).value,
        barcode: App.$('#f_barcode', body).value,
        purchasePrice: App.$('#f_purchasePrice', body).value,
        sellingPrice: App.$('#f_sellingPrice', body).value,
        minStock: App.$('#f_minStock', body).value,
        unit: App.$('#f_unit', body).value,
        expirationDate: App.$('#f_expirationDate', body).value || null,
        supplierId: App.$('#f_supplierId', body).value || null,
        notes: App.$('#f_notes', body).value,
      };
      if (!p) data.quantity = App.$('#f_quantity', body).value;
      try {
        await saveProduct(data);
        App.toast.success(p ? 'تم حفظ التعديلات.' : 'تمت إضافة المنتج.');
        m.close();
        drawTable();
        App.refreshAlertsBadge();
      } catch (e) {
        App.toast.error(e.message);
      }
    }
  }

  return { render, saveProduct, deleteProduct, normalizeProduct, stockStatus, expirationStatus, getCategories };
})();
