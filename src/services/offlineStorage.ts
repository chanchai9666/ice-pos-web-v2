import type {
  Product,
  Category,
  Customer,
  Sale,
  User,
  ARAgingItem,
} from "../types/api.ts";

export interface CachedCashier {
  id: string;
  username: string;
  display_name?: string;
  full_name?: string;
  role: string;
  is_active: boolean;
  pin_hash: string;
  updated_at: string;
}

const DB_NAME = "ice_pos_db";
const DB_VERSION = 2;

const STORES = {
  PRODUCTS: "products",
  CATEGORIES: "categories",
  CUSTOMERS: "customers",
  OFFLINE_SALES: "offline_sales",
  SYNC_META: "sync_meta",
  CASHIERS: "cashiers",
  USERS: "users",
  AR_AGING: "ar_aging",
} as const;

// LocalStorage keys for fallback / migration
const LS_CATALOG_KEY = "ice_pos_cached_catalog";
const LS_CUSTOMERS_KEY = "ice_pos_cached_customers";
const LS_OFFLINE_SALES_KEY = "ice_pos_offline_sales";
const LS_LAST_SYNC_KEY = "ice_pos_last_sync_time";
const LS_USERS_KEY = "ice_pos_cached_users";
const LS_AR_AGING_KEY = "ice_pos_cached_ar_aging";

/**
 * SHA-256 hash helper with salt using native Web Crypto API
 */
export async function hashPin(pin: string): Promise<string> {
  if (
    typeof window === "undefined" ||
    !window.crypto ||
    !window.crypto.subtle
  ) {
    // Basic fallback for non-browser environments
    let hash = 0;
    const str = `ice_pos_salt_${pin}`;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(64, "0");
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(`ice_pos_salt_${pin}`);
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// In-memory cache for synchronous instant access
interface MemoryCache {
  products: Product[];
  categories: Category[];
  customers: Customer[];
  offlineSales: Sale[];
  lastSyncTime: string | null;
  cashiers: CachedCashier[];
  users: User[];
  arAging: ARAgingItem[];
  isHydrated: boolean;
}

const memCache: MemoryCache = {
  products: [],
  categories: [],
  customers: [],
  offlineSales: [],
  lastSyncTime: null,
  cashiers: [],
  users: [],
  arAging: [],
  isHydrated: false,
};

// Open and initialize IndexedDB database
function openDB(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORES.PRODUCTS)) {
        db.createObjectStore(STORES.PRODUCTS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.CATEGORIES)) {
        db.createObjectStore(STORES.CATEGORIES, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.CUSTOMERS)) {
        db.createObjectStore(STORES.CUSTOMERS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.OFFLINE_SALES)) {
        db.createObjectStore(STORES.OFFLINE_SALES, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.SYNC_META)) {
        db.createObjectStore(STORES.SYNC_META, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(STORES.CASHIERS)) {
        const cashierStore = db.createObjectStore(STORES.CASHIERS, {
          keyPath: "id",
        });
        cashierStore.createIndex("pin_hash", "pin_hash", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.USERS)) {
        db.createObjectStore(STORES.USERS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.AR_AGING)) {
        db.createObjectStore(STORES.AR_AGING, { keyPath: "customer_id" });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
      };
      resolve(db);
    };
    request.onblocked = () => {
      console.warn("IndexedDB upgrade blocked by another open tab in Safari");
    };
    request.onerror = () => {
      console.error("IndexedDB open error:", request.error);
      resolve(null);
    };
  });
}

// Initial hydration from LocalStorage and IndexedDB
if (typeof window !== "undefined") {
  try {
    const cat = localStorage.getItem(LS_CATALOG_KEY);
    if (cat) {
      const parsed = JSON.parse(cat);
      memCache.products = parsed.products || [];
      memCache.categories = parsed.categories || [];
    }
    const cust = localStorage.getItem(LS_CUSTOMERS_KEY);
    if (cust) {
      memCache.customers = JSON.parse(cust) || [];
    }
    const sales = localStorage.getItem(LS_OFFLINE_SALES_KEY);
    if (sales) {
      memCache.offlineSales = JSON.parse(sales) || [];
    }
    const users = localStorage.getItem(LS_USERS_KEY);
    if (users) {
      memCache.users = JSON.parse(users) || [];
    }
    const arAging = localStorage.getItem(LS_AR_AGING_KEY);
    if (arAging) {
      memCache.arAging = JSON.parse(arAging) || [];
    }
    memCache.lastSyncTime = localStorage.getItem(LS_LAST_SYNC_KEY);
  } catch (e) {
    console.warn("Failed to load initial memory cache from localStorage:", e);
  }

  // Hydrate from IndexedDB in background
  openDB().then(async (db) => {
    if (!db) return;

    const requiredStores = [
      STORES.PRODUCTS,
      STORES.CATEGORIES,
      STORES.CUSTOMERS,
      STORES.OFFLINE_SALES,
      STORES.SYNC_META,
      STORES.CASHIERS,
      STORES.USERS,
      STORES.AR_AGING,
    ];

    // Safari guard: only query stores that actually exist on this db instance
    const availableStores = requiredStores.filter((name) =>
      db.objectStoreNames.contains(name)
    );

    if (availableStores.length === 0) return;

    try {
      const tx = db.transaction(availableStores, "readonly");

      const getAll = <T>(storeName: string): Promise<T[]> => {
        if (!db.objectStoreNames.contains(storeName)) {
          return Promise.resolve([]);
        }
        return new Promise((res) => {
          try {
            const req = tx.objectStore(storeName).getAll();
            req.onsuccess = () => res(req.result || []);
            req.onerror = () => res([]);
          } catch {
            res([]);
          }
        });
      };

      const [prods, cats, custs, sales, meta, cashiers, users, arAging] =
        await Promise.all([
          getAll<Product>(STORES.PRODUCTS),
          getAll<Category>(STORES.CATEGORIES),
          getAll<Customer>(STORES.CUSTOMERS),
          getAll<Sale>(STORES.OFFLINE_SALES),
          getAll<{ key: string; value: string }>(STORES.SYNC_META),
          getAll<CachedCashier>(STORES.CASHIERS),
          getAll<User>(STORES.USERS),
          getAll<ARAgingItem>(STORES.AR_AGING),
        ]);

      if (prods.length > 0) memCache.products = prods;
      if (cats.length > 0) memCache.categories = cats;
      if (custs.length > 0) memCache.customers = custs;
      if (sales.length > 0) memCache.offlineSales = sales;
      if (cashiers.length > 0) memCache.cashiers = cashiers;
      if (users.length > 0) memCache.users = users;
      if (arAging.length > 0) memCache.arAging = arAging;

      const syncMeta = meta.find((m) => m.key === "last_sync_time");
      if (syncMeta) memCache.lastSyncTime = syncMeta.value;

      memCache.isHydrated = true;

      // Migrate localStorage data into IndexedDB if IndexedDB was empty
      if (prods.length === 0 && memCache.products.length > 0) {
        offlineStorage.saveCatalog(memCache.products, memCache.categories);
      }
      if (custs.length === 0 && memCache.customers.length > 0) {
        offlineStorage.saveCustomers(memCache.customers);
      }
      if (sales.length === 0 && memCache.offlineSales.length > 0) {
        for (const s of memCache.offlineSales) {
          offlineStorage.queueOfflineSale(s);
        }
      }
      if (users.length === 0 && memCache.users.length > 0) {
        offlineStorage.saveUsers(memCache.users);
      }
      if (arAging.length === 0 && memCache.arAging.length > 0) {
        offlineStorage.saveARAging(memCache.arAging);
      }
    } catch (err) {
      console.warn("IndexedDB background hydration error:", err);
    }
  });
}

function notifyStorageChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("storage"));
  }
}

export const offlineStorage = {
  // --- Catalog Methods ---
  async saveCatalogAsync(
    products: Product[],
    categories: Category[]
  ): Promise<void> {
    memCache.products = products;
    memCache.categories = categories;

    // Keep localStorage in sync for instant boot fallback
    try {
      localStorage.setItem(
        LS_CATALOG_KEY,
        JSON.stringify({ products, categories })
      );
    } catch {
      // Ignore quota errors in localStorage
    }

    const db = await openDB();
    if (
      !db ||
      !db.objectStoreNames.contains(STORES.PRODUCTS) ||
      !db.objectStoreNames.contains(STORES.CATEGORIES)
    ) {
      return;
    }

    return new Promise((resolve) => {
      const tx = db.transaction(
        [STORES.PRODUCTS, STORES.CATEGORIES],
        "readwrite"
      );
      const prodStore = tx.objectStore(STORES.PRODUCTS);
      const catStore = tx.objectStore(STORES.CATEGORIES);

      prodStore.clear();
      catStore.clear();

      for (const p of products) {
        prodStore.put(p);
      }
      for (const c of categories) {
        catStore.put(c);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        console.error("Failed to save catalog to IndexedDB:", tx.error);
        resolve();
      };
    });
  },

  saveCatalog(products: Product[], categories: Category[]): void {
    memCache.products = products;
    memCache.categories = categories;
    this.saveCatalogAsync(products, categories).catch(console.error);
  },

  getCatalog(): { products: Product[]; categories: Category[] } {
    return {
      products: memCache.products,
      categories: memCache.categories,
    };
  },

  async getCatalogAsync(): Promise<{
    products: Product[];
    categories: Category[];
  }> {
    const db = await openDB();
    if (!db) return this.getCatalog();

    return new Promise((resolve) => {
      const tx = db.transaction(
        [STORES.PRODUCTS, STORES.CATEGORIES],
        "readonly"
      );
      const prodsReq = tx.objectStore(STORES.PRODUCTS).getAll();
      const catsReq = tx.objectStore(STORES.CATEGORIES).getAll();

      tx.oncomplete = () => {
        const products = prodsReq.result || [];
        const categories = catsReq.result || [];
        if (products.length > 0) memCache.products = products;
        if (categories.length > 0) memCache.categories = categories;
        resolve({ products, categories });
      };
      tx.onerror = () => resolve(this.getCatalog());
    });
  },

  // --- Customers Methods ---
  async saveCustomersAsync(customers: Customer[]): Promise<void> {
    memCache.customers = customers;
    try {
      localStorage.setItem(LS_CUSTOMERS_KEY, JSON.stringify(customers));
    } catch {
      // Ignore quota errors in localStorage
    }

    const db = await openDB();
    if (!db || !db.objectStoreNames.contains(STORES.CUSTOMERS)) {
      return;
    }

    return new Promise((resolve) => {
      const tx = db.transaction([STORES.CUSTOMERS], "readwrite");
      const store = tx.objectStore(STORES.CUSTOMERS);
      store.clear();
      for (const c of customers) {
        store.put(c);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        console.error("Failed to save customers to IndexedDB:", tx.error);
        resolve();
      };
    });
  },

  saveCustomers(customers: Customer[]): void {
    memCache.customers = customers;
    this.saveCustomersAsync(customers).catch(console.error);
  },

  getCustomers(): Customer[] {
    return memCache.customers;
  },

  async getCustomersAsync(): Promise<Customer[]> {
    const db = await openDB();
    if (!db || !db.objectStoreNames.contains(STORES.CUSTOMERS)) {
      return this.getCustomers();
    }

    return new Promise((resolve) => {
      const tx = db.transaction([STORES.CUSTOMERS], "readonly");
      const req = tx.objectStore(STORES.CUSTOMERS).getAll();
      req.onsuccess = () => {
        const custs = req.result || [];
        if (custs.length > 0) memCache.customers = custs;
        resolve(custs);
      };
      req.onerror = () => resolve(this.getCustomers());
    });
  },

  // --- Offline Sales Methods ---
  async queueOfflineSaleAsync(sale: Sale): Promise<void> {
    const existingIndex = memCache.offlineSales.findIndex(
      (s) => s.id === sale.id
    );
    if (existingIndex >= 0) {
      memCache.offlineSales[existingIndex] = sale;
    } else {
      memCache.offlineSales.push(sale);
    }

    try {
      localStorage.setItem(
        LS_OFFLINE_SALES_KEY,
        JSON.stringify(memCache.offlineSales)
      );
    } catch {
      // Ignore quota errors
    }
    notifyStorageChanged();

    const db = await openDB();
    if (!db || !db.objectStoreNames.contains(STORES.OFFLINE_SALES)) {
      return;
    }

    return new Promise((resolve) => {
      const tx = db.transaction([STORES.OFFLINE_SALES], "readwrite");
      tx.objectStore(STORES.OFFLINE_SALES).put(sale);
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        console.error("Failed to put offline sale into IndexedDB:", tx.error);
        resolve();
      };
    });
  },

  queueOfflineSale(sale: Sale): void {
    this.queueOfflineSaleAsync(sale).catch(console.error);
  },

  getOfflineSales(): Sale[] {
    return memCache.offlineSales;
  },

  async getOfflineSalesAsync(): Promise<Sale[]> {
    const db = await openDB();
    if (!db || !db.objectStoreNames.contains(STORES.OFFLINE_SALES)) {
      return this.getOfflineSales();
    }

    return new Promise((resolve) => {
      const tx = db.transaction([STORES.OFFLINE_SALES], "readonly");
      const req = tx.objectStore(STORES.OFFLINE_SALES).getAll();
      req.onsuccess = () => {
        const sales = req.result || [];
        memCache.offlineSales = sales;
        resolve(sales);
      };
      req.onerror = () => resolve(this.getOfflineSales());
    });
  },

  async removeOfflineSaleAsync(saleId: string): Promise<void> {
    memCache.offlineSales = memCache.offlineSales.filter(
      (s) => s.id !== saleId
    );
    try {
      localStorage.setItem(
        LS_OFFLINE_SALES_KEY,
        JSON.stringify(memCache.offlineSales)
      );
    } catch {
      // Ignore
    }
    notifyStorageChanged();

    const db = await openDB();
    if (!db || !db.objectStoreNames.contains(STORES.OFFLINE_SALES)) {
      return;
    }

    return new Promise((resolve) => {
      const tx = db.transaction([STORES.OFFLINE_SALES], "readwrite");
      tx.objectStore(STORES.OFFLINE_SALES).delete(saleId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  },

  removeOfflineSale(saleId: string): void {
    this.removeOfflineSaleAsync(saleId).catch(console.error);
  },

  async clearOfflineSalesAsync(): Promise<void> {
    memCache.offlineSales = [];
    try {
      localStorage.removeItem(LS_OFFLINE_SALES_KEY);
    } catch {
      // Ignore
    }
    notifyStorageChanged();

    const db = await openDB();
    if (!db || !db.objectStoreNames.contains(STORES.OFFLINE_SALES)) {
      return;
    }

    return new Promise((resolve) => {
      const tx = db.transaction([STORES.OFFLINE_SALES], "readwrite");
      tx.objectStore(STORES.OFFLINE_SALES).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  },

  clearOfflineSales(): void {
    this.clearOfflineSalesAsync().catch(console.error);
  },

  // --- Sync Metadata ---
  setLastSyncTime(timeIso: string): void {
    memCache.lastSyncTime = timeIso;
    try {
      localStorage.setItem(LS_LAST_SYNC_KEY, timeIso);
    } catch {
      // Ignore
    }

    openDB().then((db) => {
      if (!db || !db.objectStoreNames.contains(STORES.SYNC_META)) return;
      const tx = db.transaction([STORES.SYNC_META], "readwrite");
      tx.objectStore(STORES.SYNC_META).put({
        key: "last_sync_time",
        value: timeIso,
      });
    });
  },

  getLastSyncTime(): string | null {
    return memCache.lastSyncTime;
  },

  // --- Cashier Offline Auth Methods ---
  async saveCashier(cashier: CachedCashier): Promise<void> {
    const existingIdx = memCache.cashiers.findIndex((c) => c.id === cashier.id);
    if (existingIdx >= 0) {
      memCache.cashiers[existingIdx] = cashier;
    } else {
      memCache.cashiers.push(cashier);
    }

    const db = await openDB();
    if (!db || !db.objectStoreNames.contains(STORES.CASHIERS)) {
      return;
    }

    return new Promise((resolve) => {
      const tx = db.transaction([STORES.CASHIERS], "readwrite");
      tx.objectStore(STORES.CASHIERS).put(cashier);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  },

  async findCashierByPinHash(pinHash: string): Promise<User | null> {
    // Check in-memory cashiers first
    const match = memCache.cashiers.find((c) => c.pin_hash === pinHash);
    if (match) {
      return {
        id: match.id,
        username: match.username,
        display_name: match.display_name,
        full_name: match.full_name,
        role: match.role,
        is_active: match.is_active,
      };
    }

    const db = await openDB();
    if (!db || !db.objectStoreNames.contains(STORES.CASHIERS)) {
      return null;
    }

    return new Promise((resolve) => {
      const tx = db.transaction([STORES.CASHIERS], "readonly");
      const store = tx.objectStore(STORES.CASHIERS);
      const index = store.index("pin_hash");
      const req = index.get(pinHash);

      req.onsuccess = () => {
        const found = req.result as CachedCashier | undefined;
        if (found) {
          resolve({
            id: found.id,
            username: found.username,
            display_name: found.display_name,
            full_name: found.full_name,
            role: found.role,
            is_active: found.is_active,
          });
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  },

  async getAllCashiers(): Promise<CachedCashier[]> {
    const db = await openDB();
    if (!db || !db.objectStoreNames.contains(STORES.CASHIERS)) {
      return memCache.cashiers;
    }

    return new Promise((resolve) => {
      const tx = db.transaction([STORES.CASHIERS], "readonly");
      const req = tx.objectStore(STORES.CASHIERS).getAll();
      req.onsuccess = () => {
        const cashiers = req.result || [];
        memCache.cashiers = cashiers;
        resolve(cashiers);
      };
      req.onerror = () => resolve(memCache.cashiers);
    });
  },

  // --- Users Methods ---
  async saveUsersAsync(users: User[]): Promise<void> {
    memCache.users = users;
    try {
      localStorage.setItem(LS_USERS_KEY, JSON.stringify(users));
    } catch {
      // Ignore
    }

    const db = await openDB();
    if (!db || !db.objectStoreNames.contains(STORES.USERS)) {
      return;
    }

    return new Promise((resolve) => {
      const tx = db.transaction([STORES.USERS], "readwrite");
      const store = tx.objectStore(STORES.USERS);
      store.clear();
      for (const u of users) {
        store.put(u);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  },

  saveUsers(users: User[]): void {
    memCache.users = users;
    this.saveUsersAsync(users).catch(console.error);
  },

  getUsers(): User[] {
    return memCache.users;
  },

  async getUsersAsync(): Promise<User[]> {
    const db = await openDB();
    if (!db || !db.objectStoreNames.contains(STORES.USERS)) {
      return this.getUsers();
    }

    return new Promise((resolve) => {
      const tx = db.transaction([STORES.USERS], "readonly");
      const req = tx.objectStore(STORES.USERS).getAll();
      req.onsuccess = () => {
        const users = req.result || [];
        if (users.length > 0) memCache.users = users;
        resolve(users);
      };
      req.onerror = () => resolve(this.getUsers());
    });
  },

  // --- AR Aging Methods ---
  async saveARAgingAsync(items: ARAgingItem[]): Promise<void> {
    memCache.arAging = items;
    try {
      localStorage.setItem(LS_AR_AGING_KEY, JSON.stringify(items));
    } catch {
      // Ignore
    }

    const db = await openDB();
    if (!db || !db.objectStoreNames.contains(STORES.AR_AGING)) {
      return;
    }

    return new Promise((resolve) => {
      const tx = db.transaction([STORES.AR_AGING], "readwrite");
      const store = tx.objectStore(STORES.AR_AGING);
      store.clear();
      for (const item of items) {
        store.put(item);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  },

  saveARAging(items: ARAgingItem[]): void {
    memCache.arAging = items;
    this.saveARAgingAsync(items).catch(console.error);
  },

  getARAging(): ARAgingItem[] {
    return memCache.arAging;
  },

  async getARAgingAsync(): Promise<ARAgingItem[]> {
    const db = await openDB();
    if (!db || !db.objectStoreNames.contains(STORES.AR_AGING)) {
      return this.getARAging();
    }

    return new Promise((resolve) => {
      const tx = db.transaction([STORES.AR_AGING], "readonly");
      const req = tx.objectStore(STORES.AR_AGING).getAll();
      req.onsuccess = () => {
        const items = req.result || [];
        if (items.length > 0) memCache.arAging = items;
        resolve(items);
      };
      req.onerror = () => resolve(this.getARAging());
    });
  },
};
