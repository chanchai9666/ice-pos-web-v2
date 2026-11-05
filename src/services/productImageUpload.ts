/**
 * บริการอัปโหลดรูปภาพสินค้า
 * ส่งไฟล์รูปภาพขึ้น Backend API (/api/v1/products/:id/images)
 * โดย Backend จะบีบอัดภาพเป็น WebP (<= 50KB) และสกัด Embedding Vector (512 มิติ) ให้อัตโนมัติ
 * หน้าบ้านไม่ต้องรันโมเดล Vision AI หรือ Web Worker อีกต่อไป
 * รองรับการย้อนกลับไปใช้ Legacy Endpoint (/products/:id/image) อัตโนมัติหาก Backend ยังไม่รองรับ
 */

import { apiClient } from "./apiClient.ts";
import { offlineStorage } from "./offlineStorage.ts";

export interface UploadProductImageDeps {
  apiClient?: {
    upload: <T = unknown>(
      endpoint: string,
      formData: FormData,
      token?: string
    ) => Promise<T>;
  };
  offlineStorage?: {
    invalidateEmbeddingsCache: () => void;
  };
  // เก็บ visionWorkerClient เผื่อ backward compatibility
  visionWorkerClient?: unknown;
}

/**
 * อัปโหลดรูปภาพสินค้าขึ้นระบบหลังบ้าน
 *
 * @param productId รหัสสินค้า
 * @param file ไฟล์รูปภาพที่เลือกหรือถ่ายจากกล้อง
 * @param isPrimary รูปหลักของสินค้าหรือไม่ (ค่าเริ่มต้นคือ true)
 * @param deps Dependency injection สำหรับการทดสอบ (ไม่ระบุก็จะใช้ค่าเริ่มต้น)
 */
export async function uploadProductImageWithEmbedding(
  productId: string,
  file: File,
  isPrimary = true,
  deps: UploadProductImageDeps = {}
): Promise<unknown> {
  const client = deps.apiClient ?? apiClient;
  const storage = deps.offlineStorage ?? offlineStorage;

  const uploadLegacy = async () => {
    const legacyFormData = new FormData();
    legacyFormData.append("file", file);
    const result = await client.upload(
      `/products/${productId}/image`,
      legacyFormData
    );
    storage.invalidateEmbeddingsCache();
    return result;
  };

  const formData = new FormData();
  formData.append("file", file);
  formData.append("is_primary", String(isPrimary));

  try {
    const result = await client.upload(
      `/products/${productId}/images`,
      formData
    );
    storage.invalidateEmbeddingsCache();
    return result;
  } catch (newEndpointError) {
    console.warn(
      "Upload to /images failed, falling back to legacy /image:",
      newEndpointError
    );
    return await uploadLegacy();
  }
}

// Alias สำหรับเรียกใช้งานแบบตรงไปตรงมา
export const uploadProductImage = uploadProductImageWithEmbedding;
