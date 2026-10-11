/* =========================================================================
   settings.js — App settings + data operations
   ========================================================================= */

Settings = (() => {
  async function render(container) {
    const s = App.settings;
    container.innerHTML = `
      <div class="tabs">
        <button class="tab active" data-tab="store">بيانات المتجر</button>
        <button class="tab" data-tab="sales">إعدادات البيع</button>
        <button class="tab" data-tab="data">البيانات والنسخ</button>
      </div>
      <div id="settingsContent"></div>
    `;
    container.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
      container.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === t));
      draw(t.dataset.tab);
    }));
    draw('store');

    function draw(tab) {
      const c = document.getElementById('settingsContent');
      if (tab === 'store') c.innerHTML = storeForm(s);
      else if (tab === 'sales') c.innerHTML = salesForm(s);
      else if (tab === 'data') c.innerHTML = dataForm();
      bindHandlers(c, s, tab);
    }
  }

  function storeForm(s) {
    return `
      <div class="card">
        <h3 class="card-title mb-3">بيانات المتجر</h3>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">اسم المتجر</label>
            <input class="form-control" id="set_storeName" value="${App.escapeHtml(s.storeName || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">هاتف المتجر</label>
            <input class="form-control" id="set_storePhone" value="${App.escapeHtml(s.storePhone || '')}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">عنوان المتجر</label>
          <textarea class="form-control" id="set_storeAddress" rows="2">${App.escapeHtml(s.storeAddress || '')}</textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">رمز الدولة لواتساب</label>
            <input class="form-control" id="set_waCode" value="${App.escapeHtml(s.whatsappCountryCode || '20')}" placeholder="20 لمصر">
          </div>
          <div class="form-group">
            <label class="form-label">رمز العملة</label>
            <input class="form-control" id="set_currencySymbol" value="${App.escapeHtml(s.currencySymbol || 'ج.م')}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">رمز العملة (ISO)</label>
            <input class="form-control" id="set_currency" value="${App.escapeHtml(s.currency || 'EGP')}">
          </div>
          <div class="form-group">
            <label class="form-label">شعار المتجر (URL أو Base64)</label>
            <input class="form-control" id="set_storeLogo" value="${App.escapeHtml(s.storeLogo || '')}" placeholder="https://... أو data:image/...">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">سياسة الإرجاع</label>
          <textarea class="form-control" id="set_returnPolicy" rows="2">${App.escapeHtml(s.returnPolicy || '')}</textarea>
        </div>
        <button class="btn btn-primary" id="set_saveStore">حفظ بيانات المتجر</button>
      </div>
    `;
  }

  function salesForm(s) {
    return `
      <div class="card">
        <h3 class="card-title mb-3">إعدادات البيع</h3>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">نسبة الضريبة (%)</label>
            <input type="number" step="0.01" min="0" class="form-control" id="set_taxRate" value="${s.taxRate ?? 0}">
          </div>
          <div class="form-group">
            <label class="form-label">السعر يشمل الضريبة؟</label>
            <select class="form-control" id="set_taxInclusive">
              <option value="false" ${!s.taxInclusive ? 'selected' : ''}>لا — تُضاف الضريبة للسعر</option>
              <option value="true" ${s.taxInclusive ? 'selected' : ''}>نعم — السعر يشمل الضريبة</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">بادئة رقم الفاتورة</label>
            <input class="form-control" id="set_invoicePrefix" value="${App.escapeHtml(s.invoicePrefix || 'INV-')}">
          </div>
          <div class="form-group">
            <label class="form-label">رقم الفاتورة التالي</label>
            <input type="number" min="1" class="form-control" id="set_nextInvoiceNumber" value="${s.nextInvoiceNumber ?? 1}">
          </div>
          <div class="form-group">
            <label class="form-label">عدد أرقام التسلسل</label>
            <input type="number" min="1" max="8" class="form-control" id="set_invoicePadding" value="${s.invoicePadding ?? 4}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">طريقة الدفع الافتراضية</label>
            <select class="form-control" id="set_defaultPaymentMethod">
              <option value="cash" ${s.defaultPaymentMethod === 'cash' ? 'selected' : ''}>نقدي</option>
              <option value="vodafone_cash" ${s.defaultPaymentMethod === 'vodafone_cash' ? 'selected' : ''}>فودافون كاش</option>
              <option value="instapay" ${s.defaultPaymentMethod === 'instapay' ? 'selected' : ''}>إنستا باي</option>
              <option value="bank" ${s.defaultPaymentMethod === 'bank' ? 'selected' : ''}>تحويل بنكي</option>
              <option value="credit" ${s.defaultPaymentMethod === 'credit' ? 'selected' : ''}>آجل</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">صيغة الفاتورة الافتراضية</label>
            <select class="form-control" id="set_defaultInvoiceFormat">
              <option value="a4" ${s.defaultInvoiceFormat === 'a4' ? 'selected' : ''}>A4</option>
              <option value="thermal" ${s.defaultInvoiceFormat === 'thermal' ? 'selected' : ''}>حرارية 80mm</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">الحد الأدنى الافتراضي للمخزون</label>
            <input type="number" min="0" class="form-control" id="set_defaultMinStock" value="${s.defaultMinStock ?? 5}">
          </div>
          <div class="form-group">
            <label class="form-label">أيام تنبيه الانتهاء</label>
            <input type="number" min="0" class="form-control" id="set_expirationWarningDays" value="${s.expirationWarningDays ?? 14}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label"><input type="checkbox" class="form-check" id="set_allowNegativeStock" ${s.allowNegativeStock ? 'checked' : ''}> السماح بالبيع من مخزون سالب</label>
          <div class="form-hint">تحذير: قد يؤدي لسلبيات في المخزون وتأثير على الدقة المحاسبية.</div>
        </div>
        <div class="form-group">
          <label class="form-label"><input type="checkbox" class="form-check" id="set_weightedAvgCost" ${s.weightedAvgCost !== false ? 'checked' : ''}> استخدام متوسط التكلفة الموزون</label>
          <div class="form-hint">عند تفعيله، يُحدّث سعر شراء المنتج كمتوسط موزون عند كل عملية شراء. عند إيقافه يُستخدم آخر سعر شراء.</div>
        </div>
        <button class="btn btn-primary" id="set_saveSales">حفظ إعدادات البيع</button>
      </div>
    `;
  }

  function dataForm() {
    return `
      <div class="card mb-4">
        <h3 class="card-title mb-3">استيراد وتصدير المنتجات</h3>
        <div class="quick-actions">
          <div class="quick-action" onclick="ImportExport.downloadTemplate()">
            <div class="quick-action-icon"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg></div>
            <div><div class="quick-action-label">تنزيل القالب</div><div class="quick-action-sub">Excel فارغ بالأعمدة الصحيحة</div></div>
          </div>
          <div class="quick-action" onclick="ImportExport.startImport()">
            <div class="quick-action-icon"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/></svg></div>
            <div><div class="quick-action-label">استيراد منتجات</div><div class="quick-action-sub">من Excel / CSV</div></div>
          </div>
          <div class="quick-action" onclick="ImportExport.exportProducts()">
            <div class="quick-action-icon"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/></svg></div>
            <div><div class="quick-action-label">تصدير المنتجات</div><div class="quick-action-sub">ملف Excel</div></div>
          </div>
          <div class="quick-action" onclick="ImportExport.exportAll()">
            <div class="quick-action-icon"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h18v18H3z"/><path d="M3 9h18M9 3v18"/></svg></div>
            <div><div class="quick-action-label">تصدير شامل</div><div class="quick-action-sub">ملف Excel متعدد الأوراق</div></div>
          </div>
        </div>
      </div>

      <div class="card mb-4">
        <h3 class="card-title mb-3">تصدير أقسام منفصلة</h3>
        <div class="flex" style="flex-wrap:wrap; gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="ImportExport.exportInvoices()">الفواتير</button>
          <button class="btn btn-secondary btn-sm" onclick="ImportExport.exportInventory()">المخزون</button>
          <button class="btn btn-secondary btn-sm" onclick="ImportExport.exportMovements()">حركات المخزون</button>
          <button class="btn btn-secondary btn-sm" onclick="ImportExport.exportPurchases()">المشتريات</button>
          <button class="btn btn-secondary btn-sm" onclick="ImportExport.exportCustomers()">العملاء</button>
          <button class="btn btn-secondary btn-sm" onclick="ImportExport.exportSuppliers()">الموردون</button>
          <button class="btn btn-secondary btn-sm" onclick="ImportExport.exportExpenses()">المصروفات</button>
        </div>
      </div>

      <div class="card mb-4">
        <h3 class="card-title mb-3">النسخ الاحتياطي والاستعادة</h3>
        <p class="text-muted mb-3">قم بإنشاء نسخة احتياطية كاملة من بياناتك أو استعدها من ملف سابق. النسخة تشمل كل المنتجات والفواتير والعملاء والإعدادات.</p>
        <div class="flex" style="flex-wrap:wrap; gap:8px">
          <button class="btn btn-primary" onclick="Backup.create()">إنشاء نسخة احتياطية</button>
          <button class="btn btn-secondary" onclick="Backup.restore()">استعادة من نسخة</button>
        </div>
      </div>

      <div class="card" style="border-color: var(--red-500)">
        <h3 class="card-title mb-3" style="color: var(--red-600)">منطقة الخطر</h3>
        <div class="flex-col gap-lg">
          <div class="flex-between" style="padding:14px; background: var(--bg-subtle); border-radius: var(--radius)">
            <div>
              <div class="text-bold">حذف كل البيانات</div>
              <div class="text-sm text-muted">سيتم حذف كل المنتجات والفواتير والعملاء والإعدادات نهائياً.</div>
            </div>
            <button class="btn btn-danger" id="set_deleteAll">حذف كل البيانات</button>
          </div>
        </div>
      </div>
    `;
  }

  function bindHandlers(c, s, tab) {
    if (tab === 'store') {
      App.$('#set_saveStore', c).addEventListener('click', async () => {
        const obj = {
          storeName: App.$('#set_storeName', c).value,
          storePhone: App.$('#set_storePhone', c).value,
          storeAddress: App.$('#set_storeAddress', c).value,
          whatsappCountryCode: App.$('#set_waCode', c).value,
          currency: App.$('#set_currency', c).value,
          currencySymbol: App.$('#set_currencySymbol', c).value,
          storeLogo: App.$('#set_storeLogo', c).value,
          returnPolicy: App.$('#set_returnPolicy', c).value,
        };
        await App.saveSettings(obj);
        App.toast.success('تم حفظ بيانات المتجر.');
      });
    } else if (tab === 'sales') {
      App.$('#set_saveSales', c).addEventListener('click', async () => {
        const obj = {
          taxRate: Number(App.$('#set_taxRate', c).value || 0),
          taxInclusive: App.$('#set_taxInclusive', c).value === 'true',
          invoicePrefix: App.$('#set_invoicePrefix', c).value,
          nextInvoiceNumber: Number(App.$('#set_nextInvoiceNumber', c).value || 1),
          invoicePadding: Number(App.$('#set_invoicePadding', c).value || 4),
          defaultPaymentMethod: App.$('#set_defaultPaymentMethod', c).value,
          defaultInvoiceFormat: App.$('#set_defaultInvoiceFormat', c).value,
          defaultMinStock: Number(App.$('#set_defaultMinStock', c).value || 5),
          expirationWarningDays: Number(App.$('#set_expirationWarningDays', c).value || 14),
          allowNegativeStock: App.$('#set_allowNegativeStock', c).checked,
          weightedAvgCost: App.$('#set_weightedAvgCost', c).checked,
        };
        await App.saveSettings(obj);
        App.toast.success('تم حفظ إعدادات البيع.');
      });
    } else if (tab === 'data') {
      App.$('#set_deleteAll', c).addEventListener('click', () => {
        App.confirm({
          title: 'تأكيد حذف كل البيانات',
          message: 'سيتم حذف جميع المنتجات والفواتير والعملاء والإعدادات نهائياً. لا يمكن التراجع. يُنصح بإنشاء نسخة احتياطية أولاً. هل أنت متأكد؟',
          confirmText: 'نعم، احذف كل شيء',
          onConfirm: async () => {
            App.confirm({
              title: 'تأكيد أخير',
              message: 'هذا الإجراء نهائي ولا يمكن التراجع عنه. تأكيد الحذف؟',
              confirmText: 'حذف نهائي',
              onConfirm: async () => {
                for (const store of Object.keys(DB.STORES)) {
                  await DB.clear(store);
                }
                await DB.saveSettings(DB.SETTINGS_DEFAULTS);
                App.toast.success('تم حذف كل البيانات.');
                App.navigate('dashboard');
                App.refreshAlertsBadge();
              },
            });
          },
        });
      });
    }
  }

  return { render };
})();
