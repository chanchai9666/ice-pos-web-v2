"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext.tsx";
import { useToast } from "../../context/ToastContext.tsx";
import { User } from "../../types/api.ts";
import { offlineStorage } from "../../services/offlineStorage.ts";
import { syncService } from "../../services/syncService.ts";
import { HeaderBar } from "../../components/pos/HeaderBar.tsx";
import { CreateUserModal } from "../../components/users/CreateUserModal.tsx";
import { ResetPinModal } from "../../components/users/ResetPinModal.tsx";
import {
  Users,
  UserPlus,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export default function UsersPage() {
  const router = useRouter();
  const { user, token, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();

  const [users, setUsers] = useState<User[]>(() => offlineStorage.getUsers());
  const [isLoading, setIsLoading] = useState(
    () => offlineStorage.getUsers().length === 0
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedUserForPin, setSelectedUserForPin] = useState<User | null>(
    null
  );

  // Protect route
  useEffect(() => {
    if (!isAuthLoading && !token) {
      router.push("/login");
    }
  }, [token, isAuthLoading, router]);

  const loadUsers = useCallback(async () => {
    setError(null);
    try {
      const data = await syncService.pullUsers();
      if (data && data.length > 0) {
        setUsers(data);
      }
    } catch (err: unknown) {
      console.warn("Failed to load users from API, using offline cache:", err);
      const cached = offlineStorage.getUsers();
      if (cached.length > 0) {
        setUsers(cached);
      } else {
        setError("ไม่สามารถดึงข้อมูลผู้ใช้งานได้ (ตรวจสอบการเชื่อมต่อ API)");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleManualRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const res = await syncService.runFullSyncCycle();
      const updated = offlineStorage.getUsers();
      setUsers(updated);
      if (res.success) {
        toast.success("อัปเดตข้อมูลผู้ใช้และระบบเรียบร้อยแล้ว");
      } else {
        toast.warning(
          res.error || "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ ใช้ข้อมูลในเครื่อง"
        );
      }
    } catch {
      toast.error("อัปเดตข้อมูลไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อ");
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadUsers();
    }
  }, [token, loadUsers]);

  if (isAuthLoading || (!token && !user)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-base-100">
        <span className="loading loading-spinner loading-lg text-primary"></span>
        <p className="text-xl font-bold text-base-content/70">
          กำลังตรวจสอบสิทธิ์...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      <HeaderBar />

      <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Page Title & Add Button */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-3xl font-black text-base-content flex items-center gap-2.5">
              <Users className="w-8 h-8 text-primary" />
              จัดการผู้ใช้งานและแคชเชียร์ (User Management)
            </h2>
            <p className="text-sm font-semibold text-base-content/60 mt-1">
              ดูแลบัญชีผู้ใช้ สร้างพนักงานแคชเชียร์ใหม่ และรีเซ็ตรหัส PIN
              หน้าร้าน
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="btn btn-outline border-2 border-base-300 hover:border-primary h-12 px-4 font-bold rounded-2xl gap-2 shadow-xs bg-base-100"
              title="กดเพื่ออัปเดตข้อมูลผู้ใช้ล่าสุดจากเซิร์ฟเวอร์"
            >
              <RefreshCw
                className={`w-4 h-4 text-primary ${
                  isRefreshing ? "animate-spin" : ""
                }`}
              />
              <span className="hidden sm:inline">อัปเดตข้อมูลล่าสุด</span>
            </button>

            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="btn btn-primary h-12 px-5 font-black rounded-2xl gap-2 shadow-sm"
            >
              <UserPlus className="w-5 h-5" />
              <span>สร้างแคชเชียร์ใหม่</span>
            </button>
          </div>
        </div>

        {/* User List Table Card */}
        <div className="card bg-base-100 border-2 border-base-300 rounded-3xl overflow-hidden shadow-xs">
          <div className="p-4 sm:p-5 border-b-2 border-base-200 flex justify-between items-center bg-base-200/40">
            <span className="font-bold text-base text-base-content/80">
              ผู้ใช้งานทั้งหมด ({users.length} คน)
            </span>

            <button
              type="button"
              onClick={loadUsers}
              disabled={isLoading}
              className="btn btn-ghost btn-sm h-10 px-3 rounded-xl font-bold gap-2"
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
              />
              <span>รีเฟรช</span>
            </button>
          </div>

          <div className="overflow-x-auto p-4">
            {isLoading ? (
              <div className="text-center py-16">
                <span className="loading loading-spinner loading-lg text-primary"></span>
                <p className="text-lg font-bold mt-2 text-base-content/70">
                  กำลังโหลดข้อมูลผู้ใช้...
                </p>
              </div>
            ) : error ? (
              <div className="alert alert-error rounded-2xl font-bold text-center">
                {error}
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-16 text-base-content/50">
                <p className="text-xl font-bold">ยังไม่มีข้อมูลผู้ใช้งาน</p>
              </div>
            ) : (
              <table className="table table-zebra w-full text-base">
                <thead>
                  <tr className="border-b-2 border-base-300 text-sm font-bold text-base-content/70">
                    <th>ชื่อผู้ใช้ (Username)</th>
                    <th>ชื่อที่แสดง (Display Name)</th>
                    <th>สิทธิ์การใช้งาน (Role)</th>
                    <th>สถานะ</th>
                    <th>วันที่สร้าง</th>
                    <th className="text-center">การจัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isAdmin = u.role?.toUpperCase() === "ADMIN";
                    return (
                      <tr key={u.id} className="hover">
                        <td className="font-mono font-bold text-base-content">
                          {u.username}
                        </td>
                        <td className="font-bold text-base text-base-content">
                          {u.display_name || u.full_name || "-"}
                        </td>
                        <td>
                          {isAdmin ? (
                            <span className="badge badge-error text-white font-bold text-xs gap-1 py-2 px-2.5">
                              <ShieldAlert className="w-3.5 h-3.5" />
                              ADMIN
                            </span>
                          ) : (
                            <span className="badge badge-info text-white font-bold text-xs gap-1 py-2 px-2.5">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              CASHIER
                            </span>
                          )}
                        </td>
                        <td>
                          {u.is_active ? (
                            <span className="badge badge-success text-white font-bold text-xs gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              เปิดใช้งาน
                            </span>
                          ) : (
                            <span className="badge badge-ghost text-base-content/50 font-bold text-xs gap-1">
                              <XCircle className="w-3 h-3" />
                              ระงับการใช้งาน
                            </span>
                          )}
                        </td>
                        <td className="text-xs font-mono text-base-content/70 whitespace-nowrap">
                          {u.created_at
                            ? new Date(u.created_at).toLocaleDateString("th-TH")
                            : "-"}
                        </td>
                        <td className="text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedUserForPin(u)}
                            className="btn btn-sm btn-outline font-bold rounded-xl gap-1.5"
                            title="รีเซ็ตรหัส PIN เข้าใช้งานหน้าร้าน"
                          >
                            <KeyRound className="w-4 h-4 text-primary" />
                            <span>รีเซ็ต PIN</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>

      <CreateUserModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={loadUsers}
      />

      <ResetPinModal
        isOpen={Boolean(selectedUserForPin)}
        user={selectedUserForPin}
        onClose={() => setSelectedUserForPin(null)}
        onSuccess={loadUsers}
      />
    </div>
  );
}
