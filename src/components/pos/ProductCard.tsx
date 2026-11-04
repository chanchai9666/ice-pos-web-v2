"use client";

import React from "react";
import { Product } from "../../types/api.ts";
import { formatBaht } from "../../utils/currency.ts";
import { PlusCircle } from "lucide-react";

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onAddToCart,
}) => {
  const priceSatang = product.price ?? product.unit_price ?? 0;

  return (
    <button
      type="button"
      onClick={() => onAddToCart(product)}
      className="card bg-base-100 hover:bg-base-200/80 active:scale-97 border-2 border-base-300 hover:border-primary p-3 sm:p-4 rounded-2xl shadow-sm hover:shadow-md transition-all text-left flex flex-col justify-between min-h-[100px] sm:min-h-[110px] w-full cursor-pointer relative overflow-hidden group"
      aria-label={`${product.name} ราคา ${formatBaht(priceSatang)}`}
    >
      <div className="flex justify-between items-start gap-1.5 sm:gap-2 w-full">
        <h3 className="text-base sm:text-xl font-black text-base-content line-clamp-2 leading-snug">
          {product.name}
        </h3>
        <PlusCircle className="w-5 h-5 sm:w-6 sm:h-6 text-primary/40 group-hover:text-primary shrink-0 transition-colors mt-0.5" />
      </div>

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline w-full mt-2 sm:mt-3 pt-1.5 sm:pt-2 border-t border-base-200 gap-0.5">
        <span className="text-[11px] sm:text-sm font-semibold text-base-content/60 truncate">
          {product.code ? `รหัส: ${product.code}` : "สินค้าทั่วไป"}
        </span>
        <span className="text-lg sm:text-2xl font-black text-primary whitespace-nowrap self-end sm:self-auto font-mono">
          {formatBaht(priceSatang)}
        </span>
      </div>
    </button>
  );
};
