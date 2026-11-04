import test from "node:test";
import assert from "node:assert/strict";
import { uploadProductImageWithEmbedding } from "./productImageUpload.ts";
import { apiClient } from "./apiClient.ts";
import {
  visionWorkerClient,
  DEFAULT_VISION_MODEL,
} from "./visionWorkerClient.ts";
import { offlineStorage } from "./offlineStorage.ts";

test("uploadProductImageWithEmbedding: successful embedding extraction and upload to /products/:id/images", async () => {
  const file = new File(["dummy_bytes"], "apple.jpg", { type: "image/jpeg" });
  const mockEmbedding = [0.12, 0.34, 0.56];
  const mockModel = "Xenova/clip-vit-base-patch32";

  let invalidated = false;
  let uploadCalledWith: { endpoint: string; formData: FormData } | undefined;

  const mockDeps = {
    visionWorkerClient: {
      extractEmbedding: async (f: ImageData | ImageBitmap | string | Blob) => {
        assert.equal(f, file);
        return { embedding: mockEmbedding, modelName: mockModel };
      },
    },
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
  assert.equal(fd.get("embedding"), JSON.stringify(mockEmbedding));
  assert.equal(fd.get("embedding_model"), mockModel);
  assert.equal(fd.get("is_primary"), "true");
  assert.equal(invalidated, true, "offlineStorage cache should be invalidated");
});

test("uploadProductImageWithEmbedding: respects isPrimary=false in FormData", async () => {
  const file = new File(["dummy_bytes"], "banana.jpg", { type: "image/jpeg" });
  let uploadCalledWith: { endpoint: string; formData: FormData } | undefined;

  const mockDeps = {
    visionWorkerClient: {
      extractEmbedding: async () => ({
        embedding: [0.9, 0.8],
        modelName: "test-model",
      }),
    },
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

  await uploadProductImageWithEmbedding("prod-456", file, false, mockDeps);

  assert.ok(uploadCalledWith);
  const recorded = uploadCalledWith as { endpoint: string; formData: FormData };
  const fd = recorded.formData;
  assert.equal(fd.get("is_primary"), "false");
});

test("uploadProductImageWithEmbedding: falls back to /products/:id/image when new endpoint fails", async () => {
  const file = new File(["dummy_bytes"], "orange.jpg", { type: "image/jpeg" });
  const calls: { endpoint: string; formData: FormData }[] = [];
  let invalidated = false;

  const mockDeps = {
    visionWorkerClient: {
      extractEmbedding: async () => ({
        embedding: [0.1, 0.2],
        modelName: "test-model",
      }),
    },
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

test("uploadProductImageWithEmbedding: gracefully falls back to legacy upload if embedding extraction throws", async () => {
  const file = new File(["dummy_bytes"], "grape.jpg", { type: "image/jpeg" });
  const calls: { endpoint: string; formData: FormData }[] = [];
  let invalidated = false;

  const mockDeps = {
    visionWorkerClient: {
      extractEmbedding: async () => {
        throw new Error("Worker terminated unexpectedly");
      },
    },
    apiClient: {
      upload: async <T>(endpoint: string, formData: FormData): Promise<T> => {
        calls.push({ endpoint, formData });
        return { success: true, fallback_from_extraction_error: true } as T;
      },
    },
    offlineStorage: {
      invalidateEmbeddingsCache: () => {
        invalidated = true;
      },
    },
  };

  const result = await uploadProductImageWithEmbedding(
    "prod-999",
    file,
    true,
    mockDeps
  );

  assert.deepEqual(result, {
    success: true,
    fallback_from_extraction_error: true,
  });
  assert.equal(
    calls.length,
    1,
    "Should skip new endpoint and go directly to legacy endpoint"
  );
  assert.equal(calls[0].endpoint, "/products/prod-999/image");
  assert.equal(calls[0].formData.get("file"), file);
  assert.equal(invalidated, true);
});

test("uploadProductImageWithEmbedding: rethrows error when both new endpoint and legacy endpoint fail", async () => {
  const file = new File(["dummy_bytes"], "melon.jpg", { type: "image/jpeg" });

  const mockDeps = {
    visionWorkerClient: {
      extractEmbedding: async () => ({
        embedding: [0.5],
        modelName: "test-model",
      }),
    },
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

test("uploadProductImageWithEmbedding: works with default singleton dependencies", async () => {
  const file = new File(["dummy_bytes"], "mango.jpg", { type: "image/jpeg" });
  const originalExtract = visionWorkerClient.extractEmbedding;
  const originalUpload = apiClient.upload;
  const originalInvalidate = offlineStorage.invalidateEmbeddingsCache;

  let uploadEndpoint = "";
  let invalidated = false;

  try {
    visionWorkerClient.extractEmbedding = async () => ({
      embedding: [0.77],
      modelName: DEFAULT_VISION_MODEL,
    });
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
    visionWorkerClient.extractEmbedding = originalExtract;
    apiClient.upload = originalUpload;
    offlineStorage.invalidateEmbeddingsCache = originalInvalidate;
  }
});
