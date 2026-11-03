"use client";

import React, { useMemo } from "react";
import { Banknote, Sparkles } from "lucide-react";
import { getSmartCashSuggestions } from "../../utils/currency.ts";

interface BanknoteButtonsProps {
  totalBaht: number;
  currentAmount?: number;
  onSelectAmount: (amount: number) => void;
}

export const BanknoteButtons: React.FC<BanknoteButtonsProps> = ({
  totalBaht,
  currentAmount,
  onSelectAmount,
}) => {
  // Generate smart dynamic suggestions based on totalBaht
  const suggestions = useMemo(
    () => getSmartCashSuggestions(totalBaht),
    [totalBaht]
  );

  const isExactActive = currentAmount === totalBaht;

  return (
    <div className="flex flex-col gap-2.5 w-full">
      <div className="text-sm font-bold text-base-content/70 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Banknote className="w-5 h-5 text-primary" />
          <span>ปุ่มลัดธนบัตรและยอดคาดเดา</span>
        </div>
        <span className="text-xs font-semibold text-primary flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5" />
          คำนวณเงินสดอัตโนมัติ
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Exact amount button */}
        <button
          type="button"
          onClick={() => onSelectAmount(totalBaht)}
          className={`btn h-14 text-xl sm:text-2xl font-black rounded-2xl border-2 transition-all active:scale-95 ${
            isExactActive
              ? "btn-primary text-white border-primary shadow-md scale-101"
              : "btn-outline bg-base-100 text-base-content border-base-300 hover:bg-primary hover:border-primary hover:text-white"
          }`}
        >
          พอดี
        </button>

        {/* Dynamic smart suggestions */}
        {suggestions.map((amount) => {
          const isSelected = currentAmount === amount;
          return (
            <button
              key={amount}
              type="button"
              onClick={() => onSelectAmount(amount)}
              className={`btn h-14 text-xl sm:text-2xl font-black rounded-2xl border-2 transition-all active:scale-95 ${
                isSelected
                  ? "btn-primary text-white border-primary shadow-md scale-101"
                  : "btn-outline bg-base-100 text-base-content border-base-300 hover:bg-primary hover:border-primary hover:text-white"
              }`}
            >
              {amount.toLocaleString("th-TH")}
            </button>
          );
        })}
      </div>
    </div>
  );
};
