"use client";

import React from "react";
import { Category } from "../../types/api.ts";
import { Layers } from "lucide-react";

interface CategoryTabsProps {
  categories: Category[];
  activeCategory: string | null;
  onSelectCategory: (categoryId: string | null) => void;
}

export const CategoryTabs: React.FC<CategoryTabsProps> = ({
  categories,
  activeCategory,
  onSelectCategory,
}) => {
  return (
    <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none w-full">
      {/* All categories button */}
      <button
        type="button"
        onClick={() => onSelectCategory(null)}
        className={`btn h-14 px-6 text-lg font-black rounded-2xl border-2 transition-all shrink-0 cursor-pointer ${
          activeCategory === null
            ? "btn-primary shadow-md scale-102"
            : "btn-outline bg-base-100 hover:bg-base-200"
        }`}
      >
        <Layers className="w-5 h-5 mr-1" />
        <span>ทั้งหมด</span>
      </button>

      {/* Category buttons */}
      {categories.map((cat) => {
        const isActive = activeCategory === cat.id;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelectCategory(cat.id)}
            className={`btn h-14 px-6 text-lg font-black rounded-2xl border-2 transition-all shrink-0 cursor-pointer ${
              isActive
                ? "btn-primary shadow-md scale-102"
                : "btn-outline bg-base-100 hover:bg-base-200"
            }`}
          >
            {cat.name}
          </button>
        );
      })}
    </div>
  );
};
