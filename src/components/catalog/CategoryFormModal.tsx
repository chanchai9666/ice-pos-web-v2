"use client";

import React, { useState, useEffect } from "react";
import {
  Category,
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from "../../types/api.ts";
import { apiClient } from "../../services/apiClient.ts";
import { Tag, X, Save, AlertCircle } from "lucide-react";
import { useToast } from "../../context/ToastContext.tsx";

interface CategoryFormModalProps {
  isOpen: boolean;
  category?: Category | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const CategoryFormModal: React.FC<CategoryFormModalProps> = ({
  isOpen,
  category,
  onClose,
  onSuccess,
}) => {
  const { toast } = useToast();
  const isEditing = Boolean(category);

  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (category) {
      setName(category.name || "");
      setSortOrder(category.sort_order ?? 0);
    } else {
      setName("");
      setSortOrder(0);
    }
    setError(null);
  }, [category, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("กรุณาระบุชื่อหมวดหมู่สินค้า");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (isEditing && category) {
        const payload: UpdateCategoryRequest = {
          name: trimmedName,
          sort_order: Number(sortOrder) || 0,
        };
        await apiClient.put(`/categories/${category.id}`, payload);
      } else {
        const payload: CreateCategoryRequest = {
          name: trimmedName,
          sort_order: Number(sortOrder) || 0,
        };
        await apiClient.post("/categories", payload);
      }

      toast.success(
        isEditing
          ? "แก้ไขหมวดหมู่สินค้าเรียบร้อยแล้ว"
          : "สร้างหมวดหมู่สินค้าเรียบร้อยแล้ว"
      );
      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error("Failed to save category:", err);
      let errMsg = "เกิดข้อผิดพลาดในการบันทึกหมวดหมู่สินค้า";
      if (err && typeof err === "object" && "data" in err) {
        const d = (err as { data?: { message?: string } }).data;
        if (d?.message) {
          errMsg = d.message;
        }
      } else if (err instanceof Error) {
        errMsg = err.message;
      }
      setError(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-base-100 rounded-3xl max-w-lg w-full border-2 border-base-300 shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b-2 border-base-300 bg-base-200/50">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-xl text-base-content">
                {isEditing ? "แก้ไขหมวดหมู่สินค้า" : "เพิ่มหมวดหมู่สินค้าใหม่"}
              </h3>
              <p className="text-xs font-semibold text-base-content/60">
                {isEditing
                  ? `รหัสหมวดหมู่: ${category?.id}`
                  : "สร้างหมวดหมู่เพื่อจัดกลุ่มรายการสินค้าในระบบ POS"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-sm btn-circle btn-ghost text-base-content/60 hover:text-base-content"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="alert alert-error rounded-2xl text-sm font-bold flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-base-content">
              ชื่อหมวดหมู่สินค้า <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น เครื่องดื่ม, เบเกอรี่, ขนมขบเคี้ยว"
              maxLength={100}
              className="input input-bordered w-full h-12 font-bold rounded-2xl text-base"
              autoFocus
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-base-content flex items-center justify-between">
              <span>ลำดับการแสดงผล (Sort Order)</span>
              <span className="text-xs font-normal text-base-content/60">
                ตัวเลขน้อยจะแสดงก่อนในหน้าร้าน
              </span>
            </label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
              placeholder="0"
              min={0}
              step={1}
              className="input input-bordered w-full h-12 font-mono font-bold rounded-2xl text-base"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-base-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="btn btn-ghost h-12 px-6 rounded-2xl font-bold"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary h-12 px-6 rounded-2xl font-black gap-2 shadow-sm"
            >
              {isLoading ? (
                <span className="loading loading-spinner loading-sm"></span>
              ) : (
                <Save className="w-5 h-5" />
              )}
              <span>{isEditing ? "บันทึกการแก้ไข" : "สร้างหมวดหมู่"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
