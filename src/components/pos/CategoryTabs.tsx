"use client";

import React, { useState, useMemo } from "react";
import { Category } from "../../types/api.ts";
import { Layers, X, Check, ChevronDown } from "lucide-react";

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
  const [isOpen, setIsOpen] = useState(false);

  const activeCategoryName = useMemo(() => {
    if (!activeCategory) return null;
    return categories.find((c) => c.id === activeCategory)?.name || null;
  }, [categories, activeCategory]);

  return (
    <>
      {/* Category Modal Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`btn h-12 sm:h-14 px-3 sm:px-4 rounded-2xl border-2 font-bold shrink-0 flex items-center gap-1.5 sm:gap-2 cursor-pointer transition-all ${
          activeCategory !== null
            ? "btn-primary shadow-md"
            : "border-base-300 bg-base-100 hover:bg-base-200 text-base-content shadow-xs"
        }`}
        title="เลือกหมวดหมู่สินค้า"
      >
        <Layers className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
        <span className="text-xs sm:text-base font-black max-w-[85px] sm:max-w-[160px] truncate">
          {activeCategoryName ? activeCategoryName : "หมวดหมู่ทั้งหมด"}
        </span>
        {activeCategory !== null ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onSelectCategory(null);
            }}
            className="p-1 hover:bg-black/20 rounded-full cursor-pointer ml-0.5 transition-colors"
            title="ล้างตัวกรองหมวดหมู่"
          >
            <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </span>
        ) : (
          <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 opacity-70 shrink-0" />
        )}
      </button>

      {/* Category Selection Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="card bg-base-100 w-full max-w-xl border-2 border-base-300 shadow-2xl rounded-3xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="p-5 border-b-2 border-base-200 flex justify-between items-center bg-base-200/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Layers className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-base-content">
                    เลือกหมวดหมู่สินค้า
                  </h3>
                  <p className="text-sm text-base-content/60 font-medium">
                    แตะเลือกหมวดหมู่เพื่อกรองรายการสินค้า
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="btn btn-ghost btn-circle btn-sm text-base-content/60 hover:text-base-content cursor-pointer"
                aria-label="ปิด"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Category Grid */}
            <div className="p-5 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {/* All Categories Option */}
                <button
                  type="button"
                  onClick={() => {
                    onSelectCategory(null);
                    setIsOpen(false);
                  }}
                  className={`p-4 rounded-2xl border-2 font-bold text-left flex flex-col justify-between transition-all cursor-pointer min-h-[90px] ${
                    activeCategory === null
                      ? "border-primary bg-primary/10 text-primary shadow-xs ring-2 ring-primary/20"
                      : "border-base-200 bg-base-100 hover:border-base-300 hover:bg-base-200/50 text-base-content"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <Layers className="w-5 h-5" />
                    {activeCategory === null && (
                      <Check className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <span className="text-lg font-black mt-3">ทั้งหมด</span>
                </button>

                {/* Specific Categories */}
                {categories.map((cat) => {
                  const isActive = activeCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        onSelectCategory(cat.id);
                        setIsOpen(false);
                      }}
                      className={`p-4 rounded-2xl border-2 font-bold text-left flex flex-col justify-between transition-all cursor-pointer min-h-[90px] ${
                        isActive
                          ? "border-primary bg-primary/10 text-primary shadow-xs ring-2 ring-primary/20"
                          : "border-base-200 bg-base-100 hover:border-base-300 hover:bg-base-200/50 text-base-content"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="w-2.5 h-2.5 rounded-full bg-primary/40" />
                        {isActive && <Check className="w-5 h-5 text-primary" />}
                      </div>
                      <span
                        className="text-lg font-black mt-3 truncate w-full"
                        title={cat.name}
                      >
                        {cat.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
