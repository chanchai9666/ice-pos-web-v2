"use client";

import React, { useState, useEffect } from "react";
import { Customer, CreditTransaction } from "../../types/api.ts";
import { apiClient } from "../../services/apiClient.ts";
import { formatBaht } from "../../utils/currency.ts";
import { History, X, ArrowUpRight, ArrowDownLeft } from "lucide-react";

interface CreditHistoryModalProps {
  isOpen: boolean;
  customer: Customer | null;
  onClose: () => void;
}

export const CreditHistoryModal: React.FC<CreditHistoryModalProps> = ({
  isOpen,
  customer,
  onClose,
}) => {
  const [history, setHistory] = useState<CreditTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (isOpen && customer) {
      setIsLoading(true);
      setError(null);
      apiClient
        .get<{ data: CreditTransaction[]; success: boolean }>(
          `/customers/${customer.id}/credit-history?limit=100`
        )
        .then((res) => {
          if (active && res && res.data) {
            setHistory(res.data);
          }
        })
        .catch((err) => {
          if (active) {
            console.error("Failed to load credit history:", err);
            setError("ไม่สามารถดึงประวัติการเคลื่อนไหวหนี้ได้");
          }
        })
        .finally(() => {
          if (active) setIsLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, [isOpen, customer]);

  if (!isOpen || !customer) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="card bg-base-100 w-full max-w-3xl border-2 border-base-300 shadow-2xl rounded-3xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b-2 border-base-200 flex justify-between items-center bg-base-200/50">
          <div className="flex items-center gap-2.5">
            <History className="w-7 h-7 text-primary" />
            <div>
              <h3 className="text-2xl font-black text-base-content">
                ประวัติการเคลื่อนไหวหนี้ (Credit Ledger)
              </h3>
              <p className="text-sm text-base-content/70 font-semibold">
                ลูกค้า: {customer.name}{" "}
                {customer.phone ? `• ${customer.phone}` : ""}
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

        {/* Content Table */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="text-center py-12">
              <span className="loading loading-spinner loading-lg text-primary"></span>
              <p className="text-base font-bold mt-2">กำลังโหลดประวัติ...</p>
            </div>
          ) : error ? (
            <div className="alert alert-error rounded-2xl text-center font-bold">
              {error}
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-base-content/50">
              <p className="text-xl font-bold">
                ยังไม่มีประวัติการเคลื่อนไหวหนี้
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra w-full text-base">
                <thead>
                  <tr className="border-b-2 border-base-300 text-sm font-bold text-base-content/70">
                    <th>วัน/เวลา</th>
                    <th>ประเภท</th>
                    <th className="text-right">จำนวนเงิน</th>
                    <th className="text-right">หนี้คงเหลือหลังทำรายการ</th>
                    <th>หมายเหตุ / อ้างอิง</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((tx) => {
                    const isIncrease = tx.type === "SALE_CREDIT";
                    return (
                      <tr key={tx.id} className="hover">
                        <td className="text-xs sm:text-sm font-mono whitespace-nowrap">
                          {tx.occurred_at
                            ? new Date(tx.occurred_at).toLocaleString("th-TH")
                            : "-"}
                        </td>
                        <td>
                          {isIncrease ? (
                            <span className="badge badge-error gap-1 font-bold text-xs py-2 px-2.5">
                              <ArrowUpRight className="w-3.5 h-3.5" />
                              ซื้อเงินเชื่อ
                            </span>
                          ) : (
                            <span className="badge badge-success text-white gap-1 font-bold text-xs py-2 px-2.5">
                              <ArrowDownLeft className="w-3.5 h-3.5" />
                              ชำระหนี้
                            </span>
                          )}
                        </td>
                        <td
                          className={`text-right font-black ${
                            isIncrease ? "text-error" : "text-success"
                          }`}
                        >
                          {isIncrease ? "+" : "-"}
                          {formatBaht(Math.abs(tx.amount))}
                        </td>
                        <td className="text-right font-black text-base-content">
                          {formatBaht(tx.balance_after)}
                        </td>
                        <td className="text-xs text-base-content/80 max-w-xs truncate">
                          {tx.note || tx.ref_id || "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-base-200 bg-base-200/40 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-outline h-11 px-6 rounded-xl font-bold"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
