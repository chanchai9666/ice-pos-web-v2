import test from "node:test";
import assert from "node:assert/strict";
import {
  uploadProductImageWithEmbedding,
  uploadProductImage,
} from "./productImageUpload.ts";
import { apiClient } from "./apiClient.ts";
import { offlineStorage } from "./offlineStorage.ts";

test("uploadProductImage: successful upload to /products/:id/images without frontend vector extraction", async () => {
  const file = new File(["dummy_bytes"], "apple.jpg", { type: "image/jpeg" });
  let invalidated = false;
  let uploadCalledWith: { endpoint: string; formData: FormData } | undefined;

  const mockDeps = {
    apiClient: {
      upload: async <T>(endpoint: string, formData: FormData): Promise<T> => {
        uploadCalledWith = { endpoint, formData };
        return { success: true, image_url: "/media/apple.webp" } as T;
      },
    },
    offlineStorage: {
      invalidateEmbeddingsCache: () => {
        invalidated = true;
      },
    },
  };

  const result = await uploadProductImageWithEmbedding(
    "prod-123",
    file,
    true,
    mockDeps
  );

  assert.deepEqual(result, { success: true, image_url: "/media/apple.webp" });
  assert.ok(uploadCalledWith, "apiClient.upload should have been called");
  const recorded = uploadCalledWith as { endpoint: string; formData: FormData };
  assert.equal(recorded.endpoint, "/products/prod-123/images");

  const fd = recorded.formData;
  assert.equal(fd.get("file"), file);
  assert.equal(fd.get("is_primary"), "true");
  // Backend จัดการ Vector ให้เอง หน้าบ้านไม่ต้องแนบ embedding เข้าไป
  assert.equal(fd.get("embedding"), null);
  assert.equal(fd.get("embedding_model"), null);
  assert.equal(invalidated, true, "offlineStorage cache should be invalidated");
});

test("uploadProductImage: respects isPrimary=false in FormData", async () => {
  const file = new File(["dummy_bytes"], "banana.jpg", { type: "image/jpeg" });
  let uploadCalledWith: { endpoint: string; formData: FormData } | undefined;

  const mockDeps = {
    apiClient: {
      upload: async <T>(endpoint: string, formData: FormData): Promise<T> => {
        uploadCalledWith = { endpoint, formData };
        return { success: true } as T;
      },
    },
    offlineStorage: {
      invalidateEmbeddingsCache: () => {},
    },
  };

  await uploadProductImage("prod-456", file, false, mockDeps);

  assert.ok(uploadCalledWith);
  const recorded = uploadCalledWith as { endpoint: string; formData: FormData };
  const fd = recorded.formData;
  assert.equal(fd.get("is_primary"), "false");
});

test("uploadProductImage: falls back to /products/:id/image when new endpoint fails", async () => {
  const file = new File(["dummy_bytes"], "orange.jpg", { type: "image/jpeg" });
  const calls: { endpoint: string; formData: FormData }[] = [];
  let invalidated = false;

  const mockDeps = {
    apiClient: {
      upload: async <T>(endpoint: string, formData: FormData): Promise<T> => {
        calls.push({ endpoint, formData });
        if (endpoint.endsWith("/images")) {
          throw new Error("404 Not Found");
        }
        return { success: true, fallback: true } as T;
      },
    },
    offlineStorage: {
      invalidateEmbeddingsCache: () => {
        invalidated = true;
      },
    },
  };

  const result = await uploadProductImageWithEmbedding(
    "prod-789",
    file,
    true,
    mockDeps
  );

  assert.deepEqual(result, { success: true, fallback: true });
  assert.equal(
    calls.length,
    2,
    "Should have attempted new endpoint then legacy endpoint"
  );
  assert.equal(calls[0].endpoint, "/products/prod-789/images");
  assert.equal(calls[1].endpoint, "/products/prod-789/image");

  // Fallback formData only needs the file attached
  assert.equal(calls[1].formData.get("file"), file);
  assert.equal(
    invalidated,
    true,
    "offlineStorage cache should be invalidated even on fallback"
  );
});

test("uploadProductImage: rethrows error when both new endpoint and legacy endpoint fail", async () => {
  const file = new File(["dummy_bytes"], "melon.jpg", { type: "image/jpeg" });

  const mockDeps = {
    apiClient: {
      upload: async () => {
        throw new Error("Server down");
      },
    },
    offlineStorage: {
      invalidateEmbeddingsCache: () => {},
    },
  };

  await assert.rejects(
    async () => {
      await uploadProductImageWithEmbedding("prod-err", file, true, mockDeps);
    },
    {
      name: "Error",
      message: "Server down",
    }
  );
});

test("uploadProductImage: works with default singleton dependencies", async () => {
  const file = new File(["dummy_bytes"], "mango.jpg", { type: "image/jpeg" });
  const originalUpload = apiClient.upload;
  const originalInvalidate = offlineStorage.invalidateEmbeddingsCache;

  let uploadEndpoint = "";
  let invalidated = false;

  try {
    apiClient.upload = async <T>(endpoint: string): Promise<T> => {
      uploadEndpoint = endpoint;
      return { ok: true } as T;
    };
    offlineStorage.invalidateEmbeddingsCache = () => {
      invalidated = true;
    };

    const res = await uploadProductImageWithEmbedding("prod-def", file);
    assert.deepEqual(res, { ok: true });
    assert.equal(uploadEndpoint, "/products/prod-def/images");
    assert.equal(invalidated, true);
  } finally {
    apiClient.upload = originalUpload;
    offlineStorage.invalidateEmbeddingsCache = originalInvalidate;
  }
});
