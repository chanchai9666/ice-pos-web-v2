"use client";

import React, { useState, useEffect } from "react";
import { Customer } from "../../types/api.ts";
import { apiClient } from "../../services/apiClient.ts";
import { formatBaht, bahtToSatang } from "../../utils/currency.ts";
import { DollarSign, X, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "../../context/ToastContext.tsx";

interface PayCreditModalProps {
  isOpen: boolean;
  customer: Customer | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const PayCreditModal: React.FC<PayCreditModalProps> = ({
  isOpen,
  customer,
  onClose,
  onSuccess,
}) => {
  const { toast } = useToast();
  const [amountBaht, setAmountBaht] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("CASH");
  const [note, setNote] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const outstandingSatang =
    customer?.credit_account?.outstanding_balance ??
    customer?.current_balance ??
    0;

  useEffect(() => {
    if (customer) {
      // Auto-fill full debt amount by default
      const debtBaht = (outstandingSatang / 100).toFixed(2);
      setAmountBaht(debtBaht);
      setNote("");
      setError(null);
    }
  }, [customer, outstandingSatang]);

  if (!isOpen || !customer) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amountBaht);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("กรุณากรอกจำนวนเงินที่ถูกต้อง");
      return;
    }

    const paySatang = bahtToSatang(parsedAmount);
    if (paySatang > outstandingSatang) {
      if (
        !window.confirm(
          `ยอดชำระ (${parsedAmount} บาท) มากกว่ายอดหนี้คงเหลือ (${(outstandingSatang / 100).toFixed(2)} บาท) ต้องการดำเนินการต่อหรือไม่?`
        )
      ) {
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    // Generate unique idempotency key
    const idempotencyKey = `pay-${customer.id}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    try {
      await apiClient.post(`/customers/${customer.id}/pay-credit`, {
        amount: paySatang,
        payment_method: paymentMethod,
        note: note.trim() || undefined,
        idempotency_key: idempotencyKey,
      });

      toast.success("บันทึกการรับชำระหนี้เรียบร้อยแล้ว");
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "เกิดข้อผิดพลาดในการบันทึกชำระหนี้";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="card bg-base-100 w-full max-w-lg border-2 border-base-300 shadow-2xl rounded-3xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b-2 border-base-200 flex justify-between items-center bg-base-200/50">
          <div className="flex items-center gap-2.5">
            <DollarSign className="w-7 h-7 text-success" />
            <div>
              <h3 className="text-2xl font-black text-base-content">
                รับชำระหนี้เงินเชื่อ
              </h3>
              <p className="text-xs text-base-content/60 font-semibold">
                ลูกค้า: {customer.name}{" "}
                {customer.phone ? `(${customer.phone})` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-circle btn-sm"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="alert alert-error text-sm font-bold rounded-2xl py-2 px-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Current Debt Card */}
          <div className="bg-error/10 border-2 border-error/30 rounded-2xl p-4 flex justify-between items-center">
            <div>
              <span className="text-sm font-bold text-error">
                ยอดหนี้คงค้างปัจจุบัน
              </span>
              <div className="text-3xl font-black text-error">
                {formatBaht(outstandingSatang)}
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                setAmountBaht((outstandingSatang / 100).toFixed(2))
              }
              className="btn btn-sm btn-outline btn-error font-bold rounded-xl"
            >
              จ่ายเต็มจำนวน
            </button>
          </div>

          {/* Amount Input */}
          <div>
            <label className="label text-base font-bold pb-1">
              จำนวนเงินที่รับชำระ (บาท) <span className="text-error">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              autoFocus
              value={amountBaht}
              onChange={(e) => setAmountBaht(e.target.value)}
              placeholder="0.00"
              className="input input-bordered w-full h-14 text-2xl font-black text-success rounded-xl"
            />
          </div>

          {/* Payment Method */}
          <div>
            <label className="label text-base font-bold pb-1">
              ช่องทางชำระ
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod("CASH")}
                className={`btn h-12 font-bold rounded-xl border-2 ${
                  paymentMethod === "CASH"
                    ? "btn-success text-success-content"
                    : "btn-outline"
                }`}
              >
                💵 เงินสด (CASH)
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("TRANSFER")}
                className={`btn h-12 font-bold rounded-xl border-2 ${
                  paymentMethod === "TRANSFER"
                    ? "btn-success text-success-content"
                    : "btn-outline"
                }`}
              >
                📱 โอนเงิน / QR (TRANSFER)
              </button>
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="label text-base font-bold pb-1">
              บันทึกช่วยจำ / หมายเหตุ
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เช่น ชำระบิลรอบเดือนที่แล้ว, โอนเข้าบัญชีกสิกร..."
              className="input input-bordered w-full h-11 text-sm rounded-xl"
            />
          </div>

          {/* Actions */}
          <div className="modal-action pt-4 border-t border-base-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="btn btn-ghost h-12 px-6 rounded-xl font-bold"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-success text-success-content h-12 px-6 rounded-xl font-black gap-2 shadow-sm"
            >
              {isLoading ? (
                <span className="loading loading-spinner loading-sm"></span>
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
              <span>ยืนยันการรับชำระ</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
