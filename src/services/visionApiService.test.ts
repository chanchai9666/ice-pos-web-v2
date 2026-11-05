import test from "node:test";
import assert from "node:assert/strict";
import {
  matchFrameViaBackend,
  reindexVisionEmbeddings,
} from "./visionApiService.ts";
import type {
  VisionMatchResponse,
  VisionReindexResponse,
} from "../types/api.ts";

test("matchFrameViaBackend: uploads frame blob to /vision/match with default threshold and limit", async () => {
  const blob = new Blob(["test-pixels"], { type: "image/jpeg" });
  let uploadEndpoint = "";
  let capturedFormData: FormData | undefined;

  const mockResponse: VisionMatchResponse = {
    query_model: "clip-vit-base-patch32",
    matches: [
      {
        product_id: "prod-1",
        product_code: "P001",
        barcode: "8850001",
        product_name: "น้ำแข็งหลอดเล็ก 5kg",
        price: 3500,
        image_url: "/uploads/prod-1.webp",
        confidence: 0.94,
        embedding_model: "clip-vit-base-patch32",
      },
    ],
  };

  const mockDeps = {
    apiClient: {
      upload: async <T>(endpoint: string, formData: FormData): Promise<T> => {
        uploadEndpoint = endpoint;
        capturedFormData = formData;
        return { success: true, data: mockResponse } as T;
      },
      post: async <T>(): Promise<T> => ({}) as T,
    },
  };

  const result = await matchFrameViaBackend(blob, 0.8, 3, mockDeps);

  assert.equal(uploadEndpoint, "/vision/match");
  assert.ok(capturedFormData);
  assert.equal(capturedFormData.get("threshold"), "0.8");
  assert.equal(capturedFormData.get("limit"), "3");
  assert.ok(capturedFormData.get("file"));

  assert.deepEqual(result, mockResponse);
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].product_name, "น้ำแข็งหลอดเล็ก 5kg");
  assert.equal(result.matches[0].confidence, 0.94);
});

test("matchFrameViaBackend: correctly converts Data URL string to blob before upload", async () => {
  // A tiny valid 1x1 GIF data url
  const dataUrl =
    "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  let capturedFormData: FormData | undefined;

  const mockDeps = {
    apiClient: {
      upload: async <T>(_endpoint: string, formData: FormData): Promise<T> => {
        capturedFormData = formData;
        return {
          success: true,
          data: { query_model: "test", matches: [] },
        } as T;
      },
      post: async <T>(): Promise<T> => ({}) as T,
    },
  };

  const res = await matchFrameViaBackend(dataUrl, 0.75, 5, mockDeps);
  assert.ok(capturedFormData);
  const file = capturedFormData.get("file") as Blob;
  assert.ok(file instanceof Blob);
  assert.equal(res.matches.length, 0);
});

test("reindexVisionEmbeddings: calls POST /vision/reindex and returns reindex count", async () => {
  let postEndpoint = "";

  const mockResponse: VisionReindexResponse = {
    reindexed_count: 12,
    message: "สร้าง Vector Embedding สำเร็จ 12 รูปภาพ",
  };

  const mockDeps = {
    apiClient: {
      upload: async <T>(): Promise<T> => ({}) as T,
      post: async <T>(endpoint: string): Promise<T> => {
        postEndpoint = endpoint;
        return { success: true, data: mockResponse } as T;
      },
    },
  };

  const result = await reindexVisionEmbeddings(mockDeps);
  assert.equal(postEndpoint, "/vision/reindex");
  assert.equal(result.reindexed_count, 12);
  assert.equal(result.message, "สร้าง Vector Embedding สำเร็จ 12 รูปภาพ");
});
