/* =========================================================================
   db.js — IndexedDB data layer
   Provides a centralized, promise-based CRUD API for all object stores.
   Stores: products, customers, suppliers, invoices, invoiceItems, payments,
           purchases, purchaseItems, inventoryMovements, expenses, imports, settings, meta
   ========================================================================= */

const DB = (() => {
  const DB_NAME = 'store-inventory-db';
  const DB_VERSION = 1;

  const STORES = {
    products:         { keyPath: 'id', indexes: [
      { name: 'sku', unique: true },
      { name: 'name', unique: false },
      { name: 'category', unique: false },
      { name: 'barcode', unique: false },
    ]},
    customers:        { keyPath: 'id', indexes: [
      { name: 'phone', unique: false },
      { name: 'name', unique: false },
    ]},
    suppliers:        { keyPath: 'id', indexes: [
      { name: 'name', unique: false },
      { name: 'phone', unique: false },
    ]},
    invoices:         { keyPath: 'id', indexes: [
      { name: 'number', unique: true },
      { name: 'customerId', unique: false },
      { name: 'date', unique: false },
      { name: 'status', unique: false },
    ]},
    invoiceItems:     { keyPath: 'id', indexes: [
      { name: 'invoiceId', unique: false },
      { name: 'productId', unique: false },
    ]},
    payments:         { keyPath: 'id', indexes: [
      { name: 'invoiceId', unique: false },
      { name: 'customerId', unique: false },
      { name: 'date', unique: false },
      { name: 'method', unique: false },
    ]},
    purchases:        { keyPath: 'id', indexes: [
      { name: 'number', unique: false },
      { name: 'supplierId', unique: false },
      { name: 'date', unique: false },
    ]},
    purchaseItems:    { keyPath: 'id', indexes: [
      { name: 'purchaseId', unique: false },
      { name: 'productId', unique: false },
    ]},
    inventoryMoves:   { keyPath: 'id', indexes: [
      { name: 'productId', unique: false },
      { name: 'date', unique: false },
      { name: 'type', unique: false },
      { name: 'batchId', unique: false },
    ]},
    expenses:         { keyPath: 'id', indexes: [
      { name: 'date', unique: false },
      { name: 'category', unique: false },
    ]},
    imports:          { keyPath: 'id', indexes: [
      { name: 'date', unique: false },
    ]},
    settings:         { keyPath: 'key' },
    meta:             { keyPath: 'key' },
  };

  let _db = null;

  function open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = req.result;
        for (const [name, cfg] of Object.entries(STORES)) {
          if (!db.objectStoreNames.contains(name)) {
            const store = db.createObjectStore(name, { keyPath: cfg.keyPath });
            (cfg.indexes || []).forEach(idx => {
              store.createIndex(idx.name, idx.name, { unique: !!idx.unique });
            });
          }
        }
      };
      req.onsuccess = () => { _db = req.result; resolve(_db); };
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('تم حظر فتح قاعدة البيانات. أغلق التبويبات الأخرى وأعد المحاولة.'));
    });
  }

  function db() {
    if (!_db) throw new Error('قاعدة البيانات غير مُهيّأة. استدعِ DB.open() أولاً.');
    return _db;
  }

  /* ----- Generic CRUD ----- */

  function _tx(store, mode = 'readonly') {
    const t = db().transaction(store, mode);
    return t.objectStore(store);
  }

  function _req(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function getAll(store, indexName, range) {
    const src = indexName ? _tx(store).index(indexName) : _tx(store);
    return _req(src.getAll(range));
  }

  function get(store, id) {
    return _req(_tx(store).get(id));
  }

  function put(store, value) {
    return _req(_tx(store, 'readwrite').put(value));
  }

  function bulkPut(store, values) {
    return new Promise((resolve, reject) => {
      const tx = db().transaction(store, 'readwrite');
      const os = tx.objectStore(store);
      values.forEach(v => os.put(v));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('تم إلغاء المعاملة.'));
    });
  }

  function remove(store, id) {
    return _req(_tx(store, 'readwrite').delete(id));
  }

  function clear(store) {
    return _req(_tx(store, 'readwrite').clear());
  }

  function count(store) {
    return _req(_tx(store).count());
  }

  function query(store, predicate) {
    return getAll(store).then(arr => arr.filter(predicate));
  }

  /* ----- Multi-store atomic transactions ----- */

  /**
   * Run a function inside a single transaction across multiple stores.
   * @param {string[]} stores  Stores to open.
   * @param {(txHelpers)=>Promise<any>} fn  Receives helper object with put/get/delete per store.
   */
  function transaction(stores, fn) {
    return new Promise((resolve, reject) => {
      const tx = db().transaction(stores, 'readwrite');
      const helpers = {};
      stores.forEach(s => {
        const os = tx.objectStore(s);
        helpers[s] = {
          get: (k) => os.get(k),
          put: (v) => os.put(v),
          delete: (k) => os.delete(k),
          store: os,
        };
      });
      let result;
      Promise.resolve(fn(helpers))
        .then(r => { result = r; })
        .catch(err => {
          try { tx.abort(); } catch (_) {}
          reject(err);
        });
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('تم إلغاء المعاملة.'));
    });
  }

  /* ----- Settings ----- */
  const SETTINGS_DEFAULTS = {
    storeName: 'متجري',
    storeLogo: '',
    storePhone: '',
    storeAddress: '',
    whatsappCountryCode: '20', // Egypt
    currency: 'EGP',
    currencySymbol: 'ج.م',
    taxRate: 0,
    taxInclusive: false,
    defaultDiscount: 0,
    defaultDiscountType: 'amount', // amount | percent
    defaultMinStock: 5,
    expirationWarningDays: 14,
    invoicePrefix: 'INV-',
    nextInvoiceNumber: 1,
    invoicePadding: 4,
    defaultPaymentMethod: 'cash',
    defaultInvoiceFormat: 'a4', // a4 | thermal
    receiptWidth: 80,
    returnPolicy: 'يمكن استبدال أو إرجاع المنتج خلال 7 أيام مع وجود الفاتورة.',
    allowNegativeStock: false,
    weightedAvgCost: true,
    lastBackupDate: null,
    schemaVersion: DB_VERSION,
    demoDataLoaded: false,
  };

  async function getSettings() {
    const rows = await getAll('settings');
    const obj = {};
    rows.forEach(r => { obj[r.key] = r.value; });
    return { ...SETTINGS_DEFAULTS, ...obj };
  }

  async function saveSetting(key, value) {
    await put('settings', { key, value });
    return value;
  }

  async function saveSettings(obj) {
    const entries = Object.entries(obj).map(([key, value]) => ({ key, value }));
    await bulkPut('settings', entries);
    return obj;
  }

  /* ----- Meta ----- */
  async function getMeta(key) {
    return get('meta', key);
  }
  async function setMeta(key, value) {
    await put('meta', { key, value });
    return value;
  }

  /* ----- ID generation ----- */
  function uid(prefix = '') {
    const ts = Date.now().toString(36);
    const r = Math.random().toString(36).slice(2, 8);
    return (prefix ? prefix + '_' : '') + ts + r;
  }

  async function nextInvoiceNumber() {
    const s = await getSettings();
    const n = s.nextInvoiceNumber || 1;
    const padded = String(n).padStart(s.invoicePadding || 4, '0');
    const num = (s.invoicePrefix || 'INV-') + padded;
    return num;
  }

  async function consumeInvoiceNumber() {
    const s = await getSettings();
    const n = s.nextInvoiceNumber || 1;
    const padded = String(n).padStart(s.invoicePadding || 4, '0');
    const num = (s.invoicePrefix || 'INV-') + padded;
    await saveSetting('nextInvoiceNumber', n + 1);
    return num;
  }

  /* ----- Backup & Restore (raw) ----- */
  async function exportAll() {
    const data = {};
    for (const name of Object.keys(STORES)) {
      data[name] = await getAll(name);
    }
    return {
      __type: 'store-inventory-backup',
      __version: DB_VERSION,
      __exportedAt: new Date().toISOString(),
      data,
    };
  }

  async function importAll(backup, { merge = false } = {}) {
    if (!backup || backup.__type !== 'store-inventory-backup' || !backup.data) {
      throw new Error('ملف النسخة الاحتياطية غير صالح أو تالف.');
    }
    const stores = Object.keys(STORES);
    if (!merge) {
      // Wipe then write
      await transaction(stores, async (h) => {
        stores.forEach(s => { h[s].store.clear(); });
      });
    }
    await transaction(stores, async (h) => {
      stores.forEach(s => {
        const rows = backup.data[s] || [];
        rows.forEach(r => { h[s].put(r); });
      });
    });
    return true;
  }

  /* ----- Public API ----- */
  return {
    DB_NAME, DB_VERSION, STORES, SETTINGS_DEFAULTS,
    open,
    getAll, get, put, bulkPut, remove, clear, count, query,
    transaction,
    getSettings, saveSetting, saveSettings,
    getMeta, setMeta,
    uid, nextInvoiceNumber, consumeInvoiceNumber,
    exportAll, importAll,
  };
})();
