import { apiClient } from "./apiClient.ts";
import { offlineStorage } from "./offlineStorage.ts";
import {
  Category,
  Product,
  Customer,
  SyncChangesResponse,
  SyncBatchResponse,
} from "../types/api.ts";

let isSyncInProgress = false;

export const syncService = {
  isOnline(): boolean {
    if (typeof window === "undefined") return true;
    return window.navigator.onLine;
  },

  /**
   * Checks whether the backend API server is healthy and reachable on demand
   */
  async checkApiHealth(): Promise<boolean> {
    if (typeof window !== "undefined" && !window.navigator.onLine) {
      return false;
    }
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch("http://127.0.0.1:8080/api/v1/health", {
        method: "GET",
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timeoutId);
      return res.ok;
    } catch {
      return false;
    }
  },

  /**
   * Pulls catalog updates from /sync/changes or fallback to /products and /categories
   */
  async pullCatalog(): Promise<{
    products: Product[];
    categories: Category[];
  }> {
    try {
      const current = offlineStorage.getCatalog();
      const hasCachedProducts = current.products.length > 0;
      const since = hasCachedProducts ? offlineStorage.getLastSyncTime() : null;
      const endpoint = since
        ? `/sync/changes?since=${encodeURIComponent(since)}`
        : "/sync/changes";

      const res = await apiClient.get<{
        data: SyncChangesResponse;
        success: boolean;
      }>(endpoint);

      if (res && res.data) {
        const deltaProducts = res.data.products || [];
        const deltaCategories = res.data.categories || [];

        let finalProducts: Product[];
        let finalCategories: Category[];

        if (!hasCachedProducts || !since) {
          // If no cache or full sync, use delta or fallback to full list
          if (deltaProducts.length === 0 && deltaCategories.length === 0) {
            const [prodRes, catRes] = await Promise.all([
              apiClient.get<{ data: Product[]; success: boolean }>(
                "/products?limit=500"
              ),
              apiClient.get<{ data: Category[]; success: boolean }>(
                "/categories"
              ),
            ]);
            finalProducts = prodRes.data || [];
            finalCategories = catRes.data || [];
          } else {
            finalProducts = deltaProducts;
            finalCategories = deltaCategories;
          }
        } else {
          // Incremental sync: merge delta into existing cache
          const productMap = new Map<string, Product>(
            current.products.map((p) => [p.id, p])
          );
          for (const p of deltaProducts) {
            productMap.set(p.id, p);
          }
          finalProducts = Array.from(productMap.values());

          const categoryMap = new Map<string, Category>(
            current.categories.map((c) => [c.id, c])
          );
          for (const c of deltaCategories) {
            categoryMap.set(c.id, c);
          }
          finalCategories = Array.from(categoryMap.values());
        }

        // Save merged/full catalog
        if (finalProducts.length > 0 || finalCategories.length > 0) {
          offlineStorage.saveCatalog(finalProducts, finalCategories);
        }
        if (res.data.server_time) {
          offlineStorage.setLastSyncTime(res.data.server_time);
        }
        return { products: finalProducts, categories: finalCategories };
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
   * Pushes offline sales queue to /sync/batch with concurrency lock
   */
  async syncOfflineSales(): Promise<SyncBatchResponse | null> {
    if (isSyncInProgress) {
      return null;
    }

    const offlineSales = offlineStorage.getOfflineSales();
    if (offlineSales.length === 0) {
      return { synced_sales: 0, skipped_sales: 0, failed_sales: 0 };
    }

    isSyncInProgress = true;
    try {
      const response = await apiClient.post<{
        data: SyncBatchResponse;
        success: boolean;
      }>("/sync/batch", {
        sales: offlineSales,
      });

      if (response && response.success) {
        if (!response.data.failed_sales || response.data.failed_sales === 0) {
          offlineStorage.clearOfflineSales();
        } else {
          console.warn(
            "Some sales failed during batch sync, keeping queue for safety"
          );
        }
        return response.data;
      }
    } catch (err) {
      console.error("Batch sync failed:", err);
      throw err;
    } finally {
      isSyncInProgress = false;
    }
    return null;
  },
};
