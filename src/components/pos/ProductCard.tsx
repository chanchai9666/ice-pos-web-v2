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
  return (
    <button
      type="button"
      onClick={() => onAddToCart(product)}
      className="card bg-base-100 hover:bg-base-200/80 active:scale-97 border-2 border-base-300 hover:border-primary p-4 rounded-2xl shadow-sm hover:shadow-md transition-all text-left flex flex-col justify-between min-h-[110px] w-full cursor-pointer relative overflow-hidden group"
      aria-label={`${product.name} ราคา ${formatBaht(product.unit_price)}`}
    >
      <div className="flex justify-between items-start gap-2 w-full">
        <h3 className="text-xl sm:text-2xl font-black text-base-content line-clamp-2 leading-tight">
          {product.name}
        </h3>
        <PlusCircle className="w-7 h-7 text-primary/40 group-hover:text-primary shrink-0 transition-colors mt-0.5" />
      </div>

      <div className="flex justify-between items-baseline w-full mt-3 pt-2 border-t border-base-200">
        <span className="text-sm font-semibold text-base-content/60">
          {product.code ? `รหัส: ${product.code}` : "สินค้าทั่วไป"}
        </span>
        <span className="text-2xl sm:text-3xl font-black text-primary">
          {formatBaht(product.unit_price)}
        </span>
      </div>
    </button>
  );
};
