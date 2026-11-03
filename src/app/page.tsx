"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext.tsx";
import { CartProvider, useCart } from "../context/CartContext.tsx";
import { Product, Category, Receipt } from "../types/api.ts";
import { syncService } from "../services/syncService.ts";
import { offlineStorage } from "../services/offlineStorage.ts";
import { apiClient } from "../services/apiClient.ts";
import { HeaderBar } from "../components/pos/HeaderBar.tsx";
import { ProductGrid } from "../components/pos/ProductGrid.tsx";
import { CartSidebar } from "../components/pos/CartSidebar.tsx";
import { CheckoutModal } from "../components/pos/CheckoutModal.tsx";
import { ReceiptModal } from "../components/pos/ReceiptModal.tsx";
import { SalesHistoryModal } from "../components/pos/SalesHistoryModal.tsx";
import { DailySummaryDrawer } from "../components/pos/DailySummaryDrawer.tsx";

function PosContent() {
  const router = useRouter();
  const { user, token, isLoading: isAuthLoading } = useAuth();
  const { addItem } = useCart();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);

  // Modals state
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isDailySummaryOpen, setIsDailySummaryOpen] = useState(false);
  const [completedReceipt, setCompletedReceipt] = useState<Receipt | null>(
    null
  );

  // Redirect to login if unauthenticated
  useEffect(() => {
    if (!isAuthLoading && !token) {
      router.push("/login");
    }
  }, [token, isAuthLoading, router]);

  // Load catalog data
  useEffect(() => {
    const loadCatalog = async () => {
      // First show cached data immediately for snappy UX
      const cached = offlineStorage.getCatalog();
      if (cached.products.length > 0) {
        setProducts(cached.products);
        setCategories(cached.categories);
        setIsCatalogLoading(false);
      }

      // Then pull fresh updates if online
      try {
        const fresh = await syncService.pullCatalog();
        if (fresh.products.length > 0) {
          setProducts(fresh.products);
          setCategories(fresh.categories);
        } else if (cached.products.length === 0) {
          // Direct fallback if both cache and sync returned empty
          const [prodRes, catRes] = await Promise.all([
            apiClient.get<{ data: Product[]; success: boolean }>(
              "/products?limit=500"
            ),
            apiClient.get<{ data: Category[]; success: boolean }>(
              "/categories"
            ),
          ]);
          if (prodRes && prodRes.data && prodRes.data.length > 0) {
            setProducts(prodRes.data);
            setCategories(catRes.data || []);
            offlineStorage.saveCatalog(prodRes.data, catRes.data || []);
          }
        }
      } catch (e) {
        console.warn("Could not fetch fresh catalog:", e);
      } finally {
        setIsCatalogLoading(false);
      }

      // Pre-cache customers, AR aging, and users
      syncService.pullCustomers().catch(() => {});
      syncService.pullARAging().catch(() => {});
      syncService.pullUsers().catch(() => {});
    };

    if (token) {
      loadCatalog();
    }
  }, [token]);

  const handleCheckoutSuccess = (receipt: Receipt) => {
    setCompletedReceipt(receipt);
  };

  if (isAuthLoading || (!token && !user)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-base-100">
        <span className="loading loading-spinner loading-lg text-primary"></span>
        <p className="text-xl font-bold text-base-content/70">
          กำลังตรวจสอบสิทธิ์การเข้าใช้งาน...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-base-200">
      {/* Top Header Navigation */}
      <HeaderBar
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenDailySummary={() => setIsDailySummaryOpen(true)}
      />

      {/* Main Cashier Workspace (Hybrid Layout) */}
      <main className="no-print flex-1 overflow-hidden p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4">
        {/* Left Column (60% ~ 7 cols): Products Catalog & Scanner */}
        <section className="lg:col-span-7 xl:col-span-8 h-full overflow-hidden bg-base-100 border-2 border-base-300 rounded-3xl p-3 sm:p-4 shadow-sm flex flex-col">
          <ProductGrid
            products={products}
            categories={categories}
            onAddToCart={addItem}
            isLoading={isCatalogLoading}
          />
        </section>

        {/* Right Column (40% ~ 5 cols): Cart & Checkout Action */}
        <section className="lg:col-span-5 xl:col-span-4 h-full overflow-hidden">
          <CartSidebar onOpenCheckout={() => setIsCheckoutOpen(true)} />
        </section>
      </main>

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        onSuccess={handleCheckoutSuccess}
      />

      {/* Receipt Modal */}
      <ReceiptModal
        isOpen={Boolean(completedReceipt)}
        receipt={completedReceipt}
        onClose={() => setCompletedReceipt(null)}
      />

      {/* Sales History & Direct Void Modal */}
      <SalesHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
      />

      {/* Daily Sales Summary Drawer */}
      <DailySummaryDrawer
        isOpen={isDailySummaryOpen}
        onClose={() => setIsDailySummaryOpen(false)}
      />
    </div>
  );
}

export default function HomePage() {
  return (
    <CartProvider>
      <PosContent />
    </CartProvider>
  );
}
