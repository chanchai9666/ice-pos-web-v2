"use client";

import React from "react";
import { Delete } from "lucide-react";

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

      {/* Bottom row: C, 0, Backspace */}
      <button
        type="button"
        onClick={handleClear}
        disabled={disabled || value === ""}
        className="btn btn-ghost h-16 text-2xl font-bold rounded-2xl text-error hover:bg-error/10 active:scale-95"
      >
        C
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
        className="btn btn-ghost h-16 text-xl font-bold rounded-2xl text-warning hover:bg-warning/10 active:scale-95 flex items-center justify-center"
        aria-label="ลบตัวเลขสุดท้าย"
      >
        <Delete className="w-8 h-8" />
      </button>
    </div>
  );
};
