import { Product, Category, Customer, Sale } from "../types/api.ts";

const CATALOG_KEY = "ice_pos_cached_catalog";
const CUSTOMERS_KEY = "ice_pos_cached_customers";
const OFFLINE_SALES_KEY = "ice_pos_offline_sales";
const LAST_SYNC_KEY = "ice_pos_last_sync_time";

export const offlineStorage = {
  saveCatalog(products: Product[], categories: Category[]): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        CATALOG_KEY,
        JSON.stringify({ products, categories })
      );
    } catch (e) {
      console.error("Failed to cache catalog:", e);
    }
  },

  getCatalog(): { products: Product[]; categories: Category[] } {
    if (typeof window === "undefined") return { products: [], categories: [] };
    try {
      const data = localStorage.getItem(CATALOG_KEY);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error("Failed to read cached catalog:", e);
    }
    return { products: [], categories: [] };
  },

  saveCustomers(customers: Customer[]): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers));
    } catch (e) {
      console.error("Failed to cache customers:", e);
    }
  },

  getCustomers(): Customer[] {
    if (typeof window === "undefined") return [];
    try {
      const data = localStorage.getItem(CUSTOMERS_KEY);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error("Failed to read cached customers:", e);
    }
    return [];
  },

  queueOfflineSale(sale: Sale): void {
    if (typeof window === "undefined") return;
    try {
      const existing = this.getOfflineSales();
      existing.push(sale);
      localStorage.setItem(OFFLINE_SALES_KEY, JSON.stringify(existing));
    } catch (e) {
      console.error("Failed to queue offline sale:", e);
    }
  },

  getOfflineSales(): Sale[] {
    if (typeof window === "undefined") return [];
    try {
      const data = localStorage.getItem(OFFLINE_SALES_KEY);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error("Failed to read offline sales:", e);
    }
    return [];
  },

  removeOfflineSale(saleId: string): void {
    if (typeof window === "undefined") return;
    try {
      const existing = this.getOfflineSales().filter((s) => s.id !== saleId);
      localStorage.setItem(OFFLINE_SALES_KEY, JSON.stringify(existing));
    } catch (e) {
      console.error("Failed to remove offline sale:", e);
    }
  },

  clearOfflineSales(): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(OFFLINE_SALES_KEY);
    } catch (e) {
      console.error("Failed to clear offline sales:", e);
    }
  },

  setLastSyncTime(timeIso: string): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(LAST_SYNC_KEY, timeIso);
  },

  getLastSyncTime(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(LAST_SYNC_KEY);
  },
};
