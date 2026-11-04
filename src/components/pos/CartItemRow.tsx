"use client";

import React from "react";
import { SaleItem } from "../../types/api.ts";
import { formatBaht } from "../../utils/currency.ts";
import { Plus, Minus, Trash2 } from "lucide-react";

interface CartItemRowProps {
  item: SaleItem;
  onUpdateQty: (productId: string, newQty: number) => void;
  onRemove: (productId: string) => void;
}

export const CartItemRow: React.FC<CartItemRowProps> = ({
  item,
  onUpdateQty,
  onRemove,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-3.5 bg-base-100 hover:bg-base-200/50 border border-base-300 rounded-2xl shadow-xs transition-colors gap-2.5 sm:gap-3">
      {/* Product Info & Mobile Trash Button */}
      <div className="flex items-start justify-between sm:block flex-1 min-w-0">
        <div className="min-w-0 pr-2">
          <h4 className="text-base sm:text-xl font-black text-base-content truncate">
            {item.product_name}
          </h4>
          <div className="text-xs sm:text-sm font-semibold text-base-content/60 mt-0.5 whitespace-nowrap">
            @{formatBaht(item.unit_price)}
          </div>
        </div>

        {/* Mobile Trash button (top-right of item card) */}
        <button
          type="button"
          onClick={() => onRemove(item.product_id)}
          className="sm:hidden btn btn-ghost btn-circle btn-sm text-error/60 hover:text-error hover:bg-error/10"
          aria-label={`ลบรายการ ${item.product_name}`}
        >
          <Trash2 className="w-4.5 h-4.5" />
        </button>
      </div>

      {/* Stepper & Total */}
      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-base-200/60">
        {/* Quantity Adjusters */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => onUpdateQty(item.product_id, item.qty - 1)}
            className="btn btn-outline btn-square w-9 h-9 sm:w-11 sm:h-11 rounded-xl text-lg font-bold border-2 active:scale-95"
            aria-label={`ลดจำนวน ${item.product_name}`}
          >
            <Minus className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <span className="w-8 sm:w-10 text-center text-lg sm:text-2xl font-black text-base-content font-mono">
            {item.qty}
          </span>

          <button
            type="button"
            onClick={() => onUpdateQty(item.product_id, item.qty + 1)}
            className="btn btn-outline btn-square w-9 h-9 sm:w-11 sm:h-11 rounded-xl text-lg font-bold border-2 active:scale-95"
            aria-label={`เพิ่มจำนวน ${item.product_name}`}
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Item Total & Desktop Trash */}
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-lg sm:text-2xl font-black text-primary text-right min-w-[70px] sm:min-w-[75px] font-mono whitespace-nowrap">
            {formatBaht(item.net_total)}
          </span>

          <button
            type="button"
            onClick={() => onRemove(item.product_id)}
            className="hidden sm:flex btn btn-ghost btn-square w-11 h-11 text-error/60 hover:text-error hover:bg-error/10 rounded-xl active:scale-95"
            aria-label={`ลบรายการ ${item.product_name}`}
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
