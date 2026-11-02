"use client";

import React from "react";
import { Delete, RotateCcw } from "lucide-react";

interface NumpadProps {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}

export const Numpad: React.FC<NumpadProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const handleDigit = (digit: string) => {
    if (disabled) return;
    if (digit === "." && value.includes(".")) return;
    onChange(value + digit);
  };

  const handleDelete = () => {
    if (disabled) return;
    onChange(value.slice(0, -1));
  };

  const handleClear = () => {
    if (disabled) return;
    onChange("");
  };

  return (
    <div className="flex flex-col gap-2.5 w-full">
      <div className="grid grid-cols-3 gap-2.5 w-full">
        {["7", "8", "9", "4", "5", "6", "1", "2", "3"].map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => handleDigit(digit)}
            disabled={disabled}
            className="btn btn-outline h-16 text-3xl font-black rounded-2xl border-2 hover:bg-primary hover:text-white transition-all active:scale-95 shadow-xs"
          >
            {digit}
          </button>
        ))}

        {/* Bottom row: ., 0, Delete */}
        <button
          type="button"
          onClick={() => handleDigit(".")}
          disabled={disabled || value.includes(".")}
          className="btn btn-outline h-16 text-4xl font-black rounded-2xl border-2 hover:bg-primary hover:text-white transition-all active:scale-95 shadow-xs"
          aria-label="จุดทศนิยม"
        >
          .
        </button>

        <button
          type="button"
          onClick={() => handleDigit("0")}
          disabled={disabled}
          className="btn btn-outline h-16 text-3xl font-black rounded-2xl border-2 hover:bg-primary hover:text-white transition-all active:scale-95 shadow-xs"
        >
          0
        </button>

        <button
          type="button"
          onClick={handleDelete}
          disabled={disabled || value === ""}
          className="btn btn-outline btn-warning h-16 text-xl font-bold rounded-2xl border-2 active:scale-95 flex items-center justify-center shadow-xs"
          aria-label="ลบตัวเลขสุดท้าย"
        >
          <Delete className="w-8 h-8" />
        </button>
      </div>

      {/* Clear All Button */}
      <button
        type="button"
        onClick={handleClear}
        disabled={disabled || value === ""}
        className="btn btn-ghost h-12 text-base font-bold rounded-xl text-error hover:bg-error/10 active:scale-95 w-full flex items-center justify-center gap-2"
      >
        <RotateCcw className="w-5 h-5" />
        <span>ล้างตัวเลขทั้งหมด (Clear)</span>
      </button>
    </div>
  );
};
