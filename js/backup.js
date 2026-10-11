/* =========================================================================
   backup.js — JSON backup & restore
   ========================================================================= */

Backup = (() => {

  async function create() {
    try {
      App.toast.info('جاري إنشاء النسخة الاحتياطية…');
      const snapshot = await DB.exportAll();
      const settings = await DB.getSettings();
      snapshot.settings = settings;
      snapshot.__appVersion = '1.0.0';
      snapshot.__deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
      };
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const date = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
      const filename = `backup_${settings.storeName || 'store'}_${date}.json`.replace(/\s+/g, '_');
      App.download(filename, blob);
      await DB.saveSetting('lastBackupDate', new Date().toISOString());
      App.toast.success('تم إنشاء النسخة الاحتياطية.');
    } catch (e) {
      App.toast.error('فشل إنشاء النسخة: ' + e.message);
    }
  }

  function restore() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      if (!input.files.length) return;
      const file = input.files[0];
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.__type !== 'store-inventory-backup' || !data.data) {
          throw new Error('الملف ليس نسخة احتياطية صالحة.');
        }
        showRestorePreview(file.name, data);
      } catch (e) {
        App.toast.error('تعذّر قراءة الملف: ' + e.message);
      }
    };
    input.click();
  }

  function showRestorePreview(fileName, data) {
    const counts = Object.fromEntries(Object.keys(data.data).map(k => [k, data.data[k].length]));
    const body = App.el('div', {}, []);
    body.innerHTML = `
      <div class="card mb-4">
        <div class="text-bold text-lg">${App.escapeHtml(fileName)}</div>
        <div class="text-sm text-muted">تاريخ النسخة: ${data.__exportedAt ? App.fmtDate(data.__exportedAt, true) : '—'}</div>
        <div class="text-sm text-muted">إصدار المخطط: ${data.__version || '?'}</div>
      </div>
      <h4 class="text-bold mb-2">محتويات النسخة</h4>
      <div class="table-wrap mb-4">
        <table class="data">
          <thead><tr><th>القسم</th><th class="num">عدد السجلات</th></tr></thead>
          <tbody>
            ${Object.entries(counts).map(([k, v]) => `<tr><td>${sectionLabel(k)}</td><td class="num mono">${App.fmtNumber(v)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="card" style="border-color: var(--amber-600); background: #fffbeb">
        <div class="text-bold mb-2" style="color: var(--amber-600)">⚠️ تحذير</div>
        <p class="text-sm">سيتم إنشاء نسخة احتياطية تلقائية من بياناتك الحالية قبل الاستعادة. اختر طريقة الاستعادة:</p>
      </div>
      <div class="form-row mt-3">
        <div class="form-group">
          <label class="form-label">طريقة الاستعادة</label>
          <select class="form-control" id="restoreMode">
            <option value="replace" selected>استبدال كل البيانات الحالية</option>
            <option value="merge">دمج مع البيانات الحالية (تحديث بالمعرّف)</option>
          </select>
        </div>
      </div>
    `;
    const footer = [
      App.el('button', { class: 'btn btn-secondary', onclick: () => m.close() }, ['إلغاء']),
      App.el('button', { class: 'btn btn-danger', onclick: () => doRestore(data, body) }, ['تنفيذ الاستعادة']),
    ];
    const m = App.modal({ title: 'استعادة نسخة احتياطية', body, footer, size: 'sm' });
  }

  async function doRestore(data, bodyEl) {
    const mode = App.$('#restoreMode', bodyEl).value;
    App.toast.info('جاري إنشاء نسخة احتياطية وقائية…');
    try {
      // Auto-backup current data
      const currentBackup = await DB.exportAll();
      const blob = new Blob([JSON.stringify(currentBackup, null, 2)], { type: 'application/json' });
      const date = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
      App.download(`pre_restore_${date}.json`, blob);

      App.toast.info('جاري الاستعادة…');
      await DB.importAll(data, { merge: mode === 'merge' });
      // Restore settings too if present
      if (data.settings) {
        await DB.saveSettings(data.settings);
      }
      App.toast.success('تمت الاستعادة بنجاح.');
      App.closeModal();
      // Reload state
      App.state.settings = await DB.getSettings();
      App.refreshAlertsBadge();
      App.navigate(App.state.currentSection);
    } catch (e) {
      App.toast.error('فشلت الاستعادة: ' + e.message);
    }
  }

  function sectionLabel(k) {
    const m = {
      products: 'المنتجات', customers: 'العملاء', suppliers: 'الموردون',
      invoices: 'الفواتير', invoiceItems: 'عناصر الفواتير', payments: 'المدفوعات',
      purchases: 'المشتريات', purchaseItems: 'عناصر المشتريات',
      inventoryMoves: 'حركات المخزون', expenses: 'المصروفات',
      imports: 'سجل الاستيراد', settings: 'الإعدادات', meta: 'بيانات وصفية',
    };
    return m[k] || k;
  }

  return { create, restore };
})();
