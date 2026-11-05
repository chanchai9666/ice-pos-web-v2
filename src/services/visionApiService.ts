/**
 * Vision AI Service (Backend API Integration)
 * ให้บริการเชื่อมต่อกับ Backend Vision AI Microservice:
 * 1. Server-side Visual AI Matching (POST /api/v1/vision/match)
 * 2. Batch Vector Reindexing (POST /api/v1/vision/reindex)
 */

import { apiClient } from "./apiClient.ts";
import type {
  VisionMatchResponse,
  VisionReindexResponse,
} from "../types/api.ts";

export interface VisionApiServiceDeps {
  apiClient?: {
    upload: <T = unknown>(
      endpoint: string,
      formData: FormData,
      token?: string
    ) => Promise<T>;
    post: <T = unknown>(
      endpoint: string,
      body?: unknown,
      token?: string
    ) => Promise<T>;
  };
}

/**
 * แปลง Data URL (Base64) หรือ Object URL เป็น Blob
 */
async function toBlob(source: Blob | File | string): Promise<Blob> {
  if (typeof source !== "string") {
    return source;
  }

  // หากเป็น Base64 Data URL
  if (source.startsWith("data:")) {
    const parts = source.split(",");
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  }

  // กรณีเป็น URL อื่นๆ (เช่น Blob URL หรือ HTTP URL)
  const res = await fetch(source);
  return await res.blob();
}

/**
 * ส่งเฟรมภาพจากกล้องขึ้นไปค้นหาสินค้าที่หลังบ้าน (Server-side Visual AI Recognition)
 *
 * @param imageSource เฟรมภาพจากกล้อง (Blob, File หรือ Data URL string)
 * @param threshold เกณฑ์ความแม่นยำขั้นต่ำ (Default: 0.70)
 * @param limit จำนวนผลลัพธ์สูงสุด (Default: 5)
 * @param deps Dependency injection สำหรับการทดสอบ
 */
export async function matchFrameViaBackend(
  imageSource: Blob | File | string,
  threshold = 0.7,
  limit = 5,
  deps: VisionApiServiceDeps = {}
): Promise<VisionMatchResponse> {
  const client = deps.apiClient ?? apiClient;
  const blob = await toBlob(imageSource);

  const formData = new FormData();
  formData.append("file", blob, "frame.jpg");
  formData.append("threshold", String(threshold));
  formData.append("limit", String(limit));

  const res = await client.upload<{
    success: boolean;
    data: VisionMatchResponse;
  }>("/vision/match", formData);

  if (res && typeof res === "object" && "data" in res && res.data) {
    return res.data;
  }
  return res as unknown as VisionMatchResponse;
}

/**
 * สั่งให้ระบบหลังบ้านสร้าง Vector Embedding ย้อนหลังให้กับรูปสินค้าที่ยังไม่มี
 *
 * @param deps Dependency injection สำหรับการทดสอบ
 */
export async function reindexVisionEmbeddings(
  deps: VisionApiServiceDeps = {}
): Promise<VisionReindexResponse> {
  const client = deps.apiClient ?? apiClient;

  const res = await client.post<{
    success: boolean;
    data: VisionReindexResponse;
  }>("/vision/reindex");

  if (res && typeof res === "object" && "data" in res && res.data) {
    return res.data;
  }
  return res as unknown as VisionReindexResponse;
}
