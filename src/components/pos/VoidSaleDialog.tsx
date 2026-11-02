"use client";

import React, { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

interface VoidSaleDialogProps {
  isOpen: boolean;
  saleNo: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  isLoading?: boolean;
}

export const VoidSaleDialog: React.FC<VoidSaleDialogProps> = ({
  isOpen,
  saleNo,
  onClose,
  onConfirm,
  isLoading = false,
}) => {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const quickReasons = [
    "ลูกค้าเปลี่ยนใจ / คืนสินค้า",
    "แคชเชียร์คีย์รายการผิดพลาด",
    "เปลี่ยนรายการสินค้าใหม่",
  ];

  const handleConfirm = async () => {
    if (!reason.trim()) {
      setError("กรุณาระบุเหตุผลในการยกเลิกบิล");
      return;
    }
    setError(null);
    await onConfirm(reason);
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="card bg-base-100 w-full max-w-lg border-2 border-error shadow-2xl rounded-3xl overflow-hidden p-6 space-y-5">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-error/15 text-error flex items-center justify-center shrink-0">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-error">
                ยกเลิกบิลขาย (Void)
              </h3>
              <p className="text-base font-bold text-base-content/70">
                เลขที่บิล:{" "}
                <span className="font-mono text-base-content">{saleNo}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="btn btn-ghost btn-circle btn-sm"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="alert alert-error text-sm font-bold rounded-xl py-2">
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-3">
          <label className="label text-base font-bold text-base-content">
            เลือกเหตุผลด่วน:
          </label>
          <div className="flex flex-wrap gap-2">
            {quickReasons.map((qr) => (
              <button
                key={qr}
                type="button"
                onClick={() => setReason(qr)}
                className={`btn btn-sm text-sm font-bold rounded-xl ${
                  reason === qr ? "btn-error text-white" : "btn-outline"
                }`}
              >
                {qr}
              </button>
            ))}
          </div>

          <div>
            <label className="label text-base font-bold text-base-content">
              หรือพิมพ์เหตุผลเพิ่มเติม:
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="ระบุเหตุผลในการขอยกเลิกบิล..."
              rows={3}
              className="textarea textarea-bordered w-full text-base font-medium rounded-xl border-2"
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="btn btn-outline flex-1 h-14 text-lg font-bold rounded-2xl"
          >
            ย้อนกลับ
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading || !reason.trim()}
            className="btn btn-error flex-1 h-14 text-xl font-black rounded-2xl text-white shadow-md active:scale-98"
          >
            {isLoading ? (
              <span className="loading loading-spinner"></span>
            ) : (
              "ยืนยันยกเลิกบิลนี้"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
