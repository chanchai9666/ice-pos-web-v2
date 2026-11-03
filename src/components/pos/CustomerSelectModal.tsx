"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Customer } from "../../types/api.ts";
import { syncService } from "../../services/syncService.ts";
import { formatBaht } from "../../utils/currency.ts";
import { CreateCustomerModal } from "../customers/CreateCustomerModal.tsx";
import { UserCheck, Search, X, Check, UserPlus } from "lucide-react";

interface CustomerSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCustomer: (customer: Customer) => void;
  selectedCustomerId?: string;
}

export const CustomerSelectModal: React.FC<CustomerSelectModalProps> = ({
  isOpen,
  onClose,
  onSelectCustomer,
  selectedCustomerId,
}) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  useEffect(() => {
    let active = true;
    if (isOpen) {
      syncService.pullCustomers().then((data) => {
        if (active) {
          setCustomers(data);
          setIsLoading(false);
        }
      });
    }
    return () => {
      active = false;
    };
  }, [isOpen]);

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q))
    );
  }, [customers, search]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <div className="card bg-base-100 w-full max-w-lg border-2 border-base-300 shadow-2xl rounded-3xl overflow-hidden flex flex-col max-h-[85vh]">
          {/* Header */}
          <div className="p-5 border-b-2 border-base-200 flex justify-between items-center bg-base-200/50">
            <div className="flex items-center gap-2">
              <UserCheck className="w-7 h-7 text-primary" />
              <h3 className="text-2xl font-black text-base-content">
                เลือกลูกค้าเงินเชื่อ
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost btn-circle btn-sm"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Search Input & Quick Add */}
          <div className="p-4 border-b border-base-200 flex gap-2">
            <div className="relative flex-1">
              <Search className="w-6 h-6 absolute left-4 top-1/2 -translate-y-1/2 text-base-content/50" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาชื่อ หรือ เบอร์โทรลูกค้า..."
                className="input input-bordered w-full h-14 pl-12 pr-4 text-xl font-bold rounded-2xl border-2"
                autoFocus
              />
            </div>
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="btn btn-primary h-14 px-4 rounded-2xl font-black gap-1.5 shadow-xs"
              title="ลงทะเบียนลูกค้าใหม่ทันที"
            >
              <UserPlus className="w-5 h-5" />
              <span className="hidden sm:inline">ลูกค้าใหม่</span>
            </button>
          </div>

          {/* Customer List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {isLoading ? (
              <div className="text-center py-10">
                <span className="loading loading-spinner loading-lg text-primary"></span>
                <p className="text-lg font-bold mt-2">
                  กำลังโหลดข้อมูลลูกค้า...
                </p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-10 text-base-content/60">
                <p className="text-xl font-bold">ไม่พบข้อมูลลูกค้า</p>
              </div>
            ) : (
              filtered.map((customer) => {
                const isSelected = selectedCustomerId === customer.id;
                const creditLimit =
                  customer.credit_account?.credit_limit ??
                  customer.credit_limit;
                const balance =
                  customer.credit_account?.outstanding_balance ?? 0;
                const remaining =
                  creditLimit !== undefined
                    ? Math.max(0, creditLimit - balance)
                    : null;

                return (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => {
                      onSelectCustomer(customer);
                      onClose();
                    }}
                    className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-base-300 hover:border-primary/50 bg-base-100 hover:bg-base-200/50"
                    }`}
                  >
                    <div>
                      <h4 className="text-xl font-extrabold text-base-content">
                        {customer.name}
                      </h4>
                      <p className="text-base font-semibold text-base-content/60 mt-0.5">
                        {customer.phone
                          ? `โทร: ${customer.phone}`
                          : "ไม่มีเบอร์โทร"}
                      </p>
                    </div>

                    <div className="text-right">
                      {creditLimit !== undefined && (
                        <div className="flex flex-col items-end">
                          <span className="text-sm font-bold text-base-content/70">
                            วงเงิน: {formatBaht(creditLimit)}
                          </span>
                          {remaining !== null && (
                            <span className="text-xs font-semibold text-success">
                              คงเหลือ: {formatBaht(remaining)}
                            </span>
                          )}
                        </div>
                      )}
                      {isSelected && (
                        <Check className="w-7 h-7 text-primary ml-auto mt-1" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      <CreateCustomerModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={(newCustomer) => {
          setCustomers((prev) => [newCustomer, ...prev]);
          onSelectCustomer(newCustomer);
          onClose();
        }}
      />
    </>
  );
};
