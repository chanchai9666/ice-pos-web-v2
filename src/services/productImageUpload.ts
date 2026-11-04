/**
 * บริการอัปโหลดรูปภาพสินค้าพร้อมสกัด Feature Embedding (AI Vector)
 * ส่งข้อมูลเวกเตอร์ขึ้น Backend API เพื่อใช้ค้นหาสินค้าด้วยกล้อง
 * รองรับการย้อนกลับไปใช้ Legacy Endpoint (/products/:id/image) อัตโนมัติหาก Backend ยังไม่รองรับ
 */

import { apiClient } from "./apiClient.ts";
import {
  visionWorkerClient,
  DEFAULT_VISION_MODEL,
} from "./visionWorkerClient.ts";
import { offlineStorage } from "./offlineStorage.ts";

export interface UploadProductImageDeps {
  apiClient?: {
    upload: <T = unknown>(
      endpoint: string,
      formData: FormData,
      token?: string
    ) => Promise<T>;
  };
  visionWorkerClient?: {
    extractEmbedding: (
      imageSource: ImageData | ImageBitmap | string | Blob
    ) => Promise<{ embedding: number[]; modelName: string }>;
  };
  offlineStorage?: {
    invalidateEmbeddingsCache: () => void;
  };
}

/**
 * อัปโหลดรูปภาพสินค้าและแนบ Embedding เวกเตอร์
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
  const workerClient = deps.visionWorkerClient ?? visionWorkerClient;
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

  try {
    const { embedding, modelName } = await workerClient.extractEmbedding(file);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("embedding", JSON.stringify(embedding));
    formData.append("embedding_model", modelName || DEFAULT_VISION_MODEL);
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
  } catch (extractionError) {
    console.warn(
      "AI vector extraction failed, falling back to legacy /image:",
      extractionError
    );
    return await uploadLegacy();
  }
}
