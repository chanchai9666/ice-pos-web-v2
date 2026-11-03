"use client";

import React, { useState, useEffect } from "react";
import { ARAgingItem, Customer } from "../../types/api.ts";
import { offlineStorage } from "../../services/offlineStorage.ts";
import { syncService } from "../../services/syncService.ts";
import { formatBaht } from "../../utils/currency.ts";
import {
  AlertTriangle,
  Clock,
  TrendingDown,
  RefreshCw,
  DollarSign,
} from "lucide-react";

interface ARAgingTableProps {
  onPayCredit: (customer: Customer) => void;
}

export const ARAgingTable: React.FC<ARAgingTableProps> = ({ onPayCredit }) => {
  const [items, setItems] = useState<ARAgingItem[]>(() =>
    offlineStorage.getARAging()
  );
  const [isLoading, setIsLoading] = useState(
    () => offlineStorage.getARAging().length === 0
  );
  const [error, setError] = useState<string | null>(null);

  const loadReport = async () => {
    setError(null);
    try {
      const data = await syncService.pullARAging();
      if (data && data.length > 0) {
        setItems(data);
      }
    } catch (err: unknown) {
      console.warn("Failed to load live AR aging, using offline cache:", err);
      const cached = offlineStorage.getARAging();
      if (cached.length > 0) {
        setItems(cached);
      } else {
        setError(
          "ไม่สามารถดึงรายงานลูกหนี้ค้างชำระได้ (ตรวจสอบการเชื่อมต่อ API)"
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  const totalOutstanding = items.reduce(
    (sum, item) => sum + (item.outstanding_balance || 0),
    0
  );
  const totalCurrentDue = items.reduce(
    (sum, item) => sum + (item.current_due || 0),
    0
  );
  const totalOverdue = items.reduce(
    (sum, item) =>
      sum +
      (item.due_30_to_60 || 0) +
      (item.due_60_to_90 || 0) +
      (item.over_90 || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card bg-base-100 border-2 border-base-300 p-5 rounded-2xl shadow-xs">
          <div className="flex justify-between items-center text-base-content/70">
            <span className="text-sm font-bold">ยอดหนี้ค้างชำระรวม</span>
            <DollarSign className="w-5 h-5 text-primary" />
          </div>
          <div className="text-3xl font-black text-primary mt-2">
            {formatBaht(totalOutstanding)}
          </div>
        </div>

        <div className="card bg-base-100 border-2 border-base-300 p-5 rounded-2xl shadow-xs">
          <div className="flex justify-between items-center text-base-content/70">
            <span className="text-sm font-bold">
              หนี้ไม่เกินกำหนด (0-30 วัน)
            </span>
            <Clock className="w-5 h-5 text-success" />
          </div>
          <div className="text-3xl font-black text-success mt-2">
            {formatBaht(totalCurrentDue)}
          </div>
        </div>

        <div className="card bg-base-100 border-2 border-base-300 p-5 rounded-2xl shadow-xs">
          <div className="flex justify-between items-center text-base-content/70">
            <span className="text-sm font-bold">
              หนี้เกินกำหนดชำระ (&gt; 30 วัน)
            </span>
            <AlertTriangle className="w-5 h-5 text-error" />
          </div>
          <div className="text-3xl font-black text-error mt-2">
            {formatBaht(totalOverdue)}
          </div>
        </div>
      </div>

      {/* AR Aging Table Card */}
      <div className="card bg-base-100 border-2 border-base-300 rounded-3xl overflow-hidden shadow-xs">
        <div className="p-4 border-b-2 border-base-200 flex justify-between items-center bg-base-200/40">
          <h3 className="text-xl font-black text-base-content flex items-center gap-2">
            <TrendingDown className="w-6 h-6 text-warning" />
            รายงานอายุหนี้รายบุคคล (AR Aging by Customer)
          </h3>
          <button
            type="button"
            onClick={loadReport}
            disabled={isLoading}
            className="btn btn-ghost btn-sm h-10 px-3 font-bold rounded-xl gap-2"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            />
            <span>รีเฟรช</span>
          </button>
        </div>

        <div className="p-4 overflow-x-auto">
          {isLoading ? (
            <div className="text-center py-12">
              <span className="loading loading-spinner loading-lg text-primary"></span>
              <p className="text-base font-bold mt-2">
                กำลังโหลดรายงานอายุหนี้...
              </p>
            </div>
          ) : error ? (
            <div className="alert alert-error rounded-2xl font-bold">
              {error}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-base-content/50">
              <p className="text-xl font-bold">
                ไม่มีรายการลูกหนี้ค้างชำระในระบบ
              </p>
            </div>
          ) : (
            <table className="table table-zebra w-full text-base">
              <thead>
                <tr className="border-b-2 border-base-300 text-sm font-bold text-base-content/70">
                  <th>ชื่อลูกค้า</th>
                  <th className="text-right">วงเงิน</th>
                  <th className="text-right">หนี้รวม</th>
                  <th className="text-right">0-30 วัน</th>
                  <th className="text-right">31-60 วัน</th>
                  <th className="text-right">61-90 วัน</th>
                  <th className="text-right">เกิน 90 วัน</th>
                  <th>สถานะ</th>
                  <th className="text-center">การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const isOverLimit = item.status === "OVER_LIMIT";
                  const isOverdue = item.status === "OVERDUE";
                  return (
                    <tr key={item.customer_id} className="hover">
                      <td>
                        <div className="font-bold text-base-content">
                          {item.customer_name}
                        </div>
                        <div className="text-xs text-base-content/60 font-mono">
                          {item.phone || "-"}
                        </div>
                      </td>
                      <td className="text-right font-semibold">
                        {formatBaht(item.credit_limit)}
                      </td>
                      <td className="text-right font-black text-error text-lg">
                        {formatBaht(item.outstanding_balance)}
                      </td>
                      <td className="text-right font-semibold text-success">
                        {formatBaht(item.current_due)}
                      </td>
                      <td className="text-right font-semibold text-warning">
                        {formatBaht(item.due_30_to_60)}
                      </td>
                      <td className="text-right font-semibold text-orange-500">
                        {formatBaht(item.due_60_to_90)}
                      </td>
                      <td className="text-right font-black text-error">
                        {formatBaht(item.over_90)}
                      </td>
                      <td>
                        {isOverLimit ? (
                          <span className="badge badge-error text-white font-bold text-xs">
                            เกินวงเงิน
                          </span>
                        ) : isOverdue ? (
                          <span className="badge badge-warning text-white font-bold text-xs">
                            เกินกำหนด
                          </span>
                        ) : (
                          <span className="badge badge-success text-white font-bold text-xs">
                            ปกติ
                          </span>
                        )}
                      </td>
                      <td className="text-center">
                        <button
                          type="button"
                          onClick={() =>
                            onPayCredit({
                              id: item.customer_id,
                              name: item.customer_name,
                              phone: item.phone,
                              credit_account: {
                                id: "",
                                customer_id: item.customer_id,
                                credit_limit: item.credit_limit,
                                outstanding_balance: item.outstanding_balance,
                                status: item.status,
                              },
                            })
                          }
                          className="btn btn-sm btn-success text-white font-bold rounded-xl"
                        >
                          รับชำระหนี้
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
    </div>
  );
};
