"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Sale, Receipt } from "../../types/api.ts";
import { apiClient } from "../../services/apiClient.ts";
import { formatBaht } from "../../utils/currency.ts";
import { VoidSaleDialog } from "./VoidSaleDialog.tsx";
import { ReceiptModal } from "./ReceiptModal.tsx";
import {
  History,
  Printer,
  Ban,
  X,
  Search,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

interface SalesHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SalesHistoryModal: React.FC<SalesHistoryModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Void Dialog State
  const [voidingSale, setVoidingSale] = useState<Sale | null>(null);
  const [isVoidLoading, setIsVoidLoading] = useState(false);

  // Reprint Receipt State
  const [reprintReceipt, setReprintReceipt] = useState<Receipt | null>(null);

  const loadSales = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ data: Sale[]; success: boolean }>(
        "/sales?limit=50"
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
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadSales();
    }
  }, [isOpen, loadSales]);

  const handleVoidConfirm = async (reason: string) => {
    if (!voidingSale) return;
    setIsVoidLoading(true);
    try {
      await apiClient.post(`/sales/${voidingSale.id}/void`, { reason });
      setVoidingSale(null);
      await loadSales(); // reload list
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "ยกเลิกบิลไม่สำเร็จ";
      alert(`เกิดข้อผิดพลาด: ${msg}`);
    } finally {
      setIsVoidLoading(false);
    }
  };

  const handleReprint = async (sale: Sale) => {
    try {
      // Try fetch receipt from server
      const res = await apiClient.get<{ data: Receipt; success: boolean }>(
        `/sales/receipt/${sale.sale_no}`
      );
      if (res && res.data) {
        setReprintReceipt(res.data);
        return;
      }
    } catch {
      // Fallback create receipt from sale
      const receipt: Receipt = {
        receipt_no: `REC-${sale.sale_no}`,
        sale_no: sale.sale_no,
        cashier_name: sale.cashier_name,
        customer_name: sale.customer_name,
        payment_method: sale.payment_method,
        subtotal: sale.subtotal,
        discount: sale.bill_discount,
        grand_total: sale.grand_total,
        tendered: sale.tendered_amount,
        change: sale.change_amount,
        items: (sale.lines || []).map((l) => ({
          product_name: l.product_name,
          qty: l.qty,
          unit_price: l.unit_price,
          net_total: l.net_total,
        })),
        occurred_at: sale.occurred_at || new Date().toISOString(),
        status: sale.status,
      };
      setReprintReceipt(receipt);
    }
  };

  if (!isOpen) return null;

  const filtered = sales.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.sale_no.toLowerCase().includes(q) ||
      (s.customer_name && s.customer_name.toLowerCase().includes(q))
    );
  });

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-xs">
        <div className="card bg-base-100 w-full max-w-4xl border-2 border-base-300 shadow-2xl rounded-3xl overflow-hidden flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b-2 border-base-200 flex justify-between items-center bg-base-200/50">
            <div className="flex items-center gap-2.5">
              <History className="w-8 h-8 text-primary" />
              <div>
                <h3 className="text-2xl sm:text-3xl font-black text-base-content">
                  ประวัติรายการขาย
                </h3>
                <p className="text-sm font-semibold text-base-content/60">
                  ค้นหาบิลย้อนหลัง สั่งพิมพ์ใบเสร็จซ้ำ หรือกดยกเลิกบิล
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

          {/* Search bar & Refresh */}
          <div className="p-4 border-b border-base-200 flex gap-3">
            <div className="relative flex-1">
              <Search className="w-6 h-6 absolute left-4 top-1/2 -translate-y-1/2 text-base-content/50" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาเลขที่บิล หรือ ชื่อลูกค้า..."
                className="input input-bordered w-full h-14 pl-12 pr-4 text-xl font-bold rounded-2xl border-2"
              />
            </div>
            <button
              type="button"
              onClick={loadSales}
              disabled={isLoading}
              className="btn btn-outline h-14 px-5 rounded-2xl font-bold gap-2 text-base"
              title="รีเฟรชรายการ"
            >
              <RefreshCw
                className={`w-5 h-5 ${isLoading ? "animate-spin" : ""}`}
              />
              <span>รีเฟรช</span>
            </button>
          </div>

          {/* Error alert */}
          {error && (
            <div className="mx-4 mt-3 alert alert-warning rounded-2xl text-sm font-bold flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Table List */}
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <span className="loading loading-spinner loading-lg text-primary"></span>
                <p className="text-xl font-bold">กำลังโหลดประวัติบิล...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-base-content/50">
                <p className="text-2xl font-bold">ไม่พบประวัติรายการขาย</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((sale) => {
                  const isVoided = sale.status === "VOIDED";
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
                      className={`p-4 rounded-2xl border-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                        isVoided
                          ? "bg-error/5 border-error/30 opacity-75"
                          : "bg-base-100 border-base-300 hover:border-primary/50 shadow-xs"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-black font-mono">
                            {sale.sale_no}
                          </span>
                          <span
                            className={`badge text-xs font-black py-2 px-2.5 rounded-lg ${
                              isVoided
                                ? "badge-error text-white"
                                : "badge-success text-white"
                            }`}
                          >
                            {isVoided ? "ยกเลิกแล้ว" : "สำเร็จ"}
                          </span>
                        </div>
                        <div className="text-sm font-semibold text-base-content/60">
                          {dateStr} •{" "}
                          {sale.payment_method === "CASH"
                            ? "เงินสด"
                            : "เงินเชื่อ"}
                          {sale.customer_name
                            ? ` • ลูกค้า: ${sale.customer_name}`
                            : ""}
                        </div>
                        {isVoided && sale.void_reason && (
                          <div className="text-xs font-semibold text-error">
                            เหตุผลที่ยกเลิก: {sale.void_reason}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4">
                        <span className="text-2xl font-black text-primary">
                          {formatBaht(sale.grand_total)}
                        </span>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleReprint(sale)}
                            className="btn btn-outline btn-sm h-11 px-3.5 rounded-xl font-bold gap-1.5"
                            title="พิมพ์ใบเสร็จซ้ำ"
                          >
                            <Printer className="w-4 h-4" />
                            <span>พิมพ์ซ้ำ</span>
                          </button>

                          {!isVoided && (
                            <button
                              type="button"
                              onClick={() => setVoidingSale(sale)}
                              className="btn btn-ghost btn-sm h-11 px-3 text-error hover:bg-error/10 rounded-xl font-bold gap-1"
                              title="ยกเลิกบิลนี้"
                            >
                              <Ban className="w-4 h-4" />
                              <span>ยกเลิก</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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

      {/* Reprint Receipt Modal */}
      <ReceiptModal
        isOpen={Boolean(reprintReceipt)}
        receipt={reprintReceipt}
        onClose={() => setReprintReceipt(null)}
      />
    </>
  );
};
