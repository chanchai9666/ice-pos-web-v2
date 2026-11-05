"use client";

import React, { useRef, useEffect } from "react";
import { useCart } from "../../context/CartContext.tsx";
import { CartItemRow } from "./CartItemRow.tsx";
import { formatBaht } from "../../utils/currency.ts";
import { ShoppingCart, Trash2, ArrowRight, X } from "lucide-react";

interface CartSidebarProps {
  onOpenCheckout: () => void;
  onCloseMobile?: () => void;
}

export const CartSidebar: React.FC<CartSidebarProps> = ({
  onOpenCheckout,
  onCloseMobile,
}) => {
  const {
    items,
    updateQty,
    removeItem,
    clearCart,
    grandTotalSatang,
    totalItemsCount,
  } = useCart();

  const listContainerRef = useRef<HTMLDivElement>(null);
  const prevItemsLengthRef = useRef(items.length);

  useEffect(() => {
    // เลื่อนลงล่างสุดอัตโนมัติเมื่อมีรายการสินค้าใหม่เพิ่มเข้ามา
    if (items.length > prevItemsLengthRef.current) {
      const timer = setTimeout(() => {
        if (listContainerRef.current) {
          listContainerRef.current.scrollTo({
            top: listContainerRef.current.scrollHeight,
            behavior: "smooth",
          });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
    prevItemsLengthRef.current = items.length;
  }, [items.length]);

  return (
    <div className="card bg-base-100 border-2 border-base-300 shadow-lg rounded-3xl h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b-2 border-base-200 flex justify-between items-center bg-base-200/50">
        <div className="flex items-center gap-2.5">
          <ShoppingCart className="w-7 h-7 text-primary" />
          <h2 className="text-2xl font-black text-base-content">รายการบิล</h2>
          {totalItemsCount > 0 && (
            <span className="badge badge-primary text-base font-bold px-3 py-3 rounded-full">
              {totalItemsCount} ชิ้น
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {items.length > 0 && (
            <button
              type="button"
              onClick={clearCart}
              className="btn btn-ghost btn-sm text-error hover:bg-error/10 font-bold gap-1 rounded-xl"
              title="ล้างรายการทั้งหมดในบิล"
            >
              <Trash2 className="w-4 h-4" />
              <span>ล้างบิล</span>
            </button>
          )}
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="btn btn-ghost btn-square btn-sm rounded-xl lg:hidden text-base-content/70 hover:text-base-content"
              aria-label="ปิดรายการบิล"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Cart Items List */}
      <div
        ref={listContainerRef}
        className="flex-1 overflow-y-auto p-3.5 space-y-2.5"
      >
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-base-content/40 text-center p-6 gap-3">
            <ShoppingCart className="w-20 h-20 opacity-30" />
            <p className="text-2xl font-black">ยังไม่มีสินค้าในบิล</p>
            <p className="text-base font-medium">
              แตะเลือกสินค้าจากรายการ หรือยิงบาร์โค้ดเพื่อเริ่มคิดเงิน
            </p>
          </div>
        ) : (
          items.map((item) => (
            <CartItemRow
              key={item.product_id}
              item={item}
              onUpdateQty={updateQty}
              onRemove={removeItem}
            />
          ))
        )}
      </div>

      {/* Footer / Grand Total & Checkout CTA */}
      <div className="p-4 sm:p-5 border-t-2 border-base-200 bg-base-200/40 space-y-4">
        {/* Total Summary */}
        <div className="flex justify-between items-baseline">
          <span className="text-xl sm:text-2xl font-black text-base-content/80">
            ยอดรวมทั้งสิ้น:
          </span>
          <span className="text-3xl sm:text-4xl font-black text-success tracking-tight">
            {formatBaht(grandTotalSatang)}
          </span>
        </div>

        {/* Big Checkout Button for Elderly (h-18, text-2xl font-black) */}
        <button
          type="button"
          onClick={onOpenCheckout}
          disabled={items.length === 0}
          className="btn btn-success w-full h-18 text-2xl sm:text-3xl font-black rounded-2xl shadow-lg active:scale-98 text-white flex items-center justify-center gap-3 cursor-pointer"
        >
          <span>💵 กดชำระเงิน</span>
          <ArrowRight className="w-8 h-8" />
        </button>
      </div>
    </div>
  );
};
