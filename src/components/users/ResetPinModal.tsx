"use client";

import React, { useState } from "react";
import { apiClient } from "../../services/apiClient.ts";
import { User } from "../../types/api.ts";
import { KeyRound, X, Save } from "lucide-react";
import { useToast } from "../../context/ToastContext.tsx";

interface ResetPinModalProps {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const ResetPinModal: React.FC<ResetPinModalProps> = ({
  isOpen,
  user,
  onClose,
  onSuccess,
}) => {
  const { toast } = useToast();
  const [newPin, setNewPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4,6}$/.test(newPin)) {
      setError("รหัส PIN ต้องเป็นตัวเลข 4 ถึง 6 หลัก");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await apiClient.post(`/users/${user.id}/reset-pin`, {
        new_pin: newPin,
      });

      toast.success(
        `รีเซ็ตรหัส PIN สำหรับ ${user.display_name || user.username} เรียบร้อยแล้ว`
      );
      setNewPin("");
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการรีเซ็ต PIN";
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
            <KeyRound className="w-7 h-7 text-primary" />
            <h3 className="text-2xl font-black text-base-content">
              รีเซ็ตรหัส PIN แคชเชียร์
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
              พนักงาน:
            </span>
            <div className="text-lg font-black text-base-content">
              {user.display_name || user.username} ({user.username})
            </div>
          </div>

          <div>
            <label className="label text-base font-bold pb-1">
              รหัส PIN ใหม่ (4-6 หลัก) <span className="text-error">*</span>
            </label>
            <input
              type="password"
              maxLength={6}
              required
              autoFocus
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
              placeholder="ตัวเลข 4-6 หลัก เช่น 9999"
              className="input input-bordered w-full h-14 text-2xl font-mono tracking-widest text-primary font-black rounded-xl"
            />
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
              <span>บันทึก PIN ใหม่</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
