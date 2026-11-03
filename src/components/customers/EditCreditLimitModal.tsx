"use client";

import React, { useState, useEffect } from "react";
import { Customer } from "../../types/api.ts";
import { apiClient } from "../../services/apiClient.ts";
import { bahtToSatang } from "../../utils/currency.ts";
import { ShieldCheck, X, Save } from "lucide-react";
import { useToast } from "../../context/ToastContext.tsx";

interface EditCreditLimitModalProps {
  isOpen: boolean;
  customer: Customer | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditCreditLimitModal: React.FC<EditCreditLimitModalProps> = ({
  isOpen,
  customer,
  onClose,
  onSuccess,
}) => {
  const { toast } = useToast();
  const [limitBaht, setLimitBaht] = useState<string>("0");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (customer) {
      const currentLimitSatang =
        customer.credit_account?.credit_limit ?? customer.credit_limit ?? 0;
      setLimitBaht((currentLimitSatang / 100).toString());
      setError(null);
    }
  }, [customer]);

  if (!isOpen || !customer) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(limitBaht);
    if (isNaN(parsed) || parsed < 0) {
      setError("กรุณาระบุวงเงินที่ถูกต้อง (0 หรือมากกว่า)");
      return;
    }

    setIsLoading(true);
    setError(null);

    const limitSatang = bahtToSatang(parsed);

    try {
      await apiClient.put(`/customers/${customer.id}/credit-limit`, {
        credit_limit: limitSatang,
      });

      toast.success("ปรับปรุงวงเงินเครดิตเรียบร้อยแล้ว");
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการปรับวงเงิน";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="card bg-base-100 w-full max-w-md border-2 border-base-300 shadow-2xl rounded-3xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b-2 border-base-200 flex justify-between items-center bg-base-200/50">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-7 h-7 text-primary" />
            <h3 className="text-2xl font-black text-base-content">
              ปรับวงเงินเครดิต
            </h3>
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
            <div className="alert alert-error text-sm font-bold rounded-2xl py-2 px-4">
              <span>{error}</span>
            </div>
          )}

          <div>
            <span className="text-sm font-semibold text-base-content/70">
              ลูกค้า:
            </span>
            <div className="text-lg font-black text-base-content">
              {customer.name}
            </div>
          </div>

          <div>
            <label className="label text-base font-bold pb-1">
              วงเงินเครดิตใหม่ (บาท)
            </label>
            <input
              type="number"
              min="0"
              step="100"
              required
              autoFocus
              value={limitBaht}
              onChange={(e) => setLimitBaht(e.target.value)}
              placeholder="0.00"
              className="input input-bordered w-full h-14 text-2xl font-black text-primary rounded-xl"
            />
            <p className="text-xs text-base-content/60 mt-1">
              กำหนดเป็น 0 หากต้องการระงับการให้เครดิตชั่วคราว
            </p>
          </div>

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
              className="btn btn-primary h-12 px-6 rounded-xl font-black gap-2 shadow-sm"
            >
              {isLoading ? (
                <span className="loading loading-spinner loading-sm"></span>
              ) : (
                <Save className="w-5 h-5" />
              )}
              <span>บันทึกวงเงิน</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
