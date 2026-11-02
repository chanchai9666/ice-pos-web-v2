import { apiClient } from "./apiClient.ts";
import { offlineStorage } from "./offlineStorage.ts";
import {
  Category,
  Product,
  Customer,
  SyncChangesResponse,
  SyncBatchResponse,
} from "../types/api.ts";

export const syncService = {
  isOnline(): boolean {
    if (typeof window === "undefined") return true;
    return window.navigator.onLine;
  },

  /**
   * Pulls catalog updates from /sync/changes or fallback to /products and /categories
   */
  async pullCatalog(): Promise<{
    products: Product[];
    categories: Category[];
  }> {
    try {
      const since = offlineStorage.getLastSyncTime();
      const endpoint = since
        ? `/sync/changes?since=${encodeURIComponent(since)}`
        : "/sync/changes";

      const res = await apiClient.get<{
        data: SyncChangesResponse;
        success: boolean;
      }>(endpoint);
      if (res && res.data) {
        let products = res.data.products || [];
        let categories = res.data.categories || [];

        // If changes response was empty on initial load, fetch full list
        if (products.length === 0 && categories.length === 0 && !since) {
          const [prodRes, catRes] = await Promise.all([
            apiClient.get<{ data: Product[]; success: boolean }>(
              "/products?limit=200"
            ),
            apiClient.get<{ data: Category[]; success: boolean }>(
              "/categories"
            ),
          ]);
          products = prodRes.data || [];
          categories = catRes.data || [];
        }

        offlineStorage.saveCatalog(products, categories);
        if (res.data.server_time) {
          offlineStorage.setLastSyncTime(res.data.server_time);
        }
        return { products, categories };
      }
    } catch (err) {
      console.warn("Pull catalog from sync failed, using cached catalog:", err);
    }
    return offlineStorage.getCatalog();
  },

  /**
   * Pulls customers and caches them for offline credit sales
   */
  async pullCustomers(): Promise<Customer[]> {
    try {
      const res = await apiClient.get<{ data: Customer[]; success: boolean }>(
        "/customers"
      );
      if (res && res.data) {
        offlineStorage.saveCustomers(res.data);
        return res.data;
      }
    } catch (err) {
      console.warn("Pull customers failed, using cached list:", err);
    }
    return offlineStorage.getCustomers();
  },

  /**
   * Pushes offline sales queue to /sync/batch
   */
  async syncOfflineSales(): Promise<SyncBatchResponse | null> {
    const offlineSales = offlineStorage.getOfflineSales();
    if (offlineSales.length === 0) {
      return { synced_sales: 0, skipped_sales: 0, failed_sales: 0 };
    }

    try {
      const response = await apiClient.post<{
        data: SyncBatchResponse;
        success: boolean;
      }>("/sync/batch", {
        sales: offlineSales,
      });

      if (response && response.success) {
        offlineStorage.clearOfflineSales();
        return response.data;
      }
    } catch (err) {
      console.error("Batch sync failed:", err);
      throw err;
    }
    return null;
  },
};
