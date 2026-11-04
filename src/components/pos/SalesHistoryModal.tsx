"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Sale, Receipt } from "../../types/api.ts";
import { apiClient } from "../../services/apiClient.ts";
import { formatBaht } from "../../utils/currency.ts";
import { VoidSaleDialog } from "./VoidSaleDialog.tsx";
import { ReceiptModal } from "./ReceiptModal.tsx";
import { useToast } from "../../context/ToastContext.tsx";
import {
  History,
  Printer,
  Ban,
  X,
  Search,
  RefreshCw,
  AlertCircle,
  Calendar,
  ChevronDown,
  ChevronUp,
  Package,
  ChevronLeft,
  ChevronRight,
  Banknote,
  CreditCard,
  User,
} from "lucide-react";

interface SalesHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SalesHistoryModal: React.FC<SalesHistoryModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { toast } = useToast();
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Date Range Filter
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Payment Method Filter ('ALL' | 'CASH' | 'CREDIT')
  const [paymentFilter, setPaymentFilter] = useState<"ALL" | "CASH" | "CREDIT">(
    "ALL"
  );

  // Expand Items state
  const [expandedSaleIds, setExpandedSaleIds] = useState<Set<string>>(
    new Set()
  );

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Void Dialog State
  const [voidingSale, setVoidingSale] = useState<Sale | null>(null);
  const [isVoidLoading, setIsVoidLoading] = useState(false);

  // Reprint Receipt State
  const [reprintReceipt, setReprintReceipt] = useState<Receipt | null>(null);

  const loadSales = useCallback(
    async (start?: string, end?: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.append("limit", "200");
        const s = start !== undefined ? start : startDate;
        const e = end !== undefined ? end : endDate;
        if (s) params.append("start_date", s);
        if (e) params.append("end_date", e);

        const res = await apiClient.get<{ data: Sale[]; success: boolean }>(
          `/sales?${params.toString()}`
        );
        if (res && res.data) {
          setSales(res.data);
        }
      } catch (err: unknown) {
        console.error("Failed to load sales history:", err);
        setError("ไม่สามารถดึงประวัติการขายได้ (ตรวจสอบการเชื่อมต่อ API)");
      } finally {
        setIsLoading(false);
      }
    },
    [startDate, endDate]
  );

  useEffect(() => {
    if (isOpen) {
      loadSales();
    }
  }, [isOpen, loadSales]);

  // Preset Date Range Helpers
  const handlePreset = (
    type: "today" | "yesterday" | "7days" | "month" | "all"
  ) => {
    setCurrentPage(1);
    const now = new Date();
    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    if (type === "all") {
      setStartDate("");
      setEndDate("");
      loadSales("", "");
      return;
    }

    if (type === "today") {
      const todayStr = formatDate(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
      loadSales(todayStr, todayStr);
      return;
    }

    if (type === "yesterday") {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = formatDate(y);
      setStartDate(yStr);
      setEndDate(yStr);
      loadSales(yStr, yStr);
      return;
    }

    if (type === "7days") {
      const past = new Date(now);
      past.setDate(past.getDate() - 6);
      const pastStr = formatDate(past);
      const todayStr = formatDate(now);
      setStartDate(pastStr);
      setEndDate(todayStr);
      loadSales(pastStr, todayStr);
      return;
    }

    if (type === "month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const firstStr = formatDate(firstDay);
      const todayStr = formatDate(now);
      setStartDate(firstStr);
      setEndDate(todayStr);
      loadSales(firstStr, todayStr);
      return;
    }
  };

  const toggleExpand = (saleId: string) => {
    setExpandedSaleIds((prev) => {
      const next = new Set(prev);
      if (next.has(saleId)) {
        next.delete(saleId);
      } else {
        next.add(saleId);
      }
      return next;
    });
  };

  const handleVoidConfirm = async (reason: string) => {
    if (!voidingSale) return;
    setIsVoidLoading(true);
    try {
      await apiClient.post(`/sales/${voidingSale.id}/void`, { reason });
      setVoidingSale(null);
      toast.success("ยกเลิกบิลการขายเรียบร้อยแล้ว");
      await loadSales(); // reload list
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "ยกเลิกบิลไม่สำเร็จ";
      toast.error(`เกิดข้อผิดพลาด: ${msg}`);
    } finally {
      setIsVoidLoading(false);
    }
  };

  const handleReprint = async (sale: Sale) => {
    try {
      // Fetch receipt directly from server API using sale_no
      const res = await apiClient.get<{ data: Receipt; success: boolean }>(
        `/sales/receipt/${sale.sale_no}`
      );
      if (res && res.data) {
        setReprintReceipt(res.data);
      } else {
        toast.warning("ไม่พบข้อมูลใบเสร็จรับเงินจากระบบ");
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "ไม่สามารถดึงข้อมูลใบเสร็จจากเซิร์ฟเวอร์ได้";
      toast.error(`เกิดข้อผิดพลาด: ${msg}`);
    }
  };

  // Filter Sales client-side
  const filtered = useMemo(() => {
    return sales.filter((s) => {
      // Search by bill no, customer name, or purchased product name
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesSaleNo = s.sale_no.toLowerCase().includes(q);
        const matchesCustomer =
          s.customer_name && s.customer_name.toLowerCase().includes(q);
        const matchesProduct = (s.lines || []).some((item) =>
          item.product_name.toLowerCase().includes(q)
        );

        if (!matchesSaleNo && !matchesCustomer && !matchesProduct) {
          return false;
        }
      }

      // Date Range Filter (fallback)
      if (startDate || endDate) {
        const saleDateStr = s.occurred_at ? s.occurred_at.slice(0, 10) : "";
        if (startDate && saleDateStr && saleDateStr < startDate) {
          return false;
        }
        if (endDate && saleDateStr && saleDateStr > endDate) {
          return false;
        }
      }

      // Payment Method Filter
      if (paymentFilter !== "ALL" && s.payment_method !== paymentFilter) {
        return false;
      }

      return true;
    });
  }, [sales, search, startDate, endDate, paymentFilter]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPageClamped = Math.min(currentPage, totalPages);
  const startIndex = (currentPageClamped - 1) * pageSize;
  const paginatedSales = filtered.slice(startIndex, startIndex + pageSize);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-xs">
        <div className="card bg-base-100 w-full max-w-4xl border-2 border-base-300 shadow-2xl rounded-3xl overflow-hidden flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b-2 border-base-200 flex justify-between items-center bg-base-200/50">
            <div className="flex items-center gap-2.5">
              <History className="w-8 h-8 text-primary" />
              <div>
                <h3 className="text-2xl sm:text-3xl font-black text-base-content">
                  ประวัติรายการขาย
                </h3>
                <p className="text-sm font-semibold text-base-content/60">
                  ค้นหาบิลย้อนหลัง ดูรายการสินค้า สั่งพิมพ์ใบเสร็จซ้ำ
                  หรือกดยกเลิกบิล
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost btn-circle btn-lg text-base-content/60 hover:text-base-content"
              aria-label="ปิด"
            >
              <X className="w-7 h-7" />
            </button>
          </div>

          {/* Search bar & Filter Toolbar */}
          <div className="p-4 border-b border-base-200 space-y-3 bg-base-100">
            {/* Top row: Search input, Payment Filter & Refresh button */}
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="ค้นหาเลขที่บิล, ชื่อลูกค้า หรือชื่อสินค้าในบิล..."
                  className="input input-bordered w-full h-11 pl-10 pr-9 text-sm sm:text-base font-semibold rounded-xl border-base-300 focus:border-primary"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setCurrentPage(1);
                    }}
                    className="btn btn-ghost btn-circle btn-xs absolute right-2.5 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content"
                    title="ล้างคำค้นหา"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Payment Filter & Refresh */}
              <div className="flex items-center gap-2">
                <div className="inline-flex p-1 bg-base-200/70 border border-base-300 rounded-xl flex-1 sm:flex-initial gap-1 justify-between sm:justify-start">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentFilter("ALL");
                      setCurrentPage(1);
                    }}
                    className={`btn btn-xs sm:btn-sm h-9 px-2.5 sm:px-3 rounded-lg font-bold text-xs sm:text-sm transition-all flex-1 sm:flex-initial ${
                      paymentFilter === "ALL"
                        ? "btn-primary shadow-2xs"
                        : "btn-ghost text-base-content/70 hover:text-base-content"
                    }`}
                  >
                    ทั้งหมด
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentFilter("CASH");
                      setCurrentPage(1);
                    }}
                    className={`btn btn-xs sm:btn-sm h-9 px-2.5 sm:px-3 rounded-lg font-bold text-xs sm:text-sm transition-all gap-1 sm:gap-1.5 flex-1 sm:flex-initial ${
                      paymentFilter === "CASH"
                        ? "bg-emerald-600 text-white shadow-2xs"
                        : "btn-ghost text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    <span>เงินสด</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentFilter("CREDIT");
                      setCurrentPage(1);
                    }}
                    className={`btn btn-xs sm:btn-sm h-9 px-2.5 sm:px-3 rounded-lg font-bold text-xs sm:text-sm transition-all gap-1 sm:gap-1.5 flex-1 sm:flex-initial ${
                      paymentFilter === "CREDIT"
                        ? "bg-orange-600 text-white shadow-2xs"
                        : "btn-ghost text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/40"
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>เงินเชื่อ</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => loadSales()}
                  disabled={isLoading}
                  className="btn btn-outline border-base-300 hover:border-primary hover:bg-primary/10 hover:text-primary h-11 px-3 sm:px-4 rounded-xl font-bold gap-2 text-sm shrink-0 transition-colors"
                  title="รีเฟรชรายการ"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
                  />
                  <span className="hidden sm:inline">รีเฟรช</span>
                </button>
              </div>
            </div>

            {/* Bottom row: Expanded Date Range Capsule & Preset Chips */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3 pt-0.5">
              {/* Date Capsule Group (Responsive on mobile) */}
              <div className="flex items-center bg-base-200/60 p-1 sm:p-1.5 rounded-xl border border-base-300 w-full sm:w-auto shadow-2xs">
                <div className="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 text-xs sm:text-sm font-bold text-base-content/80 whitespace-nowrap shrink-0">
                  <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                  <span className="hidden xs:inline">ช่วงวันที่:</span>
                </div>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setCurrentPage(1);
                    loadSales(e.target.value, endDate);
                  }}
                  className="input input-sm h-8 sm:h-9.5 flex-1 sm:w-40 bg-base-100 border border-base-300 rounded-lg text-xs sm:text-sm font-semibold focus:outline-primary px-1.5 sm:px-3 text-center sm:text-left min-w-0"
                />
                <span className="text-xs sm:text-sm text-base-content/50 px-1 sm:px-2 font-bold select-none shrink-0">
                  ถึง
                </span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setCurrentPage(1);
                    loadSales(startDate, e.target.value);
                  }}
                  className="input input-sm h-8 sm:h-9.5 flex-1 sm:w-40 bg-base-100 border border-base-300 rounded-lg text-xs sm:text-sm font-semibold focus:outline-primary px-1.5 sm:px-3 text-center sm:text-left min-w-0"
                />
              </div>

              {/* Quick Preset Chips */}
              <div className="flex items-center gap-1.5 flex-wrap overflow-x-auto">
                <button
                  type="button"
                  onClick={() => handlePreset("today")}
                  className={`btn btn-sm h-9 sm:h-9.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                    startDate && startDate === endDate
                      ? "btn-primary shadow-xs"
                      : "btn-ghost bg-base-200/60 hover:bg-base-200 text-base-content/80"
                  }`}
                >
                  วันนี้
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset("yesterday")}
                  className="btn btn-ghost bg-base-200/60 hover:bg-base-200 btn-sm h-9 sm:h-9.5 px-3 rounded-xl font-bold text-xs sm:text-sm text-base-content/80"
                >
                  เมื่อวาน
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset("7days")}
                  className="btn btn-ghost bg-base-200/60 hover:bg-base-200 btn-sm h-9 sm:h-9.5 px-3 rounded-xl font-bold text-xs sm:text-sm text-base-content/80"
                >
                  7 วันล่าสุด
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset("month")}
                  className="btn btn-ghost bg-base-200/60 hover:bg-base-200 btn-sm h-9 sm:h-9.5 px-3 rounded-xl font-bold text-xs sm:text-sm text-base-content/80"
                >
                  เดือนนี้
                </button>
                {(startDate || endDate) && (
                  <button
                    type="button"
                    onClick={() => handlePreset("all")}
                    className="btn btn-ghost hover:bg-error/10 btn-sm h-9 sm:h-9.5 px-2.5 rounded-xl font-bold text-xs sm:text-sm text-error ml-1"
                    title="ล้างช่วงวันที่ทั้งหมด"
                  >
                    ล้างตัวกรอง
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Error alert */}
          {error && (
            <div className="mx-4 mt-3 alert alert-warning rounded-2xl text-sm font-bold flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Table List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <span className="loading loading-spinner loading-lg text-primary"></span>
                <p className="text-xl font-bold">กำลังโหลดประวัติบิล...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-base-content/50">
                <p className="text-2xl font-bold">ไม่พบประวัติรายการขาย</p>
                <p className="text-sm font-semibold mt-1">
                  ลองเปลี่ยนเงื่อนไขค้นหา หรือช่วงวันที่
                </p>
              </div>
            ) : (
              paginatedSales.map((sale) => {
                const isVoided = sale.status === "VOIDED";
                const isCredit = sale.payment_method === "CREDIT";
                const isExpanded = expandedSaleIds.has(sale.id);
                const itemsCount = sale.lines ? sale.lines.length : 0;
                const dateStr = new Date(sale.occurred_at).toLocaleString(
                  "th-TH",
                  {
                    dateStyle: "short",
                    timeStyle: "short",
                  }
                );

                return (
                  <div
                    key={sale.id}
                    className={`rounded-2xl border transition-all overflow-hidden ${
                      isVoided
                        ? "bg-error/5 border-error/25 border-l-4 border-l-error opacity-80"
                        : isCredit
                          ? "bg-orange-50/40 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/50 border-l-4 border-l-orange-500 hover:border-orange-400 shadow-2xs hover:shadow-xs"
                          : "bg-base-100 border-base-300 border-l-4 border-l-emerald-500/70 hover:border-primary/40 shadow-2xs hover:shadow-xs"
                    }`}
                  >
                    {/* Main Sale Header Row */}
                    <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base sm:text-lg font-black font-mono tracking-tight">
                            {sale.sale_no}
                          </span>

                          <span
                            className={`badge badge-sm text-[11px] font-bold py-1.5 px-2 rounded-md ${
                              isVoided
                                ? "badge-error text-white"
                                : "badge-success text-white"
                            }`}
                          >
                            {isVoided ? "ยกเลิกแล้ว" : "สำเร็จ"}
                          </span>

                          {/* Items count button / pill */}
                          <button
                            type="button"
                            onClick={() => toggleExpand(sale.id)}
                            className={`btn btn-xs rounded-lg font-bold gap-1 transition-all border ${
                              isExpanded
                                ? "bg-primary text-white border-primary shadow-2xs"
                                : "bg-primary/10 hover:bg-primary/20 text-primary border-primary/20"
                            }`}
                            title="กดเพื่อดูรายการสินค้า"
                          >
                            <Package className="w-3.5 h-3.5" />
                            <span>{itemsCount} รายการ</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        <div className="text-xs sm:text-sm font-medium text-base-content/60 flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <span>{dateStr}</span>
                          <span className="text-base-content/30">•</span>
                          {isCredit ? (
                            <span className="inline-flex items-center gap-1 font-black px-2.5 py-0.5 rounded-md text-xs bg-orange-600 text-white shadow-2xs">
                              <span>📝 เงินเชื่อ</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-black px-2.5 py-0.5 rounded-md text-xs bg-emerald-600 text-white shadow-2xs">
                              <span>💵 เงินสด</span>
                            </span>
                          )}
                          {sale.customer_name && (
                            <>
                              <span className="text-base-content/30">•</span>
                              {isCredit ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md font-bold text-xs bg-orange-100 text-orange-950 dark:bg-orange-950/80 dark:text-orange-200 border border-orange-300 dark:border-orange-800">
                                  <User className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                                  <span>ลูกค้า: {sale.customer_name}</span>
                                </span>
                              ) : (
                                <span className="font-semibold text-base-content/80">
                                  ลูกค้า: {sale.customer_name}
                                </span>
                              )}
                            </>
                          )}
                        </div>

                        {isVoided && sale.void_reason && (
                          <div className="text-xs font-semibold text-error pt-0.5">
                            เหตุผลที่ยกเลิก: {sale.void_reason}
                          </div>
                        )}
                      </div>

                      {/* Right: Amount & Actions */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0">
                        <span className="text-lg sm:text-2xl font-black text-primary font-mono tracking-tight whitespace-nowrap">
                          {formatBaht(sale.grand_total)}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleReprint(sale)}
                            className="btn btn-outline border-base-300 hover:border-primary hover:bg-primary hover:text-white btn-sm h-9.5 px-3 rounded-xl font-bold gap-1.5 text-xs sm:text-sm transition-all"
                            title="พิมพ์ใบเสร็จซ้ำ"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>พิมพ์ซ้ำ</span>
                          </button>

                          {!isVoided && (
                            <button
                              type="button"
                              onClick={() => setVoidingSale(sale)}
                              className="btn btn-ghost hover:bg-error/10 text-error btn-sm h-9.5 px-2.5 rounded-xl font-bold gap-1 text-xs sm:text-sm"
                              title="ยกเลิกบิลนี้"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              <span>ยกเลิก</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expandable Purchased Items List */}
                    {isExpanded && (
                      <div className="px-3.5 pb-3.5 pt-1 bg-base-200/40 border-t border-base-200">
                        <div className="text-xs font-bold text-base-content/60 mb-2 flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-primary" />
                          <span>
                            รายการสินค้าที่ซื้อ ({itemsCount} รายการ):
                          </span>
                        </div>

                        {sale.lines && sale.lines.length > 0 ? (
                          <div className="bg-base-100 rounded-xl border border-base-200 divide-y divide-base-200 overflow-hidden text-xs sm:text-sm shadow-2xs">
                            {sale.lines.map((line, idx) => (
                              <div
                                key={line.id || idx}
                                className="p-2.5 flex items-center justify-between hover:bg-base-200/40 transition-colors"
                              >
                                <div className="flex-1 pr-3">
                                  <div className="font-bold text-base-content">
                                    {line.product_name}
                                  </div>
                                  <div className="text-[11px] text-base-content/60 font-medium">
                                    {line.qty} × {formatBaht(line.unit_price)}
                                    {line.line_discount &&
                                    line.line_discount > 0
                                      ? ` (ลด ${formatBaht(line.line_discount)})`
                                      : ""}
                                  </div>
                                </div>
                                <div className="font-black text-right text-base-content font-mono">
                                  {formatBaht(line.net_total)}
                                </div>
                              </div>
                            ))}

                            {/* Bill discount summary row if exists */}
                            {sale.bill_discount > 0 && (
                              <div className="p-2.5 bg-warning/10 flex items-center justify-between text-warning-content font-bold text-xs sm:text-sm">
                                <span>ส่วนลดท้ายบิล:</span>
                                <span>-{formatBaht(sale.bill_discount)}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-base-content/50 italic py-1">
                            ไม่มีข้อมูลรายการสินค้าย่อยในบิลนี้
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination Footer */}
          {filtered.length > 0 && (
            <div className="p-3.5 sm:p-4 border-t-2 border-base-200 bg-base-200/40 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs sm:text-sm font-semibold text-base-content/70 whitespace-nowrap">
                แสดง{" "}
                <span className="font-bold text-base-content font-mono">
                  {startIndex + 1} -{" "}
                  {Math.min(startIndex + pageSize, filtered.length)}
                </span>{" "}
                จากทั้งหมด{" "}
                <span className="font-bold text-base-content font-mono">
                  {filtered.length}
                </span>{" "}
                รายการ
              </div>

              <div className="flex items-center gap-3 sm:gap-4 flex-wrap justify-end w-full sm:w-auto">
                {/* Page Size Selector */}
                <div className="flex items-center gap-1.5 text-xs font-bold text-base-content/70 whitespace-nowrap">
                  <span className="whitespace-nowrap">แสดงหน้าละ:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="select select-bordered select-xs rounded-lg font-bold bg-base-100 border-base-300 h-8"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>

                {/* Page Navigation Buttons */}
                <div className="join shadow-2xs border border-base-300 rounded-xl overflow-hidden bg-base-100">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPageClamped <= 1}
                    className="btn btn-xs sm:btn-sm join-item font-bold gap-1 bg-base-100 hover:bg-base-200 border-none disabled:bg-base-200/50"
                    title="หน้าก่อนหน้า"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">ก่อนหน้า</span>
                  </button>

                  <div className="join-item px-3 flex items-center justify-center text-xs sm:text-sm font-mono font-bold bg-base-100 border-x border-base-200 select-none">
                    {currentPageClamped} / {totalPages}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPageClamped >= totalPages}
                    className="btn btn-xs sm:btn-sm join-item font-bold gap-1 bg-base-100 hover:bg-base-200 border-none disabled:bg-base-200/50"
                    title="หน้าถัดไป"
                  >
                    <span className="hidden sm:inline">ถัดไป</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Void Dialog */}
      <VoidSaleDialog
        isOpen={Boolean(voidingSale)}
        saleNo={voidingSale?.sale_no || ""}
        onClose={() => setVoidingSale(null)}
        onConfirm={handleVoidConfirm}
        isLoading={isVoidLoading}
      />

      {/* Reprint Receipt Modal (isReprint=true: hides "start new bill" button) */}
      <ReceiptModal
        isOpen={Boolean(reprintReceipt)}
        receipt={reprintReceipt}
        onClose={() => setReprintReceipt(null)}
        isReprint={true}
      />
    </>
  );
};
