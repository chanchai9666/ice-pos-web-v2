"use client";

import React, { useState } from "react";
import { apiClient } from "../../services/apiClient.ts";
import { User } from "../../types/api.ts";
import { UserPlus, X, Save } from "lucide-react";
import { useToast } from "../../context/ToastContext.tsx";

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateUserModal: React.FC<CreateUserModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !displayName.trim()) {
      setError("กรุณากรอกชื่อผู้ใช้และชื่อที่แสดง");
      return;
    }
    if (password.length < 4) {
      setError("รหัสผ่านต้องมีความยาวอย่างน้อย 4 ตัวอักษร");
      return;
    }
    if (!/^\d{4,6}$/.test(pin)) {
      setError("รหัส PIN ต้องเป็นตัวเลข 4 ถึง 6 หลัก สำหรับล็อกอินหน้าร้าน");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await apiClient.post<{ data: User; success: boolean }>("/users", {
        username: username.trim(),
        display_name: displayName.trim(),
        password,
        pin,
      });

      toast.success("สร้างบัญชีผู้ใช้งานแคชเชียร์เรียบร้อยแล้ว");
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการสร้างบัญชี";
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
              สร้างบัญชีแคชเชียร์ใหม่
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
              ชื่อผู้ใช้ (Username) <span className="text-error">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="เช่น cashier01"
              className="input input-bordered w-full h-12 text-base font-mono font-bold rounded-xl"
            />
          </div>

          <div>
            <label className="label text-base font-bold pb-1">
              ชื่อพนักงานที่แสดง (Display Name){" "}
              <span className="text-error">*</span>
            </label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="เช่น สมชาย ใจดี"
              className="input input-bordered w-full h-12 text-lg font-bold rounded-xl"
            />
          </div>

          <div>
            <label className="label text-base font-bold pb-1">
              รหัสผ่าน (Password) <span className="text-error">*</span>
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="รหัสผ่านสำหรับล็อกอินแบบเต็ม..."
              className="input input-bordered w-full h-12 text-base rounded-xl"
            />
          </div>

          <div>
            <label className="label text-base font-bold pb-1">
              รหัส PIN หน้าร้าน (4-6 หลัก) <span className="text-error">*</span>
            </label>
            <input
              type="password"
              maxLength={6}
              required
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="ตัวเลข 4-6 หลัก เช่น 1234"
              className="input input-bordered w-full h-12 text-2xl font-mono tracking-widest text-primary font-black rounded-xl"
            />
            <p className="text-xs text-base-content/60 mt-1">
              ใช้สำหรับเข้าสู่ระบบแบบกดตัวเลขด่วนที่หน้า POS
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
              <span>สร้างบัญชีพนักงาน</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
