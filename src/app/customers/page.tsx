"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext.tsx";
import { useToast } from "../../context/ToastContext.tsx";
import { Customer } from "../../types/api.ts";
import { apiClient } from "../../services/apiClient.ts";
import { HeaderBar } from "../../components/pos/HeaderBar.tsx";
import { CreateCustomerModal } from "../../components/customers/CreateCustomerModal.tsx";
import { PayCreditModal } from "../../components/customers/PayCreditModal.tsx";
import { CreditHistoryModal } from "../../components/customers/CreditHistoryModal.tsx";
import { EditCreditLimitModal } from "../../components/customers/EditCreditLimitModal.tsx";
import { ARAgingTable } from "../../components/customers/ARAgingTable.tsx";
import { formatBaht } from "../../utils/currency.ts";
import {
  Users,
  UserPlus,
  Search,
  DollarSign,
  History,
  ShieldCheck,
  Trash2,
  TrendingDown,
  RefreshCw,
} from "lucide-react";

export default function CustomersPage() {
  const router = useRouter();
  const { user, token, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"list" | "aging">("list");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedPayCustomer, setSelectedPayCustomer] =
    useState<Customer | null>(null);
  const [selectedHistoryCustomer, setSelectedHistoryCustomer] =
    useState<Customer | null>(null);
  const [selectedLimitCustomer, setSelectedLimitCustomer] =
    useState<Customer | null>(null);

  // Protect route
  useEffect(() => {
    if (!isAuthLoading && !token) {
      router.push("/login");
    }
  }, [token, isAuthLoading, router]);

  const loadCustomers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ data: Customer[]; success: boolean }>(
        "/customers"
      );
      if (res && res.data) {
        setCustomers(res.data);
      }
    } catch (err: unknown) {
      console.error("Failed to load customers:", err);
      setError("ไม่สามารถดึงข้อมูลลูกค้าได้ (ตรวจสอบการเชื่อมต่อ API)");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      loadCustomers();
    }
  }, [token, loadCustomers]);

  const handleDeleteCustomer = async (cust: Customer) => {
    const outstanding =
      cust.credit_account?.outstanding_balance ?? cust.current_balance ?? 0;
    if (outstanding > 0) {
      toast.warning(
        `ไม่สามารถลบข้อมูลลูกค้า ${cust.name} ได้ เนื่องจากยังมียอดหนี้ค้างชำระ ${formatBaht(outstanding)}`
      );
      return;
    }

    if (
      !window.confirm(
        `คุณต้องการลบข้อมูลลูกค้า "${cust.name}" ออกจากระบบหรือไม่?`
      )
    ) {
      return;
    }

    try {
      await apiClient.delete(`/customers/${cust.id}`);
      toast.success("ลบข้อมูลลูกค้าเรียบร้อยแล้ว");
      loadCustomers();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "ลบข้อมูลลูกค้าไม่สำเร็จ";
      toast.error(`เกิดข้อผิดพลาด: ${msg}`);
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q))
    );
  }, [customers, search]);

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
        {/* Page Title & Navigation Tabs */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-3xl font-black text-base-content flex items-center gap-2.5">
              <Users className="w-8 h-8 text-primary" />
              จัดการลูกค้าและบัญชีหนี้เงินเชื่อ
            </h2>
            <p className="text-sm font-semibold text-base-content/60 mt-1">
              ดูแลข้อมูลลูกค้า กำหนดวงเงินเครดิต รับชำระหนี้
              และติดตามยอดหนี้ค้างชำระ
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="btn btn-primary h-12 px-5 font-black rounded-2xl gap-2 shadow-sm"
            >
              <UserPlus className="w-5 h-5" />
              <span>ลงทะเบียนลูกค้าใหม่</span>
            </button>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="tabs tabs-boxed bg-base-100 p-1.5 rounded-2xl border-2 border-base-300 w-fit">
          <button
            type="button"
            onClick={() => setActiveTab("list")}
            className={`tab h-11 px-5 font-bold rounded-xl text-base gap-2 transition-all ${
              activeTab === "list"
                ? "tab-active bg-primary text-primary-content font-black shadow-xs"
                : ""
            }`}
          >
            <Users className="w-5 h-5" />
            <span>ทะเบียนลูกค้า ({customers.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("aging")}
            className={`tab h-11 px-5 font-bold rounded-xl text-base gap-2 transition-all ${
              activeTab === "aging"
                ? "tab-active bg-primary text-primary-content font-black shadow-xs"
                : ""
            }`}
          >
            <TrendingDown className="w-5 h-5" />
            <span>รายงานลูกหนี้ค้างชำระ (AR Aging)</span>
          </button>
        </div>

        {/* Tab 1: Customer List */}
        {activeTab === "list" && (
          <div className="card bg-base-100 border-2 border-base-300 rounded-3xl overflow-hidden shadow-xs">
            {/* Table Controls / Search */}
            <div className="p-4 sm:p-5 border-b-2 border-base-200 flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="relative w-full sm:w-96">
                <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-base-content/50" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ค้นหาชื่อ, เบอร์โทร, อีเมล..."
                  className="input input-bordered w-full h-12 pl-11 pr-4 font-bold rounded-2xl"
                />
              </div>

              <button
                type="button"
                onClick={loadCustomers}
                disabled={isLoading}
                className="btn btn-outline h-12 px-4 rounded-2xl font-bold gap-2"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
                />
                <span>รีเฟรชข้อมูล</span>
              </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto p-4">
              {isLoading ? (
                <div className="text-center py-16">
                  <span className="loading loading-spinner loading-lg text-primary"></span>
                  <p className="text-lg font-bold mt-2 text-base-content/70">
                    กำลังโหลดข้อมูลลูกค้า...
                  </p>
                </div>
              ) : error ? (
                <div className="alert alert-error rounded-2xl font-bold text-center">
                  {error}
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-16 text-base-content/50">
                  <p className="text-xl font-bold">ไม่พบข้อมูลลูกค้า</p>
                  <p className="text-sm mt-1">
                    ลองพิมพ์คำค้นหาอื่น หรือกดปุ่ม
                    &quot;ลงทะเบียนลูกค้าใหม่&quot;
                  </p>
                </div>
              ) : (
                <table className="table table-zebra w-full text-base">
                  <thead>
                    <tr className="border-b-2 border-base-300 text-sm font-bold text-base-content/70">
                      <th>ชื่อลูกค้า / ข้อมูลติดต่อ</th>
                      <th>ประเภท</th>
                      <th className="text-right">วงเงินเครดิต</th>
                      <th className="text-right">ยอดหนี้คงค้าง</th>
                      <th className="text-right">วงเงินคงเหลือ</th>
                      <th>สถานะ</th>
                      <th className="text-center">การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((cust) => {
                      const limit =
                        cust.credit_account?.credit_limit ??
                        cust.credit_limit ??
                        0;
                      const debt =
                        cust.credit_account?.outstanding_balance ??
                        cust.current_balance ??
                        0;
                      const available = Math.max(0, limit - debt);
                      const status = cust.credit_account?.status || "OK";

                      return (
                        <tr key={cust.id} className="hover">
                          <td>
                            <div className="font-bold text-lg text-base-content">
                              {cust.name}
                            </div>
                            <div className="text-xs text-base-content/60 font-mono">
                              {cust.phone || "ไม่ระบุเบอร์โทร"}
                              {cust.email ? ` • ${cust.email}` : ""}
                            </div>
                          </td>
                          <td>
                            {cust.is_member ? (
                              <span className="badge badge-primary font-bold text-xs">
                                สมาชิก
                              </span>
                            ) : (
                              <span className="badge badge-ghost font-bold text-xs">
                                ทั่วไป
                              </span>
                            )}
                          </td>
                          <td className="text-right font-bold text-base-content">
                            {formatBaht(limit)}
                          </td>
                          <td className="text-right font-black text-error text-lg">
                            {formatBaht(debt)}
                          </td>
                          <td className="text-right font-bold text-success">
                            {formatBaht(available)}
                          </td>
                          <td>
                            {status === "OVER_LIMIT" ? (
                              <span className="badge badge-error text-white font-bold text-xs">
                                เกินวงเงิน
                              </span>
                            ) : status === "OVERDUE" ? (
                              <span className="badge badge-warning text-white font-bold text-xs">
                                เกินกำหนด
                              </span>
                            ) : (
                              <span className="badge badge-success text-white font-bold text-xs">
                                ปกติ
                              </span>
                            )}
                          </td>
                          <td>
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              {debt > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedPayCustomer(cust)}
                                  className="btn btn-sm btn-success text-white font-bold rounded-xl gap-1 shadow-xs"
                                  title="รับชำระหนี้"
                                >
                                  <DollarSign className="w-4 h-4" />
                                  <span>รับชำระ</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => setSelectedHistoryCustomer(cust)}
                                className="btn btn-sm btn-outline font-bold rounded-xl gap-1"
                                title="ประวัติการเคลื่อนไหวหนี้"
                              >
                                <History className="w-4 h-4" />
                                <span>ประวัติ</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setSelectedLimitCustomer(cust)}
                                className="btn btn-sm btn-ghost font-bold rounded-xl gap-1"
                                title="ปรับวงเงินเครดิต"
                              >
                                <ShieldCheck className="w-4 h-4" />
                                <span>วงเงิน</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteCustomer(cust)}
                                className="btn btn-sm btn-ghost text-error rounded-xl"
                                title="ลบลูกค้า"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: AR Aging Report */}
        {activeTab === "aging" && (
          <ARAgingTable
            onPayCredit={(cust) => {
              setSelectedPayCustomer(cust);
            }}
          />
        )}
      </main>

      {/* Modals */}
      <CreateCustomerModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => {
          loadCustomers();
        }}
      />

      <PayCreditModal
        isOpen={Boolean(selectedPayCustomer)}
        customer={selectedPayCustomer}
        onClose={() => setSelectedPayCustomer(null)}
        onSuccess={() => {
          loadCustomers();
        }}
      />

      <CreditHistoryModal
        isOpen={Boolean(selectedHistoryCustomer)}
        customer={selectedHistoryCustomer}
        onClose={() => setSelectedHistoryCustomer(null)}
      />

      <EditCreditLimitModal
        isOpen={Boolean(selectedLimitCustomer)}
        customer={selectedLimitCustomer}
        onClose={() => setSelectedLimitCustomer(null)}
        onSuccess={() => {
          loadCustomers();
        }}
      />
    </div>
  );
}
