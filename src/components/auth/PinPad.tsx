"use client";

import React, { useState } from "react";
import { Delete, CheckCircle2 } from "lucide-react";

interface PinPadProps {
  onComplete: (pin: string) => void;
  isLoading?: boolean;
  maxLength?: number;
}

export const PinPad: React.FC<PinPadProps> = ({
  onComplete,
  isLoading = false,
  maxLength = 6,
}) => {
  const [pin, setPin] = useState<string>("");

  const handleDigit = (digit: string) => {
    if (isLoading) return;
    if (pin.length < maxLength) {
      const nextPin = pin + digit;
      setPin(nextPin);
      if (nextPin.length >= 4 && nextPin.length === maxLength) {
        onComplete(nextPin);
      }
    }
  };

  const handleDelete = () => {
    if (isLoading) return;
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (isLoading) return;
    setPin("");
  };

  const handleSubmit = () => {
    if (pin.length >= 4) {
      onComplete(pin);
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-sm mx-auto">
      {/* PIN display indicator */}
      <div className="flex justify-center items-center gap-3 sm:gap-4 my-3 sm:my-6">
        {Array.from({ length: maxLength }).map((_, index) => {
          const isFilled = index < pin.length;
          return (
            <div
              key={index}
              className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full border-3 transition-all duration-150 flex items-center justify-center ${
                isFilled
                  ? "bg-primary border-primary scale-110 shadow-md"
                  : "bg-base-200 border-base-content/30"
              }`}
            >
              {isFilled && (
                <div className="w-2.5 h-2.5 bg-primary-content rounded-full" />
              )}
            </div>
          );
        })}
      </div>

      {/* Numpad buttons: responsive touch target */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 w-full">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
          <button
            key={num}
            type="button"
            onClick={() => handleDigit(num)}
            disabled={isLoading}
            className="btn btn-outline h-14 sm:h-19 text-2xl sm:text-3xl font-extrabold rounded-2xl border-2 hover:bg-primary hover:text-white transition-all active:scale-95 shadow-sm"
          >
            {num}
          </button>
        ))}

        {/* Bottom row: Clear, 0, Delete */}
        <button
          type="button"
          onClick={handleClear}
          disabled={isLoading || pin.length === 0}
          className="btn btn-ghost h-14 sm:h-19 text-lg sm:text-xl font-bold rounded-2xl text-error hover:bg-error/10 active:scale-95"
          title="ล้างทั้งหมด"
        >
          ล้าง
        </button>

        <button
          type="button"
          onClick={() => handleDigit("0")}
          disabled={isLoading}
          className="btn btn-outline h-14 sm:h-19 text-2xl sm:text-3xl font-extrabold rounded-2xl border-2 hover:bg-primary hover:text-white transition-all active:scale-95 shadow-sm"
        >
          0
        </button>

        <button
          type="button"
          onClick={handleDelete}
          disabled={isLoading || pin.length === 0}
          className="btn btn-ghost h-14 sm:h-19 text-lg sm:text-xl font-bold rounded-2xl text-warning hover:bg-warning/10 active:scale-95 flex items-center justify-center"
          aria-label="ลบตัวเลขสุดท้าย"
        >
          <Delete className="w-6 h-6 sm:w-8 sm:h-8" />
        </button>
      </div>

      {/* Manual Submit Button when at least 4 digits entered */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isLoading || pin.length < 4}
        className="btn btn-primary w-full h-12 sm:h-16 mt-3 sm:mt-6 text-xl sm:text-2xl font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2.5 active:scale-98"
      >
        {isLoading ? (
          <span className="loading loading-spinner loading-lg"></span>
        ) : (
          <>
            <CheckCircle2 className="w-7 h-7" />
            <span>เข้าสู่ระบบ</span>
          </>
        )}
      </button>
    </div>
  );
};
