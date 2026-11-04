"use client";

import React, { useState, useRef } from "react";
import { Barcode, X, Camera } from "lucide-react";

interface BarcodeScannerInputProps {
  onScanBarcode: (barcode: string) => void;
  onSearchChange: (query: string) => void;
  searchQuery: string;
  onOpenScanner?: () => void;
}

export const BarcodeScannerInput: React.FC<BarcodeScannerInputProps> = ({
  onScanBarcode,
  onSearchChange,
  searchQuery,
  onOpenScanner,
}) => {
  const [inputValue, setInputValue] = useState(searchQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = inputValue.trim();
      if (val) {
        onScanBarcode(val);
        // Clear after barcode scan
        setInputValue("");
        onSearchChange("");
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    onSearchChange(val);
  };

  const handleClear = () => {
    setInputValue("");
    onSearchChange("");
    inputRef.current?.focus();
  };

  return (
    <div className="relative w-full">
      <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none text-base-content/50">
        <Barcode className="w-5 h-5 sm:w-6 sm:h-6" />
      </div>

      <input
        ref={inputRef}
        type="text"
        autoFocus
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="ยิงบาร์โค้ด หรือค้นหา..."
        className={`input input-bordered w-full h-12 sm:h-14 pl-10 sm:pl-12 text-sm sm:text-lg font-bold rounded-2xl border-2 border-base-300 focus:border-primary focus:outline-none shadow-sm ${
          onOpenScanner
            ? inputValue
              ? "pr-20 sm:pr-32"
              : "pr-14 sm:pr-28"
            : inputValue
              ? "pr-10"
              : "pr-4"
        }`}
      />

      <div className="absolute inset-y-0 right-0 pr-2 sm:pr-3 flex items-center gap-1 sm:gap-1.5">
        {inputValue && (
          <button
            type="button"
            onClick={handleClear}
            className="p-1 sm:p-1.5 text-base-content/50 hover:text-base-content cursor-pointer rounded-lg hover:bg-base-200"
            aria-label="ล้างการค้นหา"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        )}
        {onOpenScanner && (
          <button
            type="button"
            onClick={onOpenScanner}
            className="btn btn-primary btn-sm h-8.5 px-2.5 sm:h-10 sm:px-3 rounded-xl flex items-center gap-1.5 font-bold shadow-sm"
            title="เปิดกล้องสแกนบาร์โค้ด"
          >
            <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline text-xs sm:text-sm">
              กล้องสแกน
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
