/* =========================================================================
   import-export.js — Excel import/export with SheetJS
   Template download, file reading, validation, preview, merge modes,
   full workbook export, CSV exports, error reports.
   ========================================================================= */

ImportExport = (() => {

  /* ----- Template columns (Arabic) ----- */
  const TEMPLATE_COLUMNS = [
    { key: 'sku',            header: 'رمز المنتج' },
    { key: 'name',           header: 'اسم المنتج' },
    { key: 'category',       header: 'الفئة' },
    { key: 'purchasePrice',  header: 'سعر الشراء' },
    { key: 'sellingPrice',   header: 'سعر البيع' },
    { key: 'quantity',       header: 'الكمية' },
    { key: 'minStock',       header: 'الحد الأدنى' },
    { key: 'unit',           header: 'الوحدة' },
    { key: 'expirationDate', header: 'تاريخ الانتهاء' },
    { key: 'barcode',        header: 'الباركود' },
    { key: 'supplier',       header: 'المورد' },
    { key: 'notes',          header: 'ملاحظات' },
  ];

  /* ----- XLSX availability ----- */
  function hasXlsx() {
    return typeof XLSX !== 'undefined';
  }

  /* ----- Template download ----- */
  function downloadTemplate() {
    if (!hasXlsx()) { App.toast.error('مكتبة Excel غير متاحة. تحقق من اتصال الإنترنت.'); return; }
    const wb = XLSX.utils.book_new();
    const wsData = [
      TEMPLATE_COLUMNS.map(c => c.header),
      // Two sample rows
      ['PRD-001', 'زيت دوار الشمس 1 لتر', 'زيوت', 65, 75, 50, 10, 'قطعة', '', '6221000123456', 'شركة مصر للزيوت', ''],
      ['PRD-002', 'أرز مصري فاخر 5 كجم', 'بقالة', 110, 130, 30, 5, 'كيس', '2026-12-31', '', '', ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    // Column widths
    ws['!cols'] = TEMPLATE_COLUMNS.map(c => ({ wch: Math.max(14, c.header.length + 4) }));
    ws['!autofilter'] = { ref: `A1:${XLSX.utils.encode_col(TEMPLATE_COLUMNS.length - 1)}1` };
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };
    // RTL view
    if (!ws['!views']) ws['!views'] = [{ RTL: true }];
    XLSX.utils.book_append_sheet(wb, ws, 'المنتجات');
    // Instructions sheet
    const inst = XLSX.utils.aoa_to_sheet([
      ['تعليمات الاستيراد'],
      [''],
      ['1. استخدم نفس أسماء الأعمدة الموجودة في صفحة "المنتجات".'],
      ['2. "رمز المنتج" هو المفتاح الأساسي ولا يجب تكراره داخل الملف.'],
      ['3. عند وجود الرمز مسبقاً يُعرض عليك اختيار طريقة الدمج.'],
      ['4. الأسعار والكميات يجب أن تكون أرقاماً موجبة.'],
      ['5. تاريخ الانتهاء اختياري ويُفضّل بصيغة YYYY-MM-DD.'],
      ['6. احذف صفوف الأمثلة قبل الاستيراد.'],
    ]);
    inst['!cols'] = [{ wch: 80 }];
    XLSX.utils.book_append_sheet(wb, inst, 'تعليمات');
    XLSX.writeFile(wb, 'قالب_استيراد_المنتجات.xlsx');
    App.toast.success('تم تنزيل القالب.');
  }

  /* ----- File picker ----- */
  function pickFile(accept = '.xlsx,.xls,.csv') {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.onchange = () => {
        if (input.files.length) resolve(input.files[0]);
        else reject(new Error('لم يتم اختيار ملف.'));
      };
      input.click();
    });
  }

  /* ----- Parse file ----- */
  function parseFile(file) {
    return new Promise((resolve, reject) => {
      if (!hasXlsx()) { reject(new Error('مكتبة Excel غير متاحة.')); return; }
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const wb = XLSX.read(data, { type: 'array', cellDates: true });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
          resolve(json);
        } catch (err) {
          reject(new Error('تعذّر قراءة الملف: ' + err.message));
        }
      };
      reader.onerror = () => reject(new Error('فشل قراءة الملف.'));
      reader.readAsArrayBuffer(file);
    });
  }

  /* ----- Map row keys (Arabic header → field key) ----- */
  function mapRow(row) {
    const map = {
      'رمز المنتج': 'sku', 'sku': 'sku', 'الكود': 'sku', 'code': 'sku', 'الباركود': 'barcode',
      'اسم المنتج': 'name', 'الاسم': 'name', 'name': 'name', 'المنتج': 'name',
      'الفئة': 'category', 'category': 'category', 'القسم': 'category',
      'سعر الشراء': 'purchasePrice', 'purchasePrice': 'purchasePrice', 'التكلفة': 'purchasePrice', 'cost': 'purchasePrice',
      'سعر البيع': 'sellingPrice', 'sellingPrice': 'sellingPrice', 'السعر': 'sellingPrice', 'price': 'sellingPrice',
      'الكمية': 'quantity', 'quantity': 'quantity', 'الكميه': 'quantity', 'qty': 'quantity',
      'الحد الأدنى': 'minStock', 'minStock': 'minStock', 'الحد الادنى': 'minStock', 'min': 'minStock',
      'الوحدة': 'unit', 'unit': 'unit', 'الوحده': 'unit',
      'تاريخ الانتهاء': 'expirationDate', 'expirationDate': 'expirationDate', 'الصلاحية': 'expirationDate', 'expiry': 'expirationDate',
      'الباركود': 'barcode', 'barcode': 'barcode',
      'المورد': 'supplier', 'supplier': 'supplier',
      'ملاحظات': 'notes', 'notes': 'notes', 'ملاحظه': 'notes',
    };
    const out = {};
    Object.entries(row).forEach(([k, v]) => {
      const key = map[String(k).trim()] || map[String(k).trim().toLowerCase()];
      if (key) out[key] = v;
    });
    return out;
  }

  /* ----- Validate parsed rows ----- */
  function validateRows(rows) {
    const valid = [];
    const errors = [];
    const seenSkus = new Map();

    rows.forEach((raw, idx) => {
      const r = mapRow(raw);
      const rowNo = idx + 2; // header is row 1
      const errs = [];

      const sku = String(r.sku || '').trim();
      if (!sku) errs.push('رمز المنتج مفقود');
      if (!r.name || !String(r.name).trim()) errs.push('اسم المنتج مفقود');

      const pp = Number(String(r.purchasePrice).replace(/[^\d.-]/g, ''));
      const sp = Number(String(r.sellingPrice).replace(/[^\d.-]/g, ''));
      const qty = Number(String(r.quantity).replace(/[^\d.-]/g, ''));
      const mn = Number(String(r.minStock).replace(/[^\d.-]/g, ''));

      if (r.purchasePrice !== undefined && r.purchasePrice !== '' && (isNaN(pp) || pp < 0)) errs.push('سعر شراء غير صالح');
      if (r.sellingPrice !== undefined && r.sellingPrice !== '' && (isNaN(sp) || sp < 0)) errs.push('سعر بيع غير صالح');
      if (r.quantity !== undefined && r.quantity !== '' && (isNaN(qty) || qty < 0)) errs.push('كمية غير صالحة');
      if (r.minStock !== undefined && r.minStock !== '' && (isNaN(mn) || mn < 0)) errs.push('حد أدنى غير صالح');

      // Duplicate SKU inside file
      if (sku) {
        if (seenSkus.has(sku)) errs.push(`رمز مكرر داخل الملف (صف ${seenSkus.get(sku)})`);
        else seenSkus.set(sku, rowNo);
      }

      if (errs.length) {
        errors.push({ row: rowNo, sku: sku || '—', name: r.name || '—', errors: errs });
      } else {
        valid.push({
          sku,
          name: String(r.name).trim(),
          category: String(r.category || '').trim(),
          barcode: String(r.barcode || '').trim(),
          purchasePrice: pp || 0,
          sellingPrice: sp || 0,
          quantity: qty || 0,
          minStock: mn || App.settings.defaultMinStock || 5,
          unit: r.unit ? String(r.unit).trim() : 'قطعة',
          expirationDate: r.expirationDate ? normalizeDate(r.expirationDate) : null,
          supplier: String(r.supplier || '').trim(),
          notes: String(r.notes || '').trim(),
          _row: rowNo,
        });
      }
    });
    return { valid, errors };
  }

  function normalizeDate(v) {
    if (!v) return null;
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    const s = String(v).trim();
    // dd/mm/yyyy or dd-mm-yyyy
    const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
    if (m) {
      let y = m[3];
      if (y.length === 2) y = '20' + y;
      return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    }
    // yyyy-mm-dd
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }

  /* ----- Import flow ----- */
  async function startImport() {
    try {
      const file = await pickFile();
      App.toast.info('جاري قراءة الملف…');
      const rows = await parseFile(file);
      if (!rows.length) { App.toast.warn('الملف فارغ أو لا يحتوي بيانات.'); return; }
      const { valid, errors } = validateRows(rows);
      showPreview(file.name, rows.length, valid, errors);
    } catch (e) {
      App.toast.error(e.message);
    }
  }

  function showPreview(fileName, totalRows, valid, errors) {
    const body = App.el('div', {}, []);
    body.innerHTML = `
      <div class="flex-between mb-3">
        <div>
          <div class="text-bold text-lg">${App.escapeHtml(fileName)}</div>
          <div class="text-sm text-muted">إجمالي الصفوف: ${totalRows} — صالح: <span class="chip chip-success">${valid.length}</span> — أخطاء: <span class="chip chip-${errors.length ? 'danger' : 'neutral'}">${errors.length}</span></div>
        </div>
      </div>

      ${errors.length ? `
        <div class="card mb-4" style="border-color: var(--red-500); background: #fef2f2">
          <div class="flex-between mb-2">
            <div class="text-bold" style="color: var(--red-600)">صفوف تحتوي على أخطاء (${errors.length})</div>
            <button class="btn btn-secondary btn-sm" id="btnErrReport">تنزيل تقرير الأخطاء</button>
          </div>
          <div class="table-scroll" style="max-height:240px">
            <table class="data">
              <thead><tr><th>الصف</th><th>الرمز</th><th>الاسم</th><th>الأخطاء</th></tr></thead>
              <tbody>
                ${errors.slice(0, 200).map(e => `<tr><td>${e.row}</td><td class="mono">${App.escapeHtml(e.sku)}</td><td>${App.escapeHtml(e.name)}</td><td><span class="chip chip-danger">${App.escapeHtml(e.errors.join('، '))}</span></td></tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">خيارات الدمج للمنتجات الموجودة</h3>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">طريقة معالجة المنتجات الموجودة</label>
            <select class="form-control" id="mergeMode">
              <option value="add_qty" selected>إضافة الكميات للرصيد الحالي (افتراضي)</option>
              <option value="update_only">تحديث بيانات المنتج فقط</option>
              <option value="update_add_qty">تحديث البيانات وإضافة الكميات</option>
              <option value="replace_qty">استبدال الكمية (تحذير)</option>
              <option value="qty_only">إضافة الكميات فقط دون تغيير البيانات</option>
              <option value="skip">تخطّي المنتجات الموجودة</option>
            </select>
            <div class="form-hint">سيتم تطبيق هذه القاعدة على المنتجات التي تطابق نفس رمز SKU.</div>
          </div>
        </div>

        <hr class="section-divider">

        <h4 class="text-bold mb-2">معاينة المنتجات الصالحة (${valid.length})</h4>
        <div class="table-scroll" style="max-height:340px">
          <table class="data">
            <thead>
              <tr><th>الرمز</th><th>الاسم</th><th>الفئة</th><th>السعر</th><th>الكمية</th><th>الحالة</th></tr>
            </thead>
            <tbody>
              ${valid.slice(0, 100).map(r => `<tr><td class="mono">${App.escapeHtml(r.sku)}</td><td>${App.escapeHtml(r.name)}</td><td>${App.escapeHtml(r.category) || '—'}</td><td class="num mono">${App.fmtMoney(r.sellingPrice)}</td><td class="num mono">${r.quantity}</td><td><span class="chip chip-${r._exists ? 'info' : 'success'}">${r._exists ? 'موجود' : 'جديد'}</span></td></tr>`).join('')}
              ${valid.length > 100 ? `<tr><td colspan="6" class="text-center text-muted">…ويوجد ${valid.length - 100} صف آخر</td></tr>` : ''}
            </tbody>
          </table>
        </div>
      </div>
    `;

    const footer = [
      App.el('button', { class: 'btn btn-secondary', onclick: () => m.close() }, ['إلغاء']),
      errors.length ? App.el('button', { class: 'btn btn-secondary', onclick: () => downloadErrorReport(fileName, errors) }, ['تنزيل تقرير الأخطاء']) : null,
      App.el('button', { class: 'btn btn-primary', onclick: () => doImport(fileName, valid, body) }, ['تنفيذ الاستيراد']),
    ].filter(Boolean);

    const m = App.modal({ title: 'معاينة الاستيراد', body, footer, size: 'xl' });
  }

  async function doImport(fileName, valid, bodyEl) {
    const mergeMode = App.$('#mergeMode', bodyEl).value;
    if (!valid.length) { App.toast.warn('لا توجد صفوف صالحة للاستيراد.'); return; }

    // Pre-flight: mark which ones exist
    const existing = await DB.getAll('products');
    const skuMap = new Map();
    existing.forEach(p => skuMap.set(p.sku.toLowerCase(), p));
    valid.forEach(v => { v._exists = !!skuMap.get(v.sku.toLowerCase()); });

    // Create backup snapshot (in-memory) — for safety
    let backupSnapshot;
    try {
      backupSnapshot = await DB.exportAll();
    } catch (e) { console.warn('Backup snapshot failed', e); }

    const batchId = DB.uid('imp');
    const dateISO = new Date().toISOString();

    App.toast.info('جاري تنفيذ الاستيراد…');

    try {
      let added = 0, updated = 0, qtyAdded = 0, skipped = 0;

      // Resolve supplier names → IDs
      const suppliers = await DB.getAll('suppliers');
      const supplierMap = new Map();
      suppliers.forEach(s => supplierMap.set(s.name.toLowerCase(), s));

      // Build operations
      const newProducts = [];
      const updatedProducts = [];
      const movements = [];

      valid.forEach(r => {
        const existingP = skuMap.get(r.sku.toLowerCase());
        let supplierId = null;
        if (r.supplier) {
          const s = supplierMap.get(r.supplier.toLowerCase());
          if (s) supplierId = s.id;
        }
        if (!existingP) {
          // New
          const np = {
            id: DB.uid('prod'),
            sku: r.sku,
            name: r.name,
            category: r.category,
            barcode: r.barcode,
            purchasePrice: r.purchasePrice,
            sellingPrice: r.sellingPrice,
            quantity: r.quantity,
            minStock: r.minStock,
            unit: r.unit,
            expirationDate: r.expirationDate,
            supplierId,
            notes: r.notes,
            costMethod: 'weighted',
            archived: false,
            createdAt: dateISO,
            updatedAt: dateISO,
          };
          newProducts.push(np);
          if (r.quantity > 0) {
            movements.push({
              id: DB.uid('mv'),
              productId: np.id,
              date: dateISO,
              type: 'opening',
              qtyBefore: 0,
              qtyChange: r.quantity,
              qtyAfter: r.quantity,
              reason: 'رصيد افتتاحي من استيراد Excel',
              source: 'excel_import',
              ref: batchId,
              unitCost: r.purchasePrice,
              notes: `استيراد ${fileName}`,
            });
          }
          added++;
        } else {
          // Existing
          if (mergeMode === 'skip') { skipped++; return; }
          const before = Number(existingP.quantity || 0);
          let after = before;
          let qChange = 0;
          const upd = { ...existingP };

          if (mergeMode === 'update_only') {
            upd.name = r.name;
            upd.category = r.category;
            upd.barcode = r.barcode;
            upd.purchasePrice = r.purchasePrice || upd.purchasePrice;
            upd.sellingPrice = r.sellingPrice || upd.sellingPrice;
            upd.minStock = r.minStock;
            upd.unit = r.unit;
            upd.expirationDate = r.expirationDate;
            upd.supplierId = supplierId || upd.supplierId;
            upd.notes = r.notes || upd.notes;
          } else if (mergeMode === 'add_qty') {
            qChange = r.quantity;
            after = before + r.quantity;
          } else if (mergeMode === 'update_add_qty') {
            upd.name = r.name;
            upd.category = r.category;
            upd.barcode = r.barcode;
            upd.purchasePrice = r.purchasePrice || upd.purchasePrice;
            upd.sellingPrice = r.sellingPrice || upd.sellingPrice;
            upd.minStock = r.minStock;
            upd.unit = r.unit;
            upd.expirationDate = r.expirationDate;
            upd.supplierId = supplierId || upd.supplierId;
            upd.notes = r.notes || upd.notes;
            qChange = r.quantity;
            after = before + r.quantity;
          } else if (mergeMode === 'qty_only') {
            qChange = r.quantity;
            after = before + r.quantity;
          } else if (mergeMode === 'replace_qty') {
            qChange = r.quantity - before;
            after = r.quantity;
          }
          upd.quantity = after;
          upd.updatedAt = dateISO;
          updatedProducts.push(upd);
          if (qChange !== 0) {
            movements.push({
              id: DB.uid('mv'),
              productId: upd.id,
              date: dateISO,
              type: qChange > 0 ? 'import_add' : 'import_replace',
              qtyBefore: before,
              qtyChange: qChange,
              qtyAfter: after,
              reason: mergeMode === 'replace_qty' ? 'استبدال الكمية من استيراد Excel' : 'إضافة كمية من استيراد Excel',
              source: 'excel_import',
              ref: batchId,
              unitCost: r.purchasePrice,
              notes: `استيراد ${fileName}`,
            });
            qtyAdded += qChange;
          }
          updated++;
        }
      });

      // Atomic transaction
      await DB.transaction(['products', 'inventoryMoves', 'imports'], async (h) => {
        newProducts.forEach(p => h.products.put(p));
        updatedProducts.forEach(p => h.products.put(p));
        movements.forEach(m => h.inventoryMoves.put(m));
        const importRec = {
          id: batchId,
          date: dateISO,
          fileName,
          totalRows: valid.length,
          newCount: added,
          updatedCount: updated,
          skippedCount: skipped,
          qtyAdded,
          mergeMode,
          movements: movements.map(m => m.id),
        };
        h.imports.put(importRec);
      });

      App.toast.success(`تم الاستيراد: ${added} جديد، ${updated} محدّث، ${skipped} متخطّى.`);
      App.refreshAlertsBadge();
      // Refresh current view
      App.modal && App.closeModal();
      App.navigate(App.state.currentSection);
    } catch (e) {
      console.error(e);
      App.toast.error('فشل الاستيراد: ' + e.message);
    }
  }

  function downloadErrorReport(fileName, errors) {
    if (!hasXlsx()) { App.toast.error('مكتبة Excel غير متاحة.'); return; }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['الصف', 'الرمز', 'الاسم', 'الأخطاء'],
      ...errors.map(e => [e.row, e.sku, e.name, e.errors.join('، ')]),
    ]);
    ws['!cols'] = [{ wch: 6 }, { wch: 18 }, { wch: 28 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, ws, 'الأخطاء');
    XLSX.writeFile(wb, `أخطاء_${fileName.replace(/\.(xlsx|xls|csv)$/i, '')}.xlsx`);
  }

  /* ----- Exports ----- */

  function exportProducts() {
    if (!hasXlsx()) { App.toast.error('مكتبة Excel غير متاحة.'); return; }
    DB.getAll('products').then(products => {
      const wb = XLSX.utils.book_new();
      const rows = products.map(p => ({
        'رمز المنتج': p.sku,
        'اسم المنتج': p.name,
        'الفئة': p.category,
        'سعر الشراء': Number(p.purchasePrice),
        'سعر البيع': Number(p.sellingPrice),
        'الكمية': Number(p.quantity),
        'الحد الأدنى': Number(p.minStock),
        'الوحدة': p.unit,
        'تاريخ الانتهاء': p.expirationDate || '',
        'الباركود': p.barcode,
        'المورد': '',
      }));
      const ws = XLSX.utils.json_to_sheet(rows, { header: TEMPLATE_COLUMNS.map(c => c.header) });
      ws['!cols'] = TEMPLATE_COLUMNS.map(c => ({ wch: Math.max(14, c.header.length + 4) }));
      ws['!autofilter'] = { ref: `A1:${XLSX.utils.encode_col(TEMPLATE_COLUMNS.length - 1)}1` };
      ws['!freeze'] = { xSplit: 0, ySplit: 1 };
      if (!ws['!views']) ws['!views'] = [{ RTL: true }];
      // Force SKU and barcode as text to preserve leading zeros
      const range = XLSX.utils.decode_range(ws['!ref']);
      for (let r = range.s.r + 1; r <= range.e.r; r++) {
        const skuCell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
        if (skuCell) { skuCell.t = 's'; skuCell.v = String(skuCell.v); }
      }
      XLSX.utils.book_append_sheet(wb, ws, 'المنتجات');
      XLSX.writeFile(wb, 'المنتجات.xlsx');
      App.toast.success('تم تصدير المنتجات.');
    });
  }

  async function exportInvoices() {
    if (!hasXlsx()) { App.toast.error('مكتبة Excel غير متاحة.'); return; }
    const wb = XLSX.utils.book_new();
    const invoices = await DB.getAll('invoices');
    const items = await DB.getAll('invoiceItems');
    const customers = await DB.getAll('customers');
    const products = await DB.getAll('products');
    const custMap = new Map(customers.map(c => [c.id, c]));
    const prodMap = new Map(products.map(p => [p.id, p]));

    // Invoices summary
    const invRows = invoices.map(inv => ({
      'رقم الفاتورة': inv.number,
      'التاريخ': App.fmtDate(inv.date, true),
      'العميل': inv.customerName || custMap.get(inv.customerId)?.name || '—',
      'الهاتف': inv.customerPhone || custMap.get(inv.customerId)?.phone || '',
      'الإجمالي الفرعي': Number(inv.subtotal || 0),
      'الخصم': Number(inv.discount || 0),
      'الضريبة': Number(inv.tax || 0),
      'الإجمالي': Number(inv.total || 0),
      'المدفوع': Number(inv.paid || 0),
      'المتبقي': Number(inv.remaining || 0),
      'طريقة الدفع': inv.paymentMethod || '',
      'الحالة': inv.status || '',
    }));
    const wsInv = XLSX.utils.json_to_sheet(invRows);
    wsInv['!cols'] = [
      { wch: 14 }, { wch: 16 }, { wch: 22 }, { wch: 14 },
      { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 },
      { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
    ];
    wsInv['!autofilter'] = { ref: 'A1:L1' };
    wsInv['!freeze'] = { xSplit: 0, ySplit: 1 };
    if (!wsInv['!views']) wsInv['!views'] = [{ RTL: true }];
    XLSX.utils.book_append_sheet(wb, wsInv, 'الفواتير');

    // Invoice details
    const detRows = items.map(it => {
      const inv = invoices.find(i => i.id === it.invoiceId);
      const prod = prodMap.get(it.productId);
      return {
        'رقم الفاتورة': inv?.number || '',
        'التاريخ': inv ? App.fmtDate(inv.date, true) : '',
        'رمز المنتج': prod?.sku || it.sku || '',
        'اسم المنتج': it.name || prod?.name || '',
        'الكمية': Number(it.quantity || 0),
        'سعر الوحدة': Number(it.unitPrice || 0),
        'الخصم': Number(it.discount || 0),
        'الضريبة': Number(it.tax || 0),
        'إجمالي السطر': Number(it.total || 0),
      };
    });
    const wsDet = XLSX.utils.json_to_sheet(detRows);
    wsDet['!cols'] = [{ wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }];
    wsDet['!autofilter'] = { ref: 'A1:I1' };
    wsDet['!freeze'] = { xSplit: 0, ySplit: 1 };
    if (!wsDet['!views']) wsDet['!views'] = [{ RTL: true }];
    XLSX.utils.book_append_sheet(wb, wsDet, 'تفاصيل الفواتير');

    XLSX.writeFile(wb, 'الفواتير.xlsx');
    App.toast.success('تم تصدير الفواتير.');
  }

  async function exportInventory() {
    if (!hasXlsx()) { App.toast.error('مكتبة Excel غير متاحة.'); return; }
    const products = await DB.getAll('products');
    const wb = XLSX.utils.book_new();
    const rows = products.map(p => ({
      'رمز المنتج': p.sku,
      'اسم المنتج': p.name,
      'الفئة': p.category,
      'الكمية': Number(p.quantity || 0),
      'الحد الأدنى': Number(p.minStock || 0),
      'سعر الشراء': Number(p.purchasePrice || 0),
      'قيمة التكلفة': Number((p.purchasePrice || 0) * (p.quantity || 0)),
      'سعر البيع': Number(p.sellingPrice || 0),
      'قيمة البيع المتوقعة': Number((p.sellingPrice || 0) * (p.quantity || 0)),
      'تاريخ الانتهاء': p.expirationDate || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 14 }, { wch: 22 }, { wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 14 }];
    ws['!autofilter'] = { ref: 'A1:J1' };
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };
    if (!ws['!views']) ws['!views'] = [{ RTL: true }];
    XLSX.utils.book_append_sheet(wb, ws, 'المخزون');
    XLSX.writeFile(wb, 'المخزون.xlsx');
    App.toast.success('تم تصدير المخزون.');
  }

  async function exportMovements() {
    if (!hasXlsx()) { App.toast.error('مكتبة Excel غير متاحة.'); return; }
    const moves = await DB.getAll('inventoryMoves');
    const products = await DB.getAll('products');
    const pMap = new Map(products.map(p => [p.id, p]));
    const wb = XLSX.utils.book_new();
    const rows = moves.sort((a, b) => new Date(b.date) - new Date(a.date)).map(m => ({
      'التاريخ': App.fmtDate(m.date, true),
      'رمز المنتج': pMap.get(m.productId)?.sku || '',
      'اسم المنتج': pMap.get(m.productId)?.name || '',
      'نوع الحركة': typeLabel(m.type),
      'الكمية قبل': Number(m.qtyBefore || 0),
      'التغيير': Number(m.qtyChange || 0),
      'الكمية بعد': Number(m.qtyAfter || 0),
      'السبب': m.reason || '',
      'المرجع': m.ref || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 24 }, { wch: 16 }];
    ws['!autofilter'] = { ref: 'A1:I1' };
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };
    if (!ws['!views']) ws['!views'] = [{ RTL: true }];
    XLSX.utils.book_append_sheet(wb, ws, 'حركات المخزون');
    XLSX.writeFile(wb, 'حركات_المخزون.xlsx');
    App.toast.success('تم تصدير الحركات.');
  }

  function typeLabel(t) {
    const m = {
      opening: 'رصيد افتتاحي', sale: 'بيع', purchase: 'شراء',
      customer_return: 'مرتجع عميل', supplier_return: 'مرتجع مورد',
      manual_add: 'إضافة يدوية', manual_sub: 'خصم يدوي',
      correction: 'تسوية', transfer: 'تحويل', import_add: 'استيراد', import_replace: 'استبدال',
    };
    return m[t] || t;
  }

  async function exportPurchases() {
    if (!hasXlsx()) { App.toast.error('مكتبة Excel غير متاحة.'); return; }
    const wb = XLSX.utils.book_new();
    const purchases = await DB.getAll('purchases');
    const items = await DB.getAll('purchaseItems');
    const suppliers = await DB.getAll('suppliers');
    const sMap = new Map(suppliers.map(s => [s.id, s]));
    const products = await DB.getAll('products');
    const pMap = new Map(products.map(p => [p.id, p]));

    const sumRows = purchases.map(p => ({
      'رقم الفاتورة': p.number,
      'التاريخ': App.fmtDate(p.date, true),
      'المورد': sMap.get(p.supplierId)?.name || '—',
      'الإجمالي': Number(p.total || 0),
      'المدفوع': Number(p.paid || 0),
      'المتبقي': Number(p.remaining || 0),
    }));
    const wsP = XLSX.utils.json_to_sheet(sumRows);
    wsP['!cols'] = [{ wch: 14 }, { wch: 16 }, { wch: 24 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
    wsP['!autofilter'] = { ref: 'A1:F1' };
    wsP['!freeze'] = { xSplit: 0, ySplit: 1 };
    if (!wsP['!views']) wsP['!views'] = [{ RTL: true }];
    XLSX.utils.book_append_sheet(wb, wsP, 'المشتريات');

    const detRows = items.map(it => {
      const p = purchases.find(x => x.id === it.purchaseId);
      const prod = pMap.get(it.productId);
      return {
        'رقم الفاتورة': p?.number || '',
        'التاريخ': p ? App.fmtDate(p.date, true) : '',
        'رمز المنتج': prod?.sku || '',
        'اسم المنتج': it.name || prod?.name || '',
        'الكمية': Number(it.quantity || 0),
        'التكلفة': Number(it.unitCost || 0),
        'الإجمالي': Number(it.total || 0),
      };
    });
    const wsD = XLSX.utils.json_to_sheet(detRows);
    wsD['!cols'] = [{ wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 8 }, { wch: 10 }, { wch: 12 }];
    wsD['!autofilter'] = { ref: 'A1:G1' };
    wsD['!freeze'] = { xSplit: 0, ySplit: 1 };
    if (!wsD['!views']) wsD['!views'] = [{ RTL: true }];
    XLSX.utils.book_append_sheet(wb, wsD, 'تفاصيل المشتريات');

    XLSX.writeFile(wb, 'المشتريات.xlsx');
    App.toast.success('تم تصدير المشتريات.');
  }

  async function exportCustomers() {
    if (!hasXlsx()) { App.toast.error('مكتبة Excel غير متاحة.'); return; }
    const customers = await DB.getAll('customers');
    const wb = XLSX.utils.book_new();
    const rows = customers.map(c => ({
      'الاسم': c.name,
      'الهاتف': c.phone || '',
      'العنوان': c.address || '',
      'إجمالي المشتريات': Number(c.totalPurchases || 0),
      'المدفوع': Number(c.totalPaid || 0),
      'الرصيد المستحق': Number(c.balance || 0),
      'ملاحظات': c.notes || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 26 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 24 }];
    ws['!autofilter'] = { ref: 'A1:G1' };
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };
    if (!ws['!views']) ws['!views'] = [{ RTL: true }];
    XLSX.utils.book_append_sheet(wb, ws, 'العملاء');
    XLSX.writeFile(wb, 'العملاء.xlsx');
    App.toast.success('تم تصدير العملاء.');
  }

  async function exportSuppliers() {
    if (!hasXlsx()) { App.toast.error('مكتبة Excel غير متاحة.'); return; }
    const suppliers = await DB.getAll('suppliers');
    const wb = XLSX.utils.book_new();
    const rows = suppliers.map(s => ({
      'الاسم': s.name,
      'الهاتف': s.phone || '',
      'العنوان': s.address || '',
      'الرصيد المستحق': Number(s.balance || 0),
      'ملاحظات': s.notes || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 26 }, { wch: 14 }, { wch: 24 }];
    ws['!autofilter'] = { ref: 'A1:E1' };
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };
    if (!ws['!views']) ws['!views'] = [{ RTL: true }];
    XLSX.utils.book_append_sheet(wb, ws, 'الموردون');
    XLSX.writeFile(wb, 'الموردون.xlsx');
    App.toast.success('تم تصدير الموردين.');
  }

  async function exportExpenses() {
    if (!hasXlsx()) { App.toast.error('مكتبة Excel غير متاحة.'); return; }
    const expenses = await DB.getAll('expenses');
    const wb = XLSX.utils.book_new();
    const rows = expenses.map(e => ({
      'التاريخ': App.fmtDate(e.date, true),
      'الفئة': e.category,
      'الوصف': e.description,
      'المبلغ': Number(e.amount || 0),
      'طريقة الدفع': e.method || '',
      'ملاحظات': e.notes || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 30 }, { wch: 12 }, { wch: 14 }, { wch: 24 }];
    ws['!autofilter'] = { ref: 'A1:F1' };
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };
    if (!ws['!views']) ws['!views'] = [{ RTL: true }];
    XLSX.utils.book_append_sheet(wb, ws, 'المصروفات');
    XLSX.writeFile(wb, 'المصروفات.xlsx');
    App.toast.success('تم تصدير المصروفات.');
  }

  async function exportAll() {
    if (!hasXlsx()) { App.toast.error('مكتبة Excel غير متاحة.'); return; }
    const wb = XLSX.utils.book_new();
    const [products, customers, suppliers, invoices, invoiceItems, payments, purchases, purchaseItems, movements, expenses] = await Promise.all([
      DB.getAll('products'), DB.getAll('customers'), DB.getAll('suppliers'),
      DB.getAll('invoices'), DB.getAll('invoiceItems'), DB.getAll('payments'),
      DB.getAll('purchases'), DB.getAll('purchaseItems'), DB.getAll('inventoryMoves'),
      DB.getAll('expenses'),
    ]);
    const custMap = new Map(customers.map(c => [c.id, c]));
    const sMap = new Map(suppliers.map(s => [s.id, s]));
    const pMap = new Map(products.map(p => [p.id, p]));
    const settings = App.settings;

    function addSheet(name, rows, cols, headerOrder) {
      if (!rows.length) {
        const ws = XLSX.utils.aoa_to_sheet([headerOrder || cols.map(c => c.h)]);
        XLSX.utils.book_append_sheet(wb, ws, name);
        return;
      }
      const ws = XLSX.utils.json_to_sheet(rows, { header: headerOrder });
      ws['!cols'] = cols;
      ws['!autofilter'] = { ref: `A1:${XLSX.utils.encode_col(cols.length - 1)}1` };
      ws['!freeze'] = { xSplit: 0, ySplit: 1 };
      if (!ws['!views']) ws['!views'] = [{ RTL: true }];
      XLSX.utils.book_append_sheet(wb, ws, name);
    }

    // Products
    addSheet('المنتجات', products.map(p => ({
      'رمز المنتج': p.sku, 'اسم المنتج': p.name, 'الفئة': p.category,
      'سعر الشراء': Number(p.purchasePrice), 'سعر البيع': Number(p.sellingPrice),
      'الكمية': Number(p.quantity), 'الحد الأدنى': Number(p.minStock), 'الوحدة': p.unit,
      'تاريخ الانتهاء': p.expirationDate || '', 'الباركود': p.barcode || '',
    })), [
      { wch: 14 }, { wch: 22 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 },
    ], ['رمز المنتج', 'اسم المنتج', 'الفئة', 'سعر الشراء', 'سعر البيع', 'الكمية', 'الحد الأدنى', 'الوحدة', 'تاريخ الانتهاء', 'الباركود']);

    // Invoices
    addSheet('الفواتير', invoices.map(inv => ({
      'رقم الفاتورة': inv.number, 'التاريخ': App.fmtDate(inv.date, true),
      'العميل': inv.customerName || custMap.get(inv.customerId)?.name || '—',
      'الإجمالي الفرعي': Number(inv.subtotal || 0), 'الخصم': Number(inv.discount || 0),
      'الضريبة': Number(inv.tax || 0), 'الإجمالي': Number(inv.total || 0),
      'المدفوع': Number(inv.paid || 0), 'المتبقي': Number(inv.remaining || 0),
      'طريقة الدفع': inv.paymentMethod || '', 'الحالة': inv.status || '',
    })), Array(11).fill({ wch: 14 }), null);

    // Invoice details
    addSheet('تفاصيل الفواتير', invoiceItems.map(it => {
      const inv = invoices.find(i => i.id === it.invoiceId);
      const prod = pMap.get(it.productId);
      return {
        'رقم الفاتورة': inv?.number || '', 'التاريخ': inv ? App.fmtDate(inv.date, true) : '',
        'رمز المنتج': prod?.sku || it.sku || '', 'اسم المنتج': it.name || prod?.name || '',
        'الكمية': Number(it.quantity || 0), 'سعر الوحدة': Number(it.unitPrice || 0),
        'الخصم': Number(it.discount || 0), 'الضريبة': Number(it.tax || 0), 'إجمالي السطر': Number(it.total || 0),
      };
    }), Array(9).fill({ wch: 14 }), null);

    // Inventory
    addSheet('المخزون', products.map(p => ({
      'رمز المنتج': p.sku, 'اسم المنتج': p.name, 'الفئة': p.category,
      'الكمية': Number(p.quantity || 0), 'الحد الأدنى': Number(p.minStock || 0),
      'سعر الشراء': Number(p.purchasePrice || 0), 'قيمة التكلفة': Number((p.purchasePrice || 0) * (p.quantity || 0)),
      'سعر البيع': Number(p.sellingPrice || 0), 'قيمة البيع المتوقعة': Number((p.sellingPrice || 0) * (p.quantity || 0)),
      'تاريخ الانتهاء': p.expirationDate || '',
    })), Array(10).fill({ wch: 14 }), null);

    // Movements
    addSheet('حركات المخزون', movements.sort((a, b) => new Date(b.date) - new Date(a.date)).map(m => ({
      'التاريخ': App.fmtDate(m.date, true), 'رمز المنتج': pMap.get(m.productId)?.sku || '',
      'اسم المنتج': pMap.get(m.productId)?.name || '', 'نوع الحركة': typeLabel(m.type),
      'الكمية قبل': Number(m.qtyBefore || 0), 'التغيير': Number(m.qtyChange || 0),
      'الكمية بعد': Number(m.qtyAfter || 0), 'السبب': m.reason || '', 'المرجع': m.ref || '',
    })), Array(9).fill({ wch: 14 }), null);

    // Purchases
    addSheet('المشتريات', purchases.map(p => ({
      'رقم الفاتورة': p.number, 'التاريخ': App.fmtDate(p.date, true),
      'المورد': sMap.get(p.supplierId)?.name || '—', 'الإجمالي': Number(p.total || 0),
      'المدفوع': Number(p.paid || 0), 'المتبقي': Number(p.remaining || 0),
    })), Array(6).fill({ wch: 14 }), null);

    // Purchase details
    addSheet('تفاصيل المشتريات', purchaseItems.map(it => {
      const p = purchases.find(x => x.id === it.purchaseId);
      const prod = pMap.get(it.productId);
      return {
        'رقم الفاتورة': p?.number || '', 'التاريخ': p ? App.fmtDate(p.date, true) : '',
        'رمز المنتج': prod?.sku || '', 'اسم المنتج': it.name || prod?.name || '',
        'الكمية': Number(it.quantity || 0), 'التكلفة': Number(it.unitCost || 0), 'الإجمالي': Number(it.total || 0),
      };
    }), Array(7).fill({ wch: 14 }), null);

    // Customers
    addSheet('العملاء', customers.map(c => ({
      'الاسم': c.name, 'الهاتف': c.phone || '', 'العنوان': c.address || '',
      'إجمالي المشتريات': Number(c.totalPurchases || 0), 'المدفوع': Number(c.totalPaid || 0),
      'الرصيد المستحق': Number(c.balance || 0), 'ملاحظات': c.notes || '',
    })), Array(7).fill({ wch: 16 }), null);

    // Suppliers
    addSheet('الموردون', suppliers.map(s => ({
      'الاسم': s.name, 'الهاتف': s.phone || '', 'العنوان': s.address || '',
      'الرصيد المستحق': Number(s.balance || 0), 'ملاحظات': s.notes || '',
    })), Array(5).fill({ wch: 16 }), null);

    // Expenses
    addSheet('المصروفات', expenses.map(e => ({
      'التاريخ': App.fmtDate(e.date, true), 'الفئة': e.category, 'الوصف': e.description,
      'المبلغ': Number(e.amount || 0), 'طريقة الدفع': e.method || '', 'ملاحظات': e.notes || '',
    })), Array(6).fill({ wch: 16 }), null);

    // Payments
    addSheet('المدفوعات', payments.map(p => {
      const inv = invoices.find(i => i.id === p.invoiceId);
      return {
        'التاريخ': App.fmtDate(p.date, true), 'رقم الفاتورة': inv?.number || '',
        'العميل': p.customerId ? custMap.get(p.customerId)?.name || '' : '',
        'المبلغ': Number(p.amount || 0), 'الطريقة': p.method || '', 'ملاحظات': p.notes || '',
      };
    }), Array(6).fill({ wch: 14 }), null);

    // Settings summary
    addSheet('الإعدادات', [
      { 'الإعداد': 'اسم المتجر', 'القيمة': settings.storeName },
      { 'الإعداد': 'الهاتف', 'القيمة': settings.storePhone },
      { 'الإعداد': 'العنوان', 'القيمة': settings.storeAddress },
      { 'الإعداد': 'العملة', 'القيمة': settings.currency },
      { 'الإعداد': 'نسبة الضريبة', 'القيمة': settings.taxRate },
      { 'الإعداد': 'بادئة الفاتورة', 'القيمة': settings.invoicePrefix },
      { 'الإعداد': 'رقم الفاتورة التالي', 'القيمة': settings.nextInvoiceNumber },
      { 'الإعداد': 'الحد الأدنى الافتراضي', 'القيمة': settings.defaultMinStock },
      { 'الإعداد': 'أيام تنبيه الانتهاء', 'القيمة': settings.expirationWarningDays },
    ], [{ wch: 24 }, { wch: 30 }], null);

    const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    XLSX.writeFile(wb, `نسخة_كاملة_${stamp}.xlsx`);
    App.toast.success('تم تصدير ملف Excel الكامل.');
  }

  return {
    TEMPLATE_COLUMNS, hasXlsx,
    downloadTemplate, startImport,
    exportProducts, exportInvoices, exportInventory, exportMovements,
    exportPurchases, exportCustomers, exportSuppliers, exportExpenses, exportAll,
  };
})();
