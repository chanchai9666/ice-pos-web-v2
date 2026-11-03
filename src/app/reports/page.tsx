"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext.tsx";
import { DailySalesSummary, BestSellerItem, Sale } from "../../types/api.ts";
import { apiClient } from "../../services/apiClient.ts";
import { HeaderBar } from "../../components/pos/HeaderBar.tsx";
import { formatBaht } from "../../utils/currency.ts";
import {
  FileText,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Ban,
  Calendar,
  RefreshCw,
  Award,
  CreditCard,
} from "lucide-react";

export default function ReportsPage() {
  const router = useRouter();
  const { user, token, isLoading: isAuthLoading } = useAuth();

  const [selectedDate, setSelectedDate] = useState<string>("");
  const [summary, setSummary] = useState<DailySalesSummary | null>(null);
  const [bestSellers, setBestSellers] = useState<BestSellerItem[]>([]);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize date on mount
  useEffect(() => {
    setSelectedDate(new Date().toISOString().split("T")[0]);
  }, []);

  // Protect route
  useEffect(() => {
    if (!isAuthLoading && !token) {
      router.push("/login");
    }
  }, [token, isAuthLoading, router]);

  const loadReport = useCallback(async () => {
    if (!selectedDate) return;
    setIsLoading(true);
    setError(null);
    try {
      const [sumRes, bestRes, salesRes] = await Promise.all([
        apiClient.get<{ data: DailySalesSummary; success: boolean }>(
          `/reports/sales-summary?date=${selectedDate}`
        ),
        apiClient.get<{ data: BestSellerItem[]; success: boolean }>(
          `/reports/best-sellers?start_date=${selectedDate}&end_date=${selectedDate}&limit=20`
        ),
        apiClient.get<{ data: Sale[]; success: boolean }>(
          `/sales?start_date=${selectedDate}&end_date=${selectedDate}&limit=50`
        ),
      ]);

      if (sumRes && sumRes.data) {
        setSummary(sumRes.data);
      }
      if (bestRes && bestRes.data) {
        setBestSellers(bestRes.data);
      }
      if (salesRes && salesRes.data) {
        setRecentSales(salesRes.data);
      }
    } catch (err: unknown) {
      console.error("Failed to load reports:", err);
      setError("ไม่สามารถดึงข้อมูลรายงานได้ (ตรวจสอบการเชื่อมต่อ API)");
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    if (token) {
      loadReport();
    }
  }, [token, loadReport]);

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

  const maxRevenue = Math.max(
    ...bestSellers.map((b) => b.total_revenue || 0),
    1
  );

  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      <HeaderBar />

      <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Header & Date Filter */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-3xl font-black text-base-content flex items-center gap-2.5">
              <FileText className="w-8 h-8 text-primary" />
              รายงานสรุปยอดขายและการวิเคราะห์
            </h2>
            <p className="text-sm font-semibold text-base-content/60 mt-1">
              ตรวจสอบยอดขาย กำไรขั้นต้น และสินค้าขายดีประจำวัน
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-base-100 border-2 border-base-300 px-3 py-1.5 rounded-2xl shadow-xs">
              <Calendar className="w-5 h-5 text-primary" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="font-bold text-base bg-transparent border-none focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={loadReport}
              disabled={isLoading}
              className="btn btn-primary h-11 px-4 rounded-xl font-bold gap-2"
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">โหลดใหม่</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="alert alert-error rounded-2xl font-bold text-center">
            {error}
          </div>
        )}

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Sales */}
          <div className="card bg-base-100 border-2 border-base-300 p-5 rounded-3xl shadow-xs">
            <div className="flex justify-between items-center text-base-content/70">
              <span className="text-sm font-bold">ยอดขายรวม</span>
              <DollarSign className="w-6 h-6 text-primary" />
            </div>
            <div className="text-3xl font-black text-primary mt-2">
              {formatBaht(summary?.total_sales || 0)}
            </div>
            <div className="text-xs font-semibold text-base-content/60 mt-1">
              ยอดเงินสดรับจริง: {formatBaht(summary?.total_cash_collected || 0)}
            </div>
          </div>

          {/* Gross Profit */}
          <div className="card bg-base-100 border-2 border-base-300 p-5 rounded-3xl shadow-xs">
            <div className="flex justify-between items-center text-base-content/70">
              <span className="text-sm font-bold">
                กำไรขั้นต้น (Gross Profit)
              </span>
              <TrendingUp className="w-6 h-6 text-success" />
            </div>
            <div className="text-3xl font-black text-success mt-2">
              {formatBaht(summary?.gross_profit || 0)}
            </div>
            <div className="text-xs font-semibold text-base-content/60 mt-1">
              ต้นทุนสินค้า: {formatBaht(summary?.total_cost || 0)}
            </div>
          </div>

          {/* Bill Count */}
          <div className="card bg-base-100 border-2 border-base-300 p-5 rounded-3xl shadow-xs">
            <div className="flex justify-between items-center text-base-content/70">
              <span className="text-sm font-bold">จำนวนบิลขายสำเร็จ</span>
              <ShoppingCart className="w-6 h-6 text-info" />
            </div>
            <div className="text-3xl font-black text-base-content mt-2">
              {summary?.bill_count || 0} <span className="text-lg">บิล</span>
            </div>
            <div className="text-xs font-semibold text-base-content/60 mt-1">
              เฉลี่ยต่อบิล:{" "}
              {summary?.bill_count
                ? formatBaht(
                    Math.round((summary.total_sales || 0) / summary.bill_count)
                  )
                : "฿0.00"}
            </div>
          </div>

          {/* Void Count */}
          <div className="card bg-base-100 border-2 border-base-300 p-5 rounded-3xl shadow-xs">
            <div className="flex justify-between items-center text-base-content/70">
              <span className="text-sm font-bold">บิลที่ถูกยกเลิก (Void)</span>
              <Ban className="w-6 h-6 text-error" />
            </div>
            <div className="text-3xl font-black text-error mt-2">
              {summary?.void_count || 0} <span className="text-lg">บิล</span>
            </div>
            <div className="text-xs font-semibold text-base-content/60 mt-1">
              รายการยกเลิกประจำวัน
            </div>
          </div>
        </div>

        {/* 2-Column Section: Best Sellers & Sales Transactions */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Best Sellers (5 cols) */}
          <div className="lg:col-span-5 card bg-base-100 border-2 border-base-300 rounded-3xl overflow-hidden shadow-xs">
            <div className="p-4 border-b-2 border-base-200 bg-base-200/40 flex justify-between items-center">
              <h3 className="text-lg font-black text-base-content flex items-center gap-2">
                <Award className="w-5 h-5 text-warning" />
                สินค้าขายดีประจำวัน (Top Sellers)
              </h3>
            </div>

            <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
              {bestSellers.length === 0 ? (
                <div className="text-center py-12 text-base-content/50">
                  <p className="font-bold">ไม่มีข้อมูลสินค้าขายดีในวันนี้</p>
                </div>
              ) : (
                bestSellers.map((item, index) => {
                  const percentage = Math.round(
                    (item.total_revenue / maxRevenue) * 100
                  );
                  return (
                    <div
                      key={item.product_id}
                      className="p-3 bg-base-200/50 rounded-2xl border border-base-300 space-y-1.5"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-primary/20 text-primary font-black text-xs flex items-center justify-center">
                            {index + 1}
                          </span>
                          <span className="font-bold text-sm text-base-content">
                            {item.product_name}
                          </span>
                        </div>
                        <span className="font-bold text-xs text-base-content/70">
                          ขายได้ {item.total_qty_sold} ชิ้น
                        </span>
                      </div>

                      <div className="w-full bg-base-300 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-primary h-2 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>

                      <div className="text-right text-xs font-black text-primary">
                        ยอดขาย: {formatBaht(item.total_revenue)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Sales Table (7 cols) */}
          <div className="lg:col-span-7 card bg-base-100 border-2 border-base-300 rounded-3xl overflow-hidden shadow-xs">
            <div className="p-4 border-b-2 border-base-200 bg-base-200/40 flex justify-between items-center">
              <h3 className="text-lg font-black text-base-content flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                รายการบิลขายในวัน ({recentSales.length} รายการ)
              </h3>
            </div>

            <div className="p-4 overflow-x-auto max-h-[500px]">
              {recentSales.length === 0 ? (
                <div className="text-center py-12 text-base-content/50">
                  <p className="font-bold">ไม่มีบิลขายในวันที่เลือก</p>
                </div>
              ) : (
                <table className="table table-zebra table-sm w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-base-300 font-bold text-base-content/70">
                      <th>เลขที่บิล</th>
                      <th>เวลา</th>
                      <th>ประเภท</th>
                      <th className="text-right">ยอดรวม</th>
                      <th>สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentSales.map((sale) => (
                      <tr key={sale.id} className="hover">
                        <td className="font-mono font-bold text-primary">
                          {sale.sale_no}
                        </td>
                        <td className="font-mono text-xs whitespace-nowrap">
                          {sale.occurred_at
                            ? new Date(sale.occurred_at).toLocaleTimeString(
                                "th-TH"
                              )
                            : "-"}
                        </td>
                        <td>
                          {sale.payment_method === "CREDIT" ? (
                            <span className="badge badge-warning text-xs font-bold">
                              เงินเชื่อ
                            </span>
                          ) : (
                            <span className="badge badge-ghost text-xs font-bold">
                              เงินสด
                            </span>
                          )}
                        </td>
                        <td className="text-right font-black text-base-content">
                          {formatBaht(sale.grand_total)}
                        </td>
                        <td>
                          {sale.status === "VOID" ||
                          sale.status === "VOIDED" ? (
                            <span className="badge badge-error text-white text-xs font-bold">
                              ยกเลิก
                            </span>
                          ) : (
                            <span className="badge badge-success text-white text-xs font-bold">
                              สำเร็จ
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
