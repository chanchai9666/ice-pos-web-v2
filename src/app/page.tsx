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
import { formatBaht } from "../utils/currency.ts";
import { ShoppingCart, ArrowRight } from "lucide-react";

function PosContent() {
  const router = useRouter();
  const { user, token, isLoading: isAuthLoading } = useAuth();
  const { addItem, totalItemsCount, grandTotalSatang, items } = useCart();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);

  // Modals state
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isDailySummaryOpen, setIsDailySummaryOpen] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
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

      {/* Main Cashier Workspace (Responsive Hybrid Layout) */}
      <main className="no-print flex-1 overflow-hidden p-2 sm:p-4 grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 relative">
        {/* Products Catalog & Scanner */}
        <section className="lg:col-span-7 xl:col-span-8 h-full overflow-hidden bg-base-100 border-2 border-base-300 rounded-3xl p-3 sm:p-4 shadow-xs flex flex-col">
          <ProductGrid
            products={products}
            categories={categories}
            onAddToCart={addItem}
            isLoading={isCatalogLoading}
          />
        </section>

        {/* Desktop Cart Sidebar (>= lg) */}
        <section className="hidden lg:flex lg:col-span-5 xl:col-span-4 h-full overflow-hidden flex-col">
          <CartSidebar onOpenCheckout={() => setIsCheckoutOpen(true)} />
        </section>
      </main>

      {/* Mobile Floating Cart Action Bar (< lg) */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 p-2.5 sm:p-3 bg-base-100/95 backdrop-blur-md border-t-2 border-base-300 shadow-2xl z-20 flex items-center justify-between gap-2.5">
        <button
          type="button"
          onClick={() => setIsMobileCartOpen(true)}
          className="flex items-center gap-2.5 text-left flex-1 min-w-0 p-1 rounded-xl active:bg-base-200"
        >
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <ShoppingCart className="w-5 h-5" />
            </div>
            {totalItemsCount > 0 && (
              <span className="badge badge-primary badge-sm absolute -top-1.5 -right-1.5 font-black px-1.5 py-0.5">
                {totalItemsCount}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] text-base-content/60 font-bold truncate">
              {totalItemsCount > 0
                ? `บิลปัจจุบัน (${totalItemsCount} ชิ้น)`
                : "ยังไม่มีสินค้าในบิล"}
            </div>
            <div className="text-base sm:text-lg font-black text-success leading-tight truncate">
              {formatBaht(grandTotalSatang)}
            </div>
          </div>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsMobileCartOpen(true)}
            className="btn btn-outline border-base-300 btn-md h-10 sm:h-11 px-3 font-black rounded-xl text-xs sm:text-sm bg-base-100"
          >
            ดูบิล
          </button>
          <button
            type="button"
            onClick={() => setIsCheckoutOpen(true)}
            disabled={items.length === 0}
            className="btn btn-success btn-md h-10 sm:h-11 px-3.5 font-black rounded-xl text-white text-xs sm:text-sm shadow-md flex items-center gap-1 cursor-pointer"
          >
            <span>💵 คิดเงิน</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Cart Sheet / Drawer (< lg) */}
      {isMobileCartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end p-2 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-base-100 rounded-3xl border-2 border-base-300 shadow-2xl h-[85vh] max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
            <CartSidebar
              onOpenCheckout={() => {
                setIsMobileCartOpen(false);
                setIsCheckoutOpen(true);
              }}
              onCloseMobile={() => setIsMobileCartOpen(false)}
            />
          </div>
        </div>
      )}

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
