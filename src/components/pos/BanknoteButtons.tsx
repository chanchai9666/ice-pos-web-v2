"use client";

import React from "react";
import { Banknote } from "lucide-react";

interface BanknoteButtonsProps {
  totalBaht: number;
  onSelectAmount: (amount: number) => void;
}

export const BanknoteButtons: React.FC<BanknoteButtonsProps> = ({
  totalBaht,
  onSelectAmount,
}) => {
  // Suggest exact amount and next larger banknotes
  const commonBanknotes = [50, 100, 500, 1000];

  return (
    <div className="flex flex-col gap-2.5 w-full">
      <div className="text-sm font-bold text-base-content/70 flex items-center gap-1.5">
        <Banknote className="w-5 h-5 text-primary" />
        <span>ปุ่มลัดธนบัตรรับเงินด่วน</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Exact amount button */}
        <button
          type="button"
          onClick={() => onSelectAmount(totalBaht)}
          className="btn btn-primary h-14 text-xl font-black rounded-2xl shadow-sm active:scale-95"
        >
          พอดี ({totalBaht.toFixed(2)} ฿)
        </button>

        {commonBanknotes.map((note) => {
          const isHigher = note >= totalBaht;
          return (
            <button
              key={note}
              type="button"
              onClick={() => onSelectAmount(note)}
              className={`btn h-14 text-2xl font-black rounded-2xl border-2 shadow-xs transition-all active:scale-95 ${
                isHigher
                  ? "btn-outline bg-base-100 hover:bg-primary hover:text-white"
                  : "btn-outline opacity-70 bg-base-100"
              }`}
            >
              {note} ฿
            </button>
          );
        })}
      </div>
    </div>
  );
};
