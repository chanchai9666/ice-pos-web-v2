"use client";

import React, { useState, useEffect } from "react";
import { Product, Category } from "../../types/api.ts";
import { apiClient } from "../../services/apiClient.ts";
import { bahtToSatang } from "../../utils/currency.ts";
import {
  Package,
  X,
  Save,
  Image as ImageIcon,
  Camera,
  ScanBarcode,
} from "lucide-react";
import { useToast } from "../../context/ToastContext.tsx";
import { CameraCaptureModal } from "../common/CameraCaptureModal.tsx";
import { BarcodeScannerModal } from "../common/BarcodeScannerModal.tsx";

interface ProductFormModalProps {
  isOpen: boolean;
  product?: Product | null;
  categories: Category[];
  onClose: () => void;
  onSuccess: () => void;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  product,
  categories,
  onClose,
  onSuccess,
}) => {
  const { toast } = useToast();
  const isEditing = Boolean(product);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [barcode, setBarcode] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [priceBaht, setPriceBaht] = useState("");
  const [costPriceBaht, setCostPriceBaht] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      setName(product.name || "");
      setCode(product.code || "");
      setBarcode(product.barcode || "");
      setCategoryId(product.category_id || "");
      const priceSatang = product.price ?? product.unit_price ?? 0;
      setPriceBaht((priceSatang / 100).toString());
      setCostPriceBaht(
        product.cost_price !== undefined
          ? (product.cost_price / 100).toString()
          : "0"
      );
      setIsActive(product.is_active !== false);
      setPreviewUrl(product.image_url || null);
    } else {
      setName("");
      setCode(`PRD-${Date.now().toString().slice(-6)}`);
      setBarcode("");
      setCategoryId(categories.length > 0 ? categories[0].id : "");
      setPriceBaht("");
      setCostPriceBaht("0");
      setIsActive(true);
      setPreviewUrl(null);
    }
    setImageFile(null);
    setError(null);
  }, [product, categories, isOpen]);

  if (!isOpen) return null;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("กรุณาระบุชื่อสินค้า");
      return;
    }
    if (!code.trim()) {
      setError("กรุณาระบุรหัสสินค้า (Code)");
      return;
    }
    if (!categoryId) {
      setError("กรุณาเลือกหมวดหมู่สินค้า");
      return;
    }

    const priceNum = parseFloat(priceBaht);
    if (isNaN(priceNum) || priceNum < 0) {
      setError("กรุณาระบุราคาขายที่ถูกต้อง");
      return;
    }

    const costNum = parseFloat(costPriceBaht) || 0;

    setIsLoading(true);
    setError(null);

    const priceSatang = bahtToSatang(priceNum);
    const costSatang = bahtToSatang(costNum);

    try {
      let savedProductId = product?.id;

      if (isEditing && product) {
        await apiClient.put(`/products/${product.id}`, {
          name: name.trim(),
          code: code.trim(),
          barcode: barcode.trim() || undefined,
          category_id: categoryId,
          price: priceSatang,
          cost_price: costSatang,
          is_active: isActive,
        });
      } else {
        const createRes = await apiClient.post<{
          data: Product;
          success: boolean;
        }>("/products", {
          name: name.trim(),
          code: code.trim(),
          barcode: barcode.trim() || undefined,
          category_id: categoryId,
          price: priceSatang,
          cost_price: costSatang,
          is_active: isActive,
        });
        if (createRes && createRes.data) {
          savedProductId = createRes.data.id;
        }
      }

      // If there's an image file to upload
      if (imageFile && savedProductId) {
        try {
          const formData = new FormData();
          formData.append("file", imageFile);
          await apiClient.upload(`/products/${savedProductId}/image`, formData);
        } catch (uploadErr) {
          console.warn("Product image upload warning:", uploadErr);
        }
      }

      toast.success(
        isEditing ? "แก้ไขสินค้าเรียบร้อยแล้ว" : "สร้างสินค้าใหม่เรียบร้อยแล้ว"
      );
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "เกิดข้อผิดพลาดในการบันทึกข้อมูลสินค้า";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="card bg-base-100 w-full max-w-xl border-2 border-base-300 shadow-2xl rounded-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b-2 border-base-200 flex justify-between items-center bg-base-200/50">
          <div className="flex items-center gap-2.5">
            <Package className="w-7 h-7 text-primary" />
            <h3 className="text-2xl font-black text-base-content">
              {isEditing ? "แก้ไขข้อมูลสินค้า" : "เพิ่มสินค้าใหม่"}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="alert alert-error text-sm font-bold rounded-2xl py-2 px-4">
              <span>{error}</span>
            </div>
          )}

          {/* Image Upload / Preview */}
          <div className="flex items-center gap-4 p-3.5 border-2 border-dashed border-base-300 rounded-2xl bg-base-200/30">
            <div className="w-20 h-20 rounded-xl bg-base-300 overflow-hidden flex items-center justify-center relative shrink-0">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="Product preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <ImageIcon className="w-8 h-8 text-base-content/40" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <label className="text-sm font-bold block mb-1.5">
                รูปภาพสินค้า (แปลงเป็น WebP อัตโนมัติ)
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="file-input file-input-bordered file-input-sm flex-1 rounded-xl w-full"
                />
                <button
                  type="button"
                  onClick={() => setIsCameraOpen(true)}
                  className="btn btn-outline btn-primary btn-sm rounded-xl font-bold gap-1.5 shrink-0 self-start sm:self-auto"
                  title="ถ่ายภาพจากกล้อง"
                >
                  <Camera className="w-4 h-4" />
                  <span>ถ่ายภาพ</span>
                </button>
              </div>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="label text-base font-bold pb-1">
              ชื่อสินค้า <span className="text-error">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ระบุชื่อสินค้า..."
              className="input input-bordered w-full h-12 text-lg font-bold rounded-xl"
            />
          </div>

          {/* Code & Barcode */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            <div className="sm:col-span-5">
              <label className="label text-base font-bold pb-1">
                รหัสสินค้า (Code) <span className="text-error">*</span>
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="เช่น PRD-001"
                className="input input-bordered w-full h-12 font-mono font-bold rounded-xl"
              />
            </div>
            <div className="sm:col-span-7">
              <label className="label text-base font-bold pb-1">
                บาร์โค้ด (Barcode)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="ยิงบาร์โค้ดที่นี่..."
                  className="input input-bordered flex-1 h-12 font-mono font-bold rounded-xl text-base"
                />
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="btn btn-primary h-12 px-3.5 sm:px-4 rounded-xl font-bold gap-1.5 shrink-0 shadow-sm"
                  title="เปิดกล้องสแกนบาร์โค้ด"
                >
                  <ScanBarcode className="w-5 h-5" />
                  <span>สแกน</span>
                </button>
              </div>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="label text-base font-bold pb-1">
              หมวดหมู่สินค้า <span className="text-error">*</span>
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="select select-bordered w-full h-12 text-base font-bold rounded-xl"
            >
              <option value="" disabled>
                -- เลือกหมวดหมู่ --
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Price & Cost */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label text-base font-bold pb-1">
                ราคาขาย (บาท) <span className="text-error">*</span>
              </label>
              <input
                type="number"
                step="0.25"
                min="0"
                required
                value={priceBaht}
                onChange={(e) => setPriceBaht(e.target.value)}
                placeholder="0.00"
                className="input input-bordered w-full h-12 text-xl font-black text-primary rounded-xl"
              />
            </div>
            <div>
              <label className="label text-base font-bold pb-1">
                ราคาต้นทุน (บาท)
              </label>
              <input
                type="number"
                step="0.25"
                min="0"
                value={costPriceBaht}
                onChange={(e) => setCostPriceBaht(e.target.value)}
                placeholder="0.00"
                className="input input-bordered w-full h-12 text-lg font-bold rounded-xl"
              />
            </div>
          </div>

          {/* Active status */}
          <div className="form-control pt-1">
            <label className="label cursor-pointer justify-start gap-3">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="toggle toggle-primary"
              />
              <span className="label-text text-base font-bold">
                เปิดขายสินค้านี้ (Active)
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="modal-action pt-4 border-t border-base-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="btn btn-ghost h-12 px-6 rounded-xl font-bold"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary h-12 px-6 rounded-xl font-black gap-2 shadow-sm"
            >
              {isLoading ? (
                <span className="loading loading-spinner loading-sm"></span>
              ) : (
                <Save className="w-5 h-5" />
              )}
              <span>{isEditing ? "บันทึกการแก้ไข" : "บันทึกสินค้าใหม่"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={(file) => {
          setImageFile(file);
          setPreviewUrl(URL.createObjectURL(file));
        }}
      />

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onDetected={(scannedCode) => {
          setBarcode(scannedCode);
        }}
        allowContinuous={false}
      />
    </div>
  );
};
