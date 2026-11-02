"use client";

import React, { useState, useRef } from "react";
import { Barcode, X } from "lucide-react";

interface BarcodeScannerInputProps {
  onScanBarcode: (barcode: string) => void;
  onSearchChange: (query: string) => void;
  searchQuery: string;
}

export const BarcodeScannerInput: React.FC<BarcodeScannerInputProps> = ({
  onScanBarcode,
  onSearchChange,
  searchQuery,
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
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-base-content/50">
        <Barcode className="w-7 h-7" />
      </div>

      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="ยิงบาร์โค้ด หรือ พิมพ์ชื่อสินค้าเพื่อค้นหา..."
        className="input input-bordered w-full h-15 pl-14 pr-12 text-xl font-bold rounded-2xl border-2 border-base-300 focus:border-primary focus:outline-none shadow-sm"
      />

      {inputValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute inset-y-0 right-0 pr-4 flex items-center text-base-content/50 hover:text-base-content cursor-pointer"
          aria-label="ล้างการค้นหา"
        >
          <X className="w-6 h-6" />
        </button>
      )}
    </div>
  );
};
