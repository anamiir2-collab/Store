/* =========================================================================
   expenses.js — Expense tracking
   ========================================================================= */

Expenses = (() => {
  let view = { page: 1, perPage: 20, category: '', search: '' };

  async function render(container) {
    const expenses = await DB.getAll('expenses');
    expenses.sort((a, b) => new Date(b.date) - new Date(a.date));
    const total = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const byCategory = {};
    expenses.forEach(e => { byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount || 0); });

    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon red"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></div>
          <div class="stat-body"><div class="stat-label">إجمالي المصروفات</div><div class="stat-value">${App.fmtMoney(total)}</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon teal"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 6-6"/></svg></div>
          <div class="stat-body"><div class="stat-label">عدد السجلات</div><div class="stat-value">${App.fmtNumber(expenses.length)}</div></div>
        </div>
      </div>

      <div class="toolbar">
        <button class="btn btn-primary btn-sm" id="expAdd"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> مصروف جديد</button>
        <button class="btn btn-secondary btn-sm" onclick="ImportExport.exportExpenses()">تصدير Excel</button>
      </div>

      <div class="table-wrap">
        <div class="table-scroll">
          <table class="data">
            <thead><tr><th>التاريخ</th><th>الفئة</th><th>الوصف</th><th class="num">المبلغ</th><th>الطريقة</th><th class="center">إجراءات</th></tr></thead>
            <tbody>
              ${expenses.length ? expenses.slice(0, view.perPage).map(e => `<tr>
                <td>${App.fmtDate(e.date, true)}</td>
                <td><span class="chip chip-info">${App.escapeHtml(e.category)}</span></td>
                <td>${App.escapeHtml(e.description)}</td>
                <td class="num mono">${App.fmtMoney(e.amount)}</td>
                <td>${App.escapeHtml(e.method || '—')}</td>
                <td class="center">
                  <button class="icon-btn" data-edit="${e.id}"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                  <button class="icon-btn" data-del="${e.id}"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                </td>
              </tr>`).join('') : '<tr><td colspan="6" class="text-center text-muted">لا توجد مصروفات مسجلة.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;

    App.$('#expAdd', container).addEventListener('click', () => openForm());
    container.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openForm(b.dataset.edit)));
    container.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => onDelete(b.dataset.del)));
  }

  async function openForm(id) {
    const e = id ? await DB.get('expenses', id) : null;
    const body = App.el('div', {}, []);
    body.innerHTML = `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">التاريخ</label>
          <input type="date" class="form-control" id="e_date" value="${e?.date ? e.date.slice(0,10) : new Date().toISOString().slice(0,10)}">
        </div>
        <div class="form-group">
          <label class="form-label">الفئة <span class="req">*</span></label>
          <input class="form-control" id="e_cat" value="${App.escapeHtml(e?.category || '')}" list="expCats" placeholder="إيجار، رواتب، كهرباء...">
          <datalist id="expCats">
            <option value="إيجار"><option value="رواتب"><option value="كهرباء"><option value="مياه">
            <option value="مواصلات"><option value="تغليف"><option value="صيانة"><option value="ضرائب">
            <option value="تسويق"><option value="اتصالات"><option value="أخرى">
          </datalist>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">المبلغ <span class="req">*</span></label>
          <input type="number" step="0.01" min="0" class="form-control" id="e_amt" value="${e?.amount ?? ''}">
        </div>
        <div class="form-group">
          <label class="form-label">طريقة الدفع</label>
          <select class="form-control" id="e_method">
            <option value="cash" ${e?.method === 'cash' ? 'selected' : ''}>نقدي</option>
            <option value="bank" ${e?.method === 'bank' ? 'selected' : ''}>تحويل بنكي</option>
            <option value="vodafone_cash" ${e?.method === 'vodafone_cash' ? 'selected' : ''}>فودافون كاش</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">الوصف</label>
        <input class="form-control" id="e_desc" value="${App.escapeHtml(e?.description || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">ملاحظات</label>
        <textarea class="form-control" id="e_notes" rows="2">${App.escapeHtml(e?.notes || '')}</textarea>
      </div>
    `;
    const footer = [
      App.el('button', { class: 'btn btn-secondary', onclick: () => m.close() }, ['إلغاء']),
      App.el('button', { class: 'btn btn-primary', onclick: save }, [e ? 'حفظ' : 'إضافة']),
    ];
    const m = App.modal({ title: e ? 'تعديل مصروف' : 'مصروف جديد', body, footer, size: 'sm' });

    async function save() {
      const cat = App.$('#e_cat', body).value.trim();
      const amt = Number(App.$('#e_amt', body).value || 0);
      if (!cat) { App.toast.warn('الفئة مطلوبة.'); return; }
      if (amt <= 0) { App.toast.warn('المبلغ غير صالح.'); return; }
      const obj = {
        id: e?.id || DB.uid('exp'),
        date: new Date(App.$('#e_date', body).value).toISOString(),
        category: cat,
        description: App.$('#e_desc', body).value,
        amount: amt,
        method: App.$('#e_method', body).value,
        notes: App.$('#e_notes', body).value,
        createdAt: e?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await DB.put('expenses', obj);
      App.toast.success(e ? 'تم الحفظ.' : 'تمت الإضافة.');
      m.close();
      App.navigate('expenses');
    }
  }

  async function onDelete(id) {
    App.confirm({
      title: 'حذف المصروف', message: 'هل تريد حذف هذا المصروف؟',
      onConfirm: async () => {
        await DB.remove('expenses', id);
        App.toast.success('تم الحذف.');
        App.navigate('expenses');
      },
    });
  }

  return { render };
})();
