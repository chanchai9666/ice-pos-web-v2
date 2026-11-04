"use client";

import React, { useState, useMemo } from "react";
import { Product, Category } from "../../types/api.ts";
import { apiClient } from "../../services/apiClient.ts";
import { CategoryTabs } from "./CategoryTabs.tsx";
import { ProductCard } from "./ProductCard.tsx";
import { BarcodeScannerInput } from "./BarcodeScannerInput.tsx";
import { BarcodeScannerModal } from "../common/BarcodeScannerModal.tsx";
import { PackageX } from "lucide-react";
import { useToast } from "../../context/ToastContext.tsx";

interface ProductGridProps {
  products: Product[];
  categories: Category[];
  onAddToCart: (product: Product) => void;
  isLoading?: boolean;
}

export const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  categories,
  onAddToCart,
  isLoading = false,
}) => {
  const { toast } = useToast();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Barcode scan handler
  const handleScanBarcode = async (barcode: string): Promise<boolean> => {
    const trimmed = barcode.trim().toLowerCase();
    const found = products.find(
      (p) =>
        (p.barcode && p.barcode.toLowerCase() === trimmed) ||
        (p.code && p.code.toLowerCase() === trimmed) ||
        p.id === trimmed
    );

    if (found) {
      onAddToCart(found);
      return true;
    }

    // Fallback: If not found in local cache, query API directly
    try {
      const res = await apiClient.get<{ data: Product; success: boolean }>(
        `/products/barcode/${encodeURIComponent(barcode.trim())}`
      );
      if (res && res.data) {
        onAddToCart(res.data);
        return true;
      } else {
        toast.warning(`ไม่พบสินค้าสำหรับบาร์โค้ด: ${barcode}`);
        return false;
      }
    } catch {
      toast.warning(`ไม่พบสินค้าสำหรับบาร์โค้ด: ${barcode}`);
      return false;
    }
  };

  // Filter products by category & search query
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCategory = !activeCategory || p.category_id === activeCategory;
      const matchSearch =
        !searchQuery.trim() ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.barcode && p.barcode.includes(searchQuery)) ||
        (p.code && p.code.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchCategory && matchSearch;
    });
  }, [products, activeCategory, searchQuery]);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Search & Category Filter Row */}
      <div className="flex items-center gap-3 w-full">
        <div className="flex-1 min-w-0">
          <BarcodeScannerInput
            onScanBarcode={handleScanBarcode}
            onSearchChange={setSearchQuery}
            searchQuery={searchQuery}
            onOpenScanner={() => setIsScannerOpen(true)}
          />
        </div>
        <CategoryTabs
          categories={categories}
          activeCategory={activeCategory}
          onSelectCategory={setActiveCategory}
        />
      </div>

      {/* Products Grid */}
      <div className="flex-1 overflow-y-auto pr-1 pb-24 lg:pb-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-base-content/60">
            <span className="loading loading-spinner loading-lg text-primary"></span>
            <p className="text-xl font-bold">กำลังโหลดรายการสินค้า...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-base-content/50 border-2 border-dashed border-base-300 rounded-3xl p-6 text-center">
            <PackageX className="w-16 h-16 text-base-content/40" />
            <p className="text-2xl font-bold">ไม่พบสินค้าในหมวดหมู่นี้</p>
            <p className="text-base">
              ลองพิมพ์ค้นหาชื่อสินค้าอื่น หรือกดเลือกหมวดหมู่ทั้งหมด
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 pb-4">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={onAddToCart}
              />
            ))}
          </div>
        )}
      </div>

      {/* Barcode Camera Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onDetected={handleScanBarcode}
      />
    </div>
  );
};
