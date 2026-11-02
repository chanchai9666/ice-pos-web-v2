"use client";

import React, { useState, useEffect, useCallback } from "react";
import { DailySalesSummary, BestSellerItem } from "../../types/api.ts";
import { apiClient } from "../../services/apiClient.ts";
import { formatBaht } from "../../utils/currency.ts";
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  CreditCard,
  Ban,
  X,
  RefreshCw,
} from "lucide-react";

interface DailySummaryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DailySummaryDrawer: React.FC<DailySummaryDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const [summary, setSummary] = useState<DailySalesSummary | null>(null);
  const [bestSellers, setBestSellers] = useState<BestSellerItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [sumRes, bestRes] = await Promise.all([
        apiClient.get<{ data: DailySalesSummary; success: boolean }>(
          "/reports/sales-summary"
        ),
        apiClient.get<{ data: BestSellerItem[]; success: boolean }>(
          "/reports/best-sellers"
        ),
      ]);

      if (sumRes && sumRes.data) {
        setSummary(sumRes.data);
      }
      if (bestRes && bestRes.data) {
        setBestSellers(bestRes.data);
      }
    } catch (err: unknown) {
      console.error("Failed to load daily report:", err);
      setError("ไม่สามารถดึงรายงานยอดขายได้ (ตรวจสอบการเชื่อมต่อ API)");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    if (isOpen) {
      Promise.all([
        apiClient.get<{ data: DailySalesSummary; success: boolean }>(
          "/reports/sales-summary"
        ),
        apiClient.get<{ data: BestSellerItem[]; success: boolean }>(
          "/reports/best-sellers"
        ),
      ])
        .then(([sumRes, bestRes]) => {
          if (active) {
            if (sumRes?.data) setSummary(sumRes.data);
            if (bestRes?.data) setBestSellers(bestRes.data);
            setIsLoading(false);
          }
        })
        .catch((err) => {
          if (active) {
            console.error("Failed to load daily report:", err);
            setError("ไม่สามารถดึงรายงานยอดขายได้ (ตรวจสอบการเชื่อมต่อ API)");
            setIsLoading(false);
          }
        });
    }
    return () => {
      active = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-xs">
      <div className="card bg-base-100 w-full max-w-xl h-full border-l-2 border-base-300 shadow-2xl rounded-none sm:rounded-l-3xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b-2 border-base-200 flex justify-between items-center bg-base-200/50">
          <div className="flex items-center gap-2.5">
            <BarChart3 className="w-8 h-8 text-primary" />
            <div>
              <h3 className="text-2xl font-black text-base-content">
                สรุปยอดขายประจำวัน
              </h3>
              <p className="text-sm font-semibold text-base-content/60">
                ภาพรวมรายได้ประจำกะ
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {error && (
            <div className="alert alert-warning text-sm font-bold rounded-2xl">
              <span>{error}</span>
            </div>
          )}

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <span className="loading loading-spinner loading-lg text-primary"></span>
              <p className="text-xl font-bold">กำลังประมวลผลรายงาน...</p>
            </div>
          ) : (
            <>
              {/* Grand Total Revenue Card */}
              <div className="card bg-primary text-primary-content p-6 rounded-3xl shadow-lg">
                <span className="text-base font-bold opacity-80">
                  ยอดขายรวมทั้งสิ้น
                </span>
                <span className="text-4xl sm:text-5xl font-black mt-1">
                  {formatBaht(summary?.total_sales || 0)}
                </span>
                <div className="mt-3 text-sm font-semibold opacity-90 flex justify-between border-t border-primary-content/20 pt-2">
                  <span>จำนวนบิลที่สำเร็จ:</span>
                  <span className="font-bold">
                    {summary?.total_transactions || 0} บิล
                  </span>
                </div>
              </div>

              {/* Stats Breakdown Grid */}
              <div className="grid grid-cols-2 gap-3.5">
                {/* Cash Sales */}
                <div className="p-4 bg-base-200 border-2 border-base-300 rounded-2xl">
                  <div className="flex items-center gap-2 text-success font-extrabold text-base mb-1">
                    <DollarSign className="w-5 h-5" />
                    <span>เงินสด (CASH)</span>
                  </div>
                  <div className="text-2xl font-black text-base-content">
                    {formatBaht(summary?.cash_sales || 0)}
                  </div>
                </div>

                {/* Credit Sales */}
                <div className="p-4 bg-base-200 border-2 border-base-300 rounded-2xl">
                  <div className="flex items-center gap-2 text-info font-extrabold text-base mb-1">
                    <CreditCard className="w-5 h-5" />
                    <span>เงินเชื่อ (CREDIT)</span>
                  </div>
                  <div className="text-2xl font-black text-base-content">
                    {formatBaht(summary?.credit_sales || 0)}
                  </div>
                </div>
              </div>

              {/* Voided Sales */}
              <div className="p-4 bg-error/10 border-2 border-error/20 rounded-2xl flex justify-between items-center">
                <div className="flex items-center gap-2 text-error font-extrabold text-base">
                  <Ban className="w-5 h-5" />
                  <span>ยอดบิลที่ถูกยกเลิก (Void):</span>
                </div>
                <span className="text-2xl font-black text-error">
                  {formatBaht(summary?.voided_sales || 0)}
                </span>
              </div>

              {/* Top Selling Products */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-6 h-6 text-primary" />
                  <h4 className="text-xl font-black text-base-content">
                    สินค้าขายดีประจำวัน
                  </h4>
                </div>

                {bestSellers.length === 0 ? (
                  <p className="text-base text-base-content/50 italic">
                    ยังไม่มีสถิติสินค้าขายดีในวันนี้
                  </p>
                ) : (
                  <div className="space-y-2">
                    {bestSellers.map((item, index) => (
                      <div
                        key={item.product_id || index}
                        className="flex items-center justify-between p-3.5 bg-base-200/60 rounded-xl border border-base-300"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-full bg-primary/20 text-primary font-black text-sm flex items-center justify-center">
                            {index + 1}
                          </span>
                          <div>
                            <div className="text-base font-extrabold text-base-content">
                              {item.product_name}
                            </div>
                            <div className="text-xs text-base-content/60 font-semibold">
                              ขายได้ {item.total_qty} หน่วย
                            </div>
                          </div>
                        </div>

                        <span className="text-lg font-black text-primary">
                          {formatBaht(item.total_revenue)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t-2 border-base-200 bg-base-100 flex gap-3">
          <button
            type="button"
            onClick={loadReport}
            disabled={isLoading}
            className="btn btn-outline flex-1 h-14 text-lg font-bold rounded-2xl gap-2"
          >
            <RefreshCw
              className={`w-5 h-5 ${isLoading ? "animate-spin" : ""}`}
            />
            <span>รีเฟรชข้อมูล</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-primary h-14 px-8 text-lg font-bold rounded-2xl"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};
