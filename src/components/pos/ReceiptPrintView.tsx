"use client";

import React from "react";
import { Receipt } from "../../types/api.ts";
import { formatBaht } from "../../utils/currency.ts";

interface ReceiptPrintViewProps {
  receipt: Receipt;
}

export const ReceiptPrintView: React.FC<ReceiptPrintViewProps> = ({
  receipt,
}) => {
  const formattedDate = new Date(receipt.occurred_at).toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="receipt-area w-[80mm] mx-auto p-4 bg-white text-black font-mono text-sm leading-tight border border-dashed border-gray-300 print:border-none">
      {/* Store Header */}
      <div className="text-center pb-3 border-b border-dashed border-gray-400">
        <h2 className="text-xl font-bold tracking-wider">ICE POS</h2>
        <p className="text-xs text-gray-700">ร้านค้าทั่วไป</p>
        <p className="text-xs text-gray-700">โทร. 02-XXX-XXXX</p>
      </div>

      {/* Meta Info */}
      <div className="py-2.5 text-xs space-y-1 border-b border-dashed border-gray-400">
        <div className="flex justify-between">
          <span>เลขที่ใบเสร็จ:</span>
          <span className="font-bold">{receipt.receipt_no}</span>
        </div>
        <div className="flex justify-between">
          <span>เลขที่บิลขาย:</span>
          <span>{receipt.sale_no}</span>
        </div>
        <div className="flex justify-between">
          <span>วันที่:</span>
          <span>{formattedDate}</span>
        </div>
        <div className="flex justify-between">
          <span>แคชเชียร์:</span>
          <span>{receipt.cashier_name}</span>
        </div>
        {receipt.customer_name && (
          <div className="flex justify-between">
            <span>ลูกค้า:</span>
            <span className="font-bold">{receipt.customer_name}</span>
          </div>
        )}
      </div>

      {/* Items List */}
      <div className="py-2.5 border-b border-dashed border-gray-400">
        <div className="flex justify-between text-xs font-bold pb-1.5 border-b border-gray-200">
          <span>รายการ</span>
          <span>รวม</span>
        </div>

        <div className="space-y-1.5 pt-1.5">
          {receipt.items.map((item, idx) => (
            <div
              key={idx}
              className="flex justify-between items-baseline text-xs"
            >
              <div className="pr-2">
                <div>{item.product_name}</div>
                <div className="text-[11px] text-gray-600">
                  {item.qty} x {formatBaht(item.unit_price)}
                </div>
              </div>
              <div className="font-bold text-right shrink-0">
                {formatBaht(item.net_total)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="py-2.5 text-xs space-y-1 border-b border-dashed border-gray-400">
        <div className="flex justify-between">
          <span>ยอดรวมสินค้า:</span>
          <span>{formatBaht(receipt.subtotal)}</span>
        </div>

        {receipt.discount > 0 && (
          <div className="flex justify-between text-red-600">
            <span>ส่วนลด:</span>
            <span>-{formatBaht(receipt.discount)}</span>
          </div>
        )}

        <div className="flex justify-between text-base font-black pt-1">
          <span>ยอดชำระทั้งสิ้น:</span>
          <span>{formatBaht(receipt.grand_total)}</span>
        </div>

        <div className="flex justify-between pt-1 border-t border-gray-100">
          <span>ชำระด้วย:</span>
          <span className="font-bold">
            {receipt.payment_method === "CASH"
              ? "เงินสด (CASH)"
              : "เงินเชื่อ (CREDIT)"}
          </span>
        </div>

        {receipt.payment_method === "CASH" && (
          <>
            <div className="flex justify-between">
              <span>รับเงิน:</span>
              <span>{formatBaht(receipt.tendered)}</span>
            </div>
            <div className="flex justify-between font-bold text-sm">
              <span>เงินทอน:</span>
              <span>{formatBaht(receipt.change)}</span>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="text-center pt-3 text-xs text-gray-600 space-y-0.5">
        <p>ขอบคุณที่ใช้บริการ</p>
        <p className="text-[10px]">
          ใบเสร็จรับเงินอย่างย่อ / Tax Invoice (ABB)
        </p>
      </div>
    </div>
  );
};
