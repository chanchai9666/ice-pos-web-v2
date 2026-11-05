"use client";

import React, { useState, useEffect } from "react";
import { Product, Category } from "../../types/api.ts";
import { apiClient } from "../../services/apiClient.ts";
import { uploadProductImageWithEmbedding } from "../../services/productImageUpload.ts";
import { bahtToSatang } from "../../utils/currency.ts";
import {
  Package,
  X,
  Save,
  Image as ImageIcon,
  Camera,
  ScanBarcode,
  Star,
  Trash2,
  Plus,
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

const ANGLE_PRESETS = [
  "หน้าตรง (รูปหลัก)",
  "ด้านหลัง",
  "ด้านข้าง / 45°",
  "ด้านบน / บาร์โค้ด",
  "กล่อง / บรรจุภัณฑ์",
];

export interface ProductPhotoItem {
  id: string;
  file?: File;
  previewUrl: string;
  angleLabel: string;
  isPrimary: boolean;
  isExisting?: boolean;
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

  // รองรับหลายรูปภาพต่างมุมมอง (Multi-Angle Enrollment 3-5 รูปภาพ)
  const [photos, setPhotos] = useState<ProductPhotoItem[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState("");
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

      // โหลดรูปภาพเดิมของสินค้า
      if (product.images && product.images.length > 0) {
        setPhotos(
          product.images.map((img, idx) => ({
            id: img.id,
            previewUrl: img.image_url,
            angleLabel: ANGLE_PRESETS[idx] || `มุมมองที่ ${idx + 1}`,
            isPrimary: Boolean(img.is_primary),
            isExisting: true,
          }))
        );
      } else if (product.image_url) {
        setPhotos([
          {
            id: "existing-primary",
            previewUrl: product.image_url,
            angleLabel: ANGLE_PRESETS[0],
            isPrimary: true,
            isExisting: true,
          },
        ]);
      } else {
        setPhotos([]);
      }
    } else {
      setName("");
      setCode(`PRD-${Date.now().toString().slice(-6)}`);
      setBarcode("");
      setCategoryId(categories.length > 0 ? categories[0].id : "");
      setPriceBaht("");
      setCostPriceBaht("0");
      setIsActive(true);
      setPhotos([]);
    }
    setIsUploadingPhotos(false);
    setUploadProgressText("");
    setError(null);
  }, [product, categories, isOpen]);

  if (!isOpen) return null;

  const handleAddPhoto = (file: File) => {
    if (photos.length >= 5) {
      toast.warning("บันทึกรูปภาพได้สูงสุด 5 มุมมองต่อสินค้า");
      return;
    }
    const nextIdx = photos.length;
    const angleLabel = ANGLE_PRESETS[nextIdx] || `มุมมองที่ ${nextIdx + 1}`;
    const hasPrimary = photos.some((p) => p.isPrimary);
    const newPhoto: ProductPhotoItem = {
      id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      angleLabel,
      isPrimary: !hasPrimary,
      isExisting: false,
    };
    setPhotos((prev) => [...prev, newPhoto]);
  };

  const handleSetPrimary = (photoId: string) => {
    setPhotos((prev) =>
      prev.map((p) => ({
        ...p,
        isPrimary: p.id === photoId,
      }))
    );
  };

  const handleRemovePhoto = (photoId: string) => {
    setPhotos((prev) => {
      const filtered = prev.filter((p) => p.id !== photoId);
      if (filtered.length > 0 && !filtered.some((p) => p.isPrimary)) {
        filtered[0].isPrimary = true;
      }
      return filtered;
    });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      handleAddPhoto(file);
      // Reset input value เพื่อให้เลือกไฟล์เดิมซ้ำได้ถ้าต้องการ
      e.target.value = "";
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

      // อัปโหลดรูปภาพใหม่ทีละมุมมอง (Multi-Angle Enrollment)
      // หลังบ้านจะทำการบีบอัดเป็น WebP (<=50KB) และสกัด Vector Embedding (512 มิติ) ให้อัตโนมัติ
      const newPhotos = photos.filter((p) => !p.isExisting && p.file);
      if (newPhotos.length > 0 && savedProductId) {
        setIsUploadingPhotos(true);
        for (let i = 0; i < newPhotos.length; i++) {
          const currentPhoto = newPhotos[i];
          setUploadProgressText(
            `กำลังอัปโหลดรูปภาพที่ ${i + 1} จาก ${newPhotos.length} (${currentPhoto.angleLabel})...`
          );
          try {
            await uploadProductImageWithEmbedding(
              savedProductId,
              currentPhoto.file!,
              currentPhoto.isPrimary
            );
          } catch (uploadErr) {
            console.warn(`Product photo ${i + 1} upload warning:`, uploadErr);
          }
        }
        setIsUploadingPhotos(false);
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

          {isUploadingPhotos && (
            <div className="alert alert-info text-sm font-bold rounded-2xl py-2 px-4 flex items-center gap-2">
              <span className="loading loading-spinner loading-xs"></span>
              <span>{uploadProgressText || "กำลังอัปโหลดรูปภาพสินค้า..."}</span>
            </div>
          )}

          {/* Multi-Angle Image Upload / Preview Grid (3-5 รูปภาพ) */}
          <div className="p-4 border-2 border-dashed border-base-300 rounded-3xl bg-base-200/30 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="text-sm font-black flex items-center gap-1.5 text-base-content">
                  <ImageIcon className="w-4 h-4 text-primary" />
                  <span>รูปถ่ายสินค้า AI Vision ({photos.length}/5 รูป)</span>
                </label>
                <p className="text-xs text-base-content/60 font-medium mt-0.5">
                  แนะนำถ่าย 3–5 รูปภาพ (หน้าตรง, หลัง, ข้าง 45°, ฉลากบาร์โค้ด)
                  เพื่อความแม่นยำสูงสุด 99%+
                </p>
              </div>

              {photos.length < 5 && (
                <div className="flex items-center gap-2 shrink-0">
                  <label className="btn btn-sm btn-outline rounded-xl font-bold gap-1.5 cursor-pointer">
                    <Plus className="w-4 h-4" />
                    <span>เลือกไฟล์</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCameraOpen(true)}
                    className="btn btn-sm btn-primary rounded-xl font-bold gap-1.5"
                    title="ถ่ายภาพมุมมองใหม่จากกล้อง"
                  >
                    <Camera className="w-4 h-4" />
                    <span>ถ่ายภาพ</span>
                  </button>
                </div>
              )}
            </div>

            {/* Photo Thumbnails Grid */}
            {photos.length === 0 ? (
              <div
                onClick={() => setIsCameraOpen(true)}
                className="py-6 px-4 border border-dashed border-base-300 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-base-200/50 transition-colors text-base-content/50"
              >
                <Camera className="w-8 h-8 text-primary/60" />
                <span className="text-xs font-bold">
                  ยังไม่มีรูปภาพ แตะเพื่อถ่ายภาพมุมที่ 1 (หน้าตรง)
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 pt-1">
                {photos.map((item) => (
                  <div
                    key={item.id}
                    className={`relative rounded-2xl overflow-hidden border-2 bg-base-100 flex flex-col shadow-xs group transition-all ${
                      item.isPrimary
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-base-300 hover:border-base-content/30"
                    }`}
                  >
                    {/* Thumbnail Image */}
                    <div className="relative aspect-square w-full bg-base-300 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.previewUrl}
                        alt={item.angleLabel}
                        className="w-full h-full object-cover"
                      />

                      {/* Primary Badge */}
                      {item.isPrimary ? (
                        <div className="absolute top-1.5 left-1.5 badge badge-primary badge-xs font-bold shadow-xs">
                          รูปหลัก
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetPrimary(item.id)}
                          className="absolute top-1.5 left-1.5 btn btn-xs btn-circle bg-black/60 hover:bg-primary text-white border-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="ตั้งเป็นรูปหลัก"
                        >
                          <Star className="w-3 h-3" />
                        </button>
                      )}

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(item.id)}
                        className="absolute top-1.5 right-1.5 btn btn-xs btn-circle bg-black/60 hover:bg-error text-white border-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="ลบรูปนี้"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Angle Label */}
                    <div className="p-1.5 text-center bg-base-100 border-t border-base-200">
                      <span className="text-[11px] font-bold text-base-content/80 truncate block">
                        {item.angleLabel}
                      </span>
                    </div>
                  </div>
                ))}

                {photos.length < 5 && (
                  <button
                    type="button"
                    onClick={() => setIsCameraOpen(true)}
                    className="aspect-square rounded-2xl border-2 border-dashed border-base-300 hover:border-primary flex flex-col items-center justify-center gap-1.5 text-base-content/60 hover:text-primary transition-all bg-base-100/50 hover:bg-primary/5 cursor-pointer"
                  >
                    <Plus className="w-5 h-5" />
                    <span className="text-[11px] font-bold">
                      + มุมที่ {photos.length + 1}
                    </span>
                  </button>
                )}
              </div>
            )}
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
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  <span>
                    {isUploadingPhotos
                      ? uploadProgressText || "กำลังอัปโหลดรูปภาพสินค้า..."
                      : isEditing
                        ? "กำลังบันทึกการแก้ไข..."
                        : "กำลังบันทึกสินค้าใหม่..."}
                  </span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>
                    {isEditing ? "บันทึกการแก้ไข" : "บันทึกสินค้าใหม่"}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={(file) => {
          handleAddPhoto(file);
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
