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
    <div className="flex items-center justify-between p-3.5 bg-base-100 hover:bg-base-200/50 border border-base-300 rounded-2xl shadow-xs transition-colors gap-3">
      {/* Product Info */}
      <div className="flex-1 min-w-0">
        <h4 className="text-lg sm:text-xl font-black text-base-content truncate">
          {item.product_name}
        </h4>
        <div className="text-sm font-semibold text-base-content/60 mt-0.5">
          @{formatBaht(item.unit_price)}
        </div>
      </div>

      {/* Quantity Adjusters: Elderly 48x48px min touch target */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onUpdateQty(item.product_id, item.qty - 1)}
          className="btn btn-outline btn-square w-12 h-12 rounded-xl text-xl font-bold border-2 active:scale-95"
          aria-label={`ลดจำนวน ${item.product_name}`}
        >
          <Minus className="w-5 h-5" />
        </button>

        <span className="w-10 text-center text-2xl font-black text-base-content">
          {item.qty}
        </span>

        <button
          type="button"
          onClick={() => onUpdateQty(item.product_id, item.qty + 1)}
          className="btn btn-outline btn-square w-12 h-12 rounded-xl text-xl font-bold border-2 active:scale-95"
          aria-label={`เพิ่มจำนวน ${item.product_name}`}
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Item Total & Remove */}
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xl sm:text-2xl font-black text-primary text-right min-w-[75px]">
          {formatBaht(item.net_total)}
        </span>

        <button
          type="button"
          onClick={() => onRemove(item.product_id)}
          className="btn btn-ghost btn-square w-11 h-11 text-error/60 hover:text-error hover:bg-error/10 rounded-xl active:scale-95"
          aria-label={`ลบรายการ ${item.product_name}`}
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
