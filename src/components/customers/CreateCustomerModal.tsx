"use client";

import React, { useState } from "react";
import { Customer } from "../../types/api.ts";
import { apiClient } from "../../services/apiClient.ts";
import { bahtToSatang } from "../../utils/currency.ts";
import { UserPlus, X, Save } from "lucide-react";
import { useToast } from "../../context/ToastContext.tsx";

interface CreateCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newCustomer: Customer) => void;
}

export const CreateCustomerModal: React.FC<CreateCustomerModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isMember, setIsMember] = useState(false);
  const [creditLimitBaht, setCreditLimitBaht] = useState<string>("0");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("กรุณากรอกชื่อลูกค้า");
      return;
    }

    setIsLoading(true);
    setError(null);

    const limitSatang = bahtToSatang(parseFloat(creditLimitBaht) || 0);

    try {
      const res = await apiClient.post<{ data: Customer; success: boolean }>(
        "/customers",
        {
          name: name.trim(),
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          is_member: isMember,
          initial_credit_limit: limitSatang,
          credit_limit: limitSatang,
        }
      );

      if (res && res.data) {
        toast.success("ลงทะเบียนลูกค้าใหม่เรียบร้อยแล้ว");
        onSuccess(res.data);
        onClose();
      } else {
        setError("ไม่สามารถลงทะเบียนลูกค้าได้");
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการสร้างลูกค้า";
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
            <UserPlus className="w-7 h-7 text-primary" />
            <h3 className="text-2xl font-black text-base-content">
              ลงทะเบียนลูกค้าใหม่
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="alert alert-error text-sm font-bold rounded-2xl py-2 px-4">
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="label text-base font-bold pb-1">
              ชื่อลูกค้า / บริษัท <span className="text-error">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ระบุชื่อลูกค้า..."
              className="input input-bordered w-full h-12 text-lg font-bold rounded-xl"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label text-base font-bold pb-1">
                เบอร์โทรศัพท์
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="เช่น 0812345678"
                className="input input-bordered w-full h-12 text-lg font-bold rounded-xl"
              />
            </div>
            <div>
              <label className="label text-base font-bold pb-1">อีเมล</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="optional@example.com"
                className="input input-bordered w-full h-12 text-base rounded-xl"
              />
            </div>
          </div>

          <div>
            <label className="label text-base font-bold pb-1">
              วงเงินเครดิตเริ่มต้น (บาท)
            </label>
            <input
              type="number"
              min="0"
              step="100"
              value={creditLimitBaht}
              onChange={(e) => setCreditLimitBaht(e.target.value)}
              placeholder="0.00"
              className="input input-bordered w-full h-12 text-lg font-black text-primary rounded-xl"
            />
            <p className="text-xs text-base-content/60 mt-1">
              ตั้งค่าเป็น 0 หากไม่ต้องการเปิดวงเงินเชื่อ
            </p>
          </div>

          <div className="form-control pt-1">
            <label className="label cursor-pointer justify-start gap-3">
              <input
                type="checkbox"
                checked={isMember}
                onChange={(e) => setIsMember(e.target.checked)}
                className="checkbox checkbox-primary rounded-lg"
              />
              <span className="label-text text-base font-bold">
                ลงทะเบียนเป็นสมาชิกสะสมแต้ม (Member)
              </span>
            </label>
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
              <span>บันทึกข้อมูล</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
