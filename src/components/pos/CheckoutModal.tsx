"use client";

import React, { useState, useMemo } from "react";
import { useAuth } from "../../context/AuthContext.tsx";
import { useCart } from "../../context/CartContext.tsx";
import { Customer, CheckoutResponse, Receipt, Sale } from "../../types/api.ts";
import { apiClient } from "../../services/apiClient.ts";
import { offlineStorage } from "../../services/offlineStorage.ts";
import {
  formatBaht,
  satangToBaht,
  bahtToSatang,
} from "../../utils/currency.ts";
import { BanknoteButtons } from "./BanknoteButtons.tsx";
import { Numpad } from "./Numpad.tsx";
import { CustomerSelectModal } from "./CustomerSelectModal.tsx";
import {
  X,
  CreditCard,
  Banknote,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  WifiOff,
} from "lucide-react";

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (receipt: Receipt, sale: Sale) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user, isOffline } = useAuth();
  const {
    items,
    grandTotalSatang,
    subtotalSatang,
    billDiscountSatang,
    clearCart,
  } = useCart();

  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CREDIT">("CASH");
  const [tenderedInput, setTenderedInput] = useState<string>("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const totalBaht = satangToBaht(grandTotalSatang);

  // Parse tendered amount
  const tenderedBaht = useMemo(() => {
    const val = parseFloat(tenderedInput);
    return isNaN(val) ? 0 : val;
  }, [tenderedInput]);

  const tenderedSatang = bahtToSatang(tenderedBaht);

  // Calculate change
  const changeSatang = useMemo(() => {
    if (paymentMethod === "CREDIT") return 0;
    return Math.max(0, tenderedSatang - grandTotalSatang);
  }, [paymentMethod, tenderedSatang, grandTotalSatang]);

  const isCashSufficient = tenderedSatang >= grandTotalSatang;

  const handleBanknoteSelect = (amount: number) => {
    setTenderedInput(amount.toString());
  };

  const handleConfirmCheckout = async () => {
    if (isSubmitting) return;
    setErrorMessage(null);

    if (paymentMethod === "CASH" && !isCashSufficient) {
      setErrorMessage("จำนวนเงินที่รับมาต้องไม่น้อยกว่ายอดรวมที่ต้องชำระ");
      return;
    }

    if (paymentMethod === "CREDIT" && !selectedCustomer) {
      setErrorMessage("กรุณาเลือกลูกค้าเงินเชื่อ");
      return;
    }

    setIsSubmitting(true);

    try {
      const now = new Date();
      const occurredAtIso = now.toISOString();

      if (navigator.onLine) {
        // ONLINE: Call POST /sales API
        const checkoutPayload = {
          lines: items,
          payment_method: paymentMethod,
          tendered_amount: paymentMethod === "CASH" ? tenderedSatang : 0,
          bill_discount: billDiscountSatang,
          customer_id: selectedCustomer ? selectedCustomer.id : undefined,
        };

        const response = await apiClient.post<CheckoutResponse>(
          "/sales",
          checkoutPayload
        );

        if (response && response.success && response.data) {
          clearCart();
          onSuccess(response.data.receipt, response.data.sale);
          onClose();
          return;
        } else {
          throw new Error(
            response.message || "เกิดข้อผิดพลาดในการบันทึกการขาย"
          );
        }
      } else {
        // OFFLINE: Generate Local Sale & Receipt, queue for sync
        const localSaleId = crypto.randomUUID();
        const dateCode = now.toISOString().slice(0, 10).replace(/-/g, "");
        const randCode = Math.floor(1000 + Math.random() * 9000);
        const localSaleNo = `OFF-${dateCode}-${randCode}`;
        const localReceiptNo = `REC-${dateCode}-${randCode}`;

        const offlineSale: Sale = {
          id: localSaleId,
          sale_no: localSaleNo,
          cashier_id: user?.id || "cashier-1",
          cashier_name: user?.full_name || "แคชเชียร์",
          customer_id: selectedCustomer?.id,
          customer_name: selectedCustomer?.name,
          payment_method: paymentMethod,
          subtotal: subtotalSatang,
          bill_discount: billDiscountSatang,
          grand_total: grandTotalSatang,
          tendered_amount: paymentMethod === "CASH" ? tenderedSatang : 0,
          change_amount: changeSatang,
          credit_amount: paymentMethod === "CREDIT" ? grandTotalSatang : 0,
          status: "COMPLETED",
          lines: items,
          occurred_at: occurredAtIso,
        };

        const offlineReceipt: Receipt = {
          receipt_no: localReceiptNo,
          sale_no: localSaleNo,
          cashier_name: user?.full_name || "แคชเชียร์",
          customer_name: selectedCustomer?.name,
          payment_method: paymentMethod,
          subtotal: subtotalSatang,
          discount: billDiscountSatang,
          grand_total: grandTotalSatang,
          tendered: paymentMethod === "CASH" ? tenderedSatang : 0,
          change: changeSatang,
          items: items.map((line) => ({
            product_name: line.product_name,
            qty: line.qty,
            unit_price: line.unit_price,
            net_total: line.net_total,
          })),
          occurred_at: occurredAtIso,
          status: "COMPLETED",
        };

        offlineStorage.queueOfflineSale(offlineSale);
        clearCart();
        onSuccess(offlineReceipt, offlineSale);
        onClose();
        return;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "บันทึกการขายไม่สำเร็จ";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-xs">
        <div className="card bg-base-100 w-full max-w-2xl border-2 border-base-300 shadow-2xl rounded-3xl overflow-hidden flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b-2 border-base-200 flex justify-between items-center bg-base-200/50">
            <div>
              <h3 className="text-2xl sm:text-3xl font-black text-base-content flex items-center gap-2">
                <span>ชำระเงิน</span>
                {isOffline && (
                  <span className="badge badge-warning text-xs font-bold gap-1 py-2 px-2.5 rounded-lg">
                    <WifiOff className="w-3.5 h-3.5" />
                    <span>โหมดออฟไลน์</span>
                  </span>
                )}
              </h3>
              <p className="text-sm font-semibold text-base-content/60">
                เลือกรูปแบบการชำระเงินและตรวจสอบยอดเงิน
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn btn-ghost btn-circle btn-lg text-base-content/60 hover:text-base-content"
              aria-label="ปิดหน้าต่างชำระเงิน"
            >
              <X className="w-7 h-7" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {/* Error Message */}
            {errorMessage && (
              <div className="alert alert-error rounded-2xl text-base font-bold flex items-center gap-2 shadow-sm">
                <AlertCircle className="w-6 h-6 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Total to pay banner */}
            <div className="bg-primary/10 border-2 border-primary/20 rounded-2xl p-4 flex justify-between items-center">
              <div>
                <span className="text-base font-bold text-base-content/70">
                  ยอดที่ต้องชำระ:
                </span>
                <div className="text-sm text-base-content/50">
                  ({items.length} รายการในบิล)
                </div>
              </div>
              <span className="text-3xl sm:text-4xl font-black text-primary">
                {formatBaht(grandTotalSatang)}
              </span>
            </div>

            {/* Payment Method Selector (CASH vs CREDIT) */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod("CASH")}
                className={`btn h-16 text-xl font-black rounded-2xl border-2 transition-all flex items-center justify-center gap-2.5 ${
                  paymentMethod === "CASH"
                    ? "btn-primary shadow-md scale-101"
                    : "btn-outline bg-base-100"
                }`}
              >
                <Banknote className="w-7 h-7" />
                <span>💵 เงินสด (CASH)</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("CREDIT")}
                className={`btn h-16 text-xl font-black rounded-2xl border-2 transition-all flex items-center justify-center gap-2.5 ${
                  paymentMethod === "CREDIT"
                    ? "btn-primary shadow-md scale-101"
                    : "btn-outline bg-base-100"
                }`}
              >
                <CreditCard className="w-7 h-7" />
                <span>📝 เงินเชื่อ (CREDIT)</span>
              </button>
            </div>

            {/* Cash Payment Flow */}
            {paymentMethod === "CASH" && (
              <div className="space-y-4 pt-1">
                {/* Banknote quick buttons */}
                <BanknoteButtons
                  totalBaht={totalBaht}
                  onSelectAmount={handleBanknoteSelect}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                  {/* Left: Input display & change */}
                  <div className="flex flex-col gap-3">
                    <div>
                      <label className="label text-base font-bold text-base-content">
                        จำนวนเงินที่รับ (บาท):
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={tenderedInput ? `${tenderedInput} ฿` : "0.00 ฿"}
                        className="input input-bordered w-full h-16 text-3xl font-black text-right pr-4 rounded-2xl border-2 border-base-300"
                      />
                    </div>

                    {/* Change Box */}
                    <div className="bg-success/15 border-2 border-success/30 rounded-2xl p-4 flex justify-between items-center">
                      <span className="text-lg font-bold text-base-content/80">
                        เงินทอน:
                      </span>
                      <span className="text-3xl sm:text-4xl font-black text-success">
                        {isCashSufficient ? formatBaht(changeSatang) : "0.00 ฿"}
                      </span>
                    </div>
                  </div>

                  {/* Right: Virtual Numpad */}
                  <div>
                    <Numpad
                      value={tenderedInput}
                      onChange={setTenderedInput}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Credit Payment Flow */}
            {paymentMethod === "CREDIT" && (
              <div className="space-y-4 pt-2">
                <div className="card bg-base-200 border-2 border-base-300 p-5 rounded-2xl">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-lg font-extrabold text-base-content">
                      ข้อมูลลูกค้าเงินเชื่อ:
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsCustomerModalOpen(true)}
                      className="btn btn-outline btn-sm font-bold gap-1 rounded-xl"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>
                        {selectedCustomer ? "เปลี่ยนลูกค้า" : "เลือกลูกค้า"}
                      </span>
                    </button>
                  </div>

                  {selectedCustomer ? (
                    <div className="p-4 bg-base-100 rounded-xl border border-base-300">
                      <div className="text-2xl font-black text-primary">
                        {selectedCustomer.name}
                      </div>
                      <div className="text-base text-base-content/70 mt-1">
                        {selectedCustomer.phone
                          ? `เบอร์โทร: ${selectedCustomer.phone}`
                          : "ไม่มีเบอร์โทรศัพท์"}
                      </div>
                      {selectedCustomer.credit_limit !== undefined && (
                        <div className="text-sm font-bold text-base-content/60 mt-1">
                          วงเงินคงเหลือ:{" "}
                          {formatBaht(selectedCustomer.credit_limit)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      onClick={() => setIsCustomerModalOpen(true)}
                      className="p-6 border-2 border-dashed border-base-300 hover:border-primary rounded-xl text-center cursor-pointer transition-colors"
                    >
                      <UserCheck className="w-10 h-10 mx-auto text-base-content/40 mb-2" />
                      <p className="text-xl font-bold text-base-content">
                        กดที่นี่เพื่อเลือกลูกค้า
                      </p>
                      <p className="text-sm text-base-content/60">
                        จำเป็นต้องผูกบิลกับลูกค้าสำหรับยอดเงินเชื่อ
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="p-4 sm:p-5 border-t-2 border-base-200 bg-base-200/50 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn btn-outline h-16 px-6 text-xl font-bold rounded-2xl border-2"
            >
              ยกเลิก
            </button>

            <button
              type="button"
              onClick={handleConfirmCheckout}
              disabled={
                isSubmitting ||
                (paymentMethod === "CASH" && !isCashSufficient) ||
                (paymentMethod === "CREDIT" && !selectedCustomer)
              }
              className="btn btn-success flex-1 h-16 text-2xl font-black rounded-2xl text-white shadow-lg flex items-center justify-center gap-2 active:scale-98"
            >
              {isSubmitting ? (
                <span className="loading loading-spinner loading-lg"></span>
              ) : (
                <>
                  <CheckCircle2 className="w-7 h-7" />
                  <span>บันทึกการขายและพิมพ์ใบเสร็จ</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Customer Selection Modal */}
      <CustomerSelectModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        onSelectCustomer={setSelectedCustomer}
        selectedCustomerId={selectedCustomer?.id}
      />
    </>
  );
};
