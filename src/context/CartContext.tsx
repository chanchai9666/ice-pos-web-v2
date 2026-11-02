"use client";

import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
} from "react";
import { Product, SaleItem } from "../types/api.ts";

interface CartContextType {
  items: SaleItem[];
  addItem: (product: Product, qty?: number) => void;
  removeItem: (productId: string) => void;
  updateQty: (productId: string, newQty: number) => void;
  clearCart: () => void;
  billDiscountSatang: number;
  setBillDiscountSatang: (discount: number) => void;
  subtotalSatang: number;
  grandTotalSatang: number;
  totalItemsCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [items, setItems] = useState<SaleItem[]>([]);
  const [billDiscountSatang, setBillDiscountSatang] = useState<number>(0);

  const addItem = useCallback((product: Product, qty: number = 1) => {
    setItems((prevItems) => {
      const existingIndex = prevItems.findIndex(
        (item) => item.product_id === product.id
      );

      if (existingIndex >= 0) {
        const nextItems = [...prevItems];
        const existing = nextItems[existingIndex];
        const updatedQty = existing.qty + qty;
        const gross_total = updatedQty * existing.unit_price;
        const net_total = gross_total - (existing.line_discount || 0);

        nextItems[existingIndex] = {
          ...existing,
          qty: updatedQty,
          gross_total,
          net_total,
        };
        return nextItems;
      }

      // Add new item
      const unit_price = product.price ?? product.unit_price ?? 0;
      const cost_price = product.cost_price || 0;
      const gross_total = qty * unit_price;
      const net_total = gross_total;

      const newItem: SaleItem = {
        product_id: product.id,
        product_name: product.name,
        product_code: product.code || product.barcode || "",
        unit_price,
        cost_price,
        qty,
        gross_total,
        line_discount: 0,
        net_total,
      };

      return [...prevItems, newItem];
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prevItems) =>
      prevItems.filter((item) => item.product_id !== productId)
    );
  }, []);

  const updateQty = useCallback(
    (productId: string, newQty: number) => {
      if (newQty <= 0) {
        removeItem(productId);
        return;
      }

      setItems((prevItems) =>
        prevItems.map((item) => {
          if (item.product_id === productId) {
            const gross_total = newQty * item.unit_price;
            const net_total = gross_total - (item.line_discount || 0);
            return {
              ...item,
              qty: newQty,
              gross_total,
              net_total,
            };
          }
          return item;
        })
      );
    },
    [removeItem]
  );

  const clearCart = useCallback(() => {
    setItems([]);
    setBillDiscountSatang(0);
  }, []);

  // Calculate totals
  const subtotalSatang = useMemo(() => {
    return items.reduce((acc, item) => acc + item.net_total, 0);
  }, [items]);

  const grandTotalSatang = useMemo(() => {
    return Math.max(0, subtotalSatang - billDiscountSatang);
  }, [subtotalSatang, billDiscountSatang]);

  const totalItemsCount = useMemo(() => {
    return items.reduce((acc, item) => acc + item.qty, 0);
  }, [items]);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQty,
        clearCart,
        billDiscountSatang,
        setBillDiscountSatang,
        subtotalSatang,
        grandTotalSatang,
        totalItemsCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};
