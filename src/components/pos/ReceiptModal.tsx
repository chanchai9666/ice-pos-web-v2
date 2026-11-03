"use client";

import React from "react";
import { Receipt } from "../../types/api.ts";
import { ReceiptPrintView } from "./ReceiptPrintView.tsx";
import { Printer, CheckCircle, X } from "lucide-react";

interface ReceiptModalProps {
  isOpen: boolean;
  receipt: Receipt | null;
  onClose: () => void;
  isReprint?: boolean;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  receipt,
  onClose,
  isReprint = false,
}) => {
  if (!isOpen || !receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-xs">
      <div className="card bg-base-100 w-full max-w-md border-2 border-base-300 shadow-2xl rounded-3xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header (hidden in print) */}
        <div className="no-print p-4 sm:p-5 border-b-2 border-base-200 flex justify-between items-center bg-base-200/50">
          <div className="flex items-center gap-2">
            {isReprint ? (
              <>
                <Printer className="w-7 h-7 text-primary" />
                <h3 className="text-2xl font-black text-base-content">
                  พิมพ์ใบเสร็จซ้ำ
                </h3>
              </>
            ) : (
              <>
                <CheckCircle className="w-7 h-7 text-success" />
                <h3 className="text-2xl font-black text-base-content">
                  บันทึกการขายสำเร็จ
                </h3>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-circle btn-sm"
            aria-label="ปิด"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Receipt Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-base-200/30 flex justify-center">
          <ReceiptPrintView receipt={receipt} />
        </div>

        {/* Action Buttons (hidden in print) */}
        <div className="no-print p-4 sm:p-5 border-t-2 border-base-200 bg-base-100 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handlePrint}
            className="btn btn-primary flex-1 h-16 text-2xl font-black rounded-2xl shadow-md flex items-center justify-center gap-2 active:scale-98"
          >
            <Printer className="w-7 h-7" />
            <span>🖨️ สั่งพิมพ์ใบเสร็จ</span>
          </button>

          {isReprint ? (
            <button
              type="button"
              onClick={onClose}
              className="btn btn-outline h-16 px-8 text-xl font-bold rounded-2xl border-2"
            >
              ปิด
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="btn btn-outline h-16 px-6 text-xl font-bold rounded-2xl border-2"
            >
              เริ่มบิลใหม่
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
