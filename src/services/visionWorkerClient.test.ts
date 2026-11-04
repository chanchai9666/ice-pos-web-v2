import test from "node:test";
import assert from "node:assert/strict";
import {
  createVisionWorkerClient,
  visionWorkerClient,
} from "./visionWorkerClient.ts";
import type { CatalogItemEmbedding, MatchResult } from "./visualMatch.ts";

/**
 * Mock Worker implementation for testing client bridge in Node.js
 */
class MockWorker {
  messages: unknown[] = [];
  terminated = false;
  onmessage: ((e: MessageEvent<unknown>) => void) | null = null;
  onerror: ((e: ErrorEvent | unknown) => void) | null = null;
  private listeners: Record<string, ((e: unknown) => void)[]> = {};

  addEventListener(type: string, listener: (e: unknown) => void) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(listener);
  }

  removeEventListener(type: string, listener: (e: unknown) => void) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter((l) => l !== listener);
    }
  }

  postMessage(message: unknown) {
    this.messages.push(message);
  }

  terminate() {
    this.terminated = true;
  }

  emitMessage(data: unknown) {
    const event = { data } as MessageEvent<unknown>;
    if (this.onmessage) {
      this.onmessage(event);
    }
    if (this.listeners["message"]) {
      for (const listener of this.listeners["message"]) {
        listener(event);
      }
    }
  }

  emitError(error: unknown) {
    const event = typeof error === "string" ? new Error(error) : error;
    if (this.onerror) {
      this.onerror(event);
    }
    if (this.listeners["error"]) {
      for (const listener of this.listeners["error"]) {
        listener(event);
      }
    }
  }
}

interface WorkerMessagePayload {
  type: string;
  id?: string;
  modelName?: string;
  catalog?: CatalogItemEmbedding[];
  image?: unknown;
  options?: { topK?: number; highThreshold?: number };
}

test("visionWorkerClient: singleton exists and is safe in Node/SSR without throwing", () => {
  assert.ok(visionWorkerClient);
  assert.equal(typeof visionWorkerClient.init, "function");
  assert.equal(typeof visionWorkerClient.matchFrame, "function");
  assert.equal(typeof visionWorkerClient.extractEmbedding, "function");
  assert.equal(typeof visionWorkerClient.updateCatalog, "function");
  assert.equal(visionWorkerClient.isReady(), false);
  assert.equal(visionWorkerClient.isLoading(), false);
});

test("init: resolves when worker responds with INIT_SUCCESS and handles progress", async () => {
  let mockWorker!: MockWorker;
  const client = createVisionWorkerClient(() => {
    mockWorker = new MockWorker();
    return mockWorker as unknown as Worker;
  });

  assert.equal(client.isReady(), false);
  assert.equal(client.isLoading(), false);

  const progressUpdates: number[] = [];
  const unsubscribe = client.onProgress((p) => {
    progressUpdates.push(p);
  });

  const initPromise = client.init();
  assert.equal(client.isLoading(), true);

  // Worker receives INIT
  assert.equal(mockWorker.messages.length, 1);
  const firstMsg = mockWorker.messages[0] as WorkerMessagePayload;
  assert.equal(firstMsg.type, "INIT");
  assert.equal(firstMsg.modelName, "Xenova/clip-vit-base-patch32");

  // Worker reports progress
  mockWorker.emitMessage({ type: "PROGRESS", progress: 25 });
  mockWorker.emitMessage({ type: "PROGRESS", progress: 75 });
  assert.deepEqual(progressUpdates, [25, 75]);

  // Worker finishes init
  mockWorker.emitMessage({
    type: "INIT_SUCCESS",
    modelName: "Xenova/clip-vit-base-patch32",
  });
  await initPromise;

  assert.equal(client.isReady(), true);
  assert.equal(client.isLoading(), false);

  // Calling init again when already ready resolves immediately
  await client.init();
  assert.equal(mockWorker.messages.length, 1); // No new INIT message sent

  unsubscribe();
});

test("init: supports custom modelName parameter", async () => {
  let mockWorker!: MockWorker;
  const client = createVisionWorkerClient(() => {
    mockWorker = new MockWorker();
    return mockWorker as unknown as Worker;
  });

  const initPromise = client.init("custom/clip-model");
  const firstMsg = mockWorker.messages[0] as WorkerMessagePayload;
  assert.equal(firstMsg.modelName, "custom/clip-model");

  mockWorker.emitMessage({
    type: "INIT_SUCCESS",
    modelName: "custom/clip-model",
  });
  await initPromise;
  assert.equal(client.isReady(), true);
});

test("updateCatalog: sends SET_CATALOG to worker and keeps in-memory sync", () => {
  let mockWorker!: MockWorker;
  const client = createVisionWorkerClient(() => {
    mockWorker = new MockWorker();
    return mockWorker as unknown as Worker;
  });

  const mockCatalog: CatalogItemEmbedding[] = [
    { productId: "p1", embedding: [0.1, 0.2, 0.3] },
    { productId: "p2", embedding: [0.4, 0.5, 0.6] },
  ];

  client.updateCatalog(mockCatalog);

  // Worker was initialized and received catalog
  assert.ok(mockWorker);
  const setCatalogMsg = (mockWorker.messages as WorkerMessagePayload[]).find(
    (m) => m.type === "SET_CATALOG"
  );
  assert.ok(setCatalogMsg);
  assert.deepEqual(setCatalogMsg.catalog, mockCatalog);
});

test("matchFrame: generates unique request ID, sends image, and resolves with matching result", async () => {
  let mockWorker!: MockWorker;
  const client = createVisionWorkerClient(() => {
    mockWorker = new MockWorker();
    return mockWorker as unknown as Worker;
  });

  const mockImage =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const matchOptions = { topK: 3, highThreshold: 0.85 };

  const matchPromise = client.matchFrame(mockImage, matchOptions);

  const matchMsg = (mockWorker.messages as WorkerMessagePayload[]).find(
    (m) => m.type === "MATCH_FRAME"
  );
  assert.ok(matchMsg);
  assert.ok(typeof matchMsg.id === "string" && matchMsg.id.length > 0);
  assert.equal(matchMsg.image, mockImage);
  assert.deepEqual(matchMsg.options, matchOptions);

  const mockResult: MatchResult = {
    tier: "HIGH_CONFIDENCE",
    bestMatch: { productId: "prod-1", score: 0.92 },
    candidates: [{ productId: "prod-1", score: 0.92 }],
  };

  mockWorker.emitMessage({
    type: "MATCH_RESULT",
    id: matchMsg.id,
    result: mockResult,
  });

  const result = await matchPromise;
  assert.deepEqual(result, mockResult);
});

test("matchFrame: handles concurrent requests with distinct IDs", async () => {
  let mockWorker!: MockWorker;
  const client = createVisionWorkerClient(() => {
    mockWorker = new MockWorker();
    return mockWorker as unknown as Worker;
  });

  const p1 = client.matchFrame("frame1");
  const p2 = client.matchFrame("frame2");

  const matchMsgs = (mockWorker.messages as WorkerMessagePayload[]).filter(
    (m) => m.type === "MATCH_FRAME"
  );
  assert.equal(matchMsgs.length, 2);
  assert.notEqual(matchMsgs[0].id, matchMsgs[1].id);

  const res1: MatchResult = {
    tier: "HIGH_CONFIDENCE",
    bestMatch: { productId: "p1", score: 0.9 },
    candidates: [{ productId: "p1", score: 0.9 }],
  };
  const res2: MatchResult = {
    tier: "NO_MATCH",
    bestMatch: null,
    candidates: [],
  };

  // Resolve out of order
  mockWorker.emitMessage({
    type: "MATCH_RESULT",
    id: matchMsgs[1].id,
    result: res2,
  });
  mockWorker.emitMessage({
    type: "MATCH_RESULT",
    id: matchMsgs[0].id,
    result: res1,
  });

  const [actual1, actual2] = await Promise.all([p1, p2]);
  assert.deepEqual(actual1, res1);
  assert.deepEqual(actual2, res2);
});

test("extractEmbedding: generates unique request ID, sends image, and resolves with embedding and modelName", async () => {
  let mockWorker!: MockWorker;
  const client = createVisionWorkerClient(() => {
    mockWorker = new MockWorker();
    return mockWorker as unknown as Worker;
  });

  const mockImage = "data:image/jpeg;base64,mock";
  const extractPromise = client.extractEmbedding(mockImage);

  const extractMsg = (mockWorker.messages as WorkerMessagePayload[]).find(
    (m) => m.type === "EXTRACT_EMBEDDING"
  );
  assert.ok(extractMsg);
  assert.ok(typeof extractMsg.id === "string");
  assert.equal(extractMsg.image, mockImage);

  const fakeEmbedding = [0.123, -0.456, 0.789];
  mockWorker.emitMessage({
    type: "EXTRACT_RESULT",
    id: extractMsg.id,
    embedding: fakeEmbedding,
    modelName: "Xenova/clip-vit-base-patch32",
  });

  const result = await extractPromise;
  assert.deepEqual(result.embedding, fakeEmbedding);
  assert.equal(result.modelName, "Xenova/clip-vit-base-patch32");
});

test("error handling: propagates ERROR with request id to matching pending promise", async () => {
  let mockWorker!: MockWorker;
  const client = createVisionWorkerClient(() => {
    mockWorker = new MockWorker();
    return mockWorker as unknown as Worker;
  });

  const matchPromise = client.matchFrame("invalid-frame");
  const matchMsg = (mockWorker.messages as WorkerMessagePayload[]).find(
    (m) => m.type === "MATCH_FRAME"
  );
  assert.ok(matchMsg);

  mockWorker.emitMessage({
    type: "ERROR",
    id: matchMsg.id,
    error: "Failed to decode image input",
  });

  await assert.rejects(
    async () => await matchPromise,
    (err: Error) => {
      assert.equal(err.message, "Failed to decode image input");
      return true;
    }
  );
});

test("error handling: propagates init ERROR to init() promise", async () => {
  let mockWorker!: MockWorker;
  const client = createVisionWorkerClient(() => {
    mockWorker = new MockWorker();
    return mockWorker as unknown as Worker;
  });

  const initPromise = client.init();
  mockWorker.emitMessage({
    type: "ERROR",
    error: "Failed to fetch model weights from HuggingFace",
  });

  await assert.rejects(
    async () => await initPromise,
    (err: Error) => {
      assert.equal(
        err.message,
        "Failed to fetch model weights from HuggingFace"
      );
      return true;
    }
  );

  assert.equal(client.isReady(), false);
  assert.equal(client.isLoading(), false);
});

test("error handling: propagates worker onerror event to pending requests", async () => {
  let mockWorker!: MockWorker;
  const client = createVisionWorkerClient(() => {
    mockWorker = new MockWorker();
    return mockWorker as unknown as Worker;
  });

  const matchPromise = client.matchFrame("frame");
  mockWorker.emitError(new Error("Worker thread crashed"));

  await assert.rejects(
    async () => await matchPromise,
    (err: Error) => {
      assert.ok(err.message.includes("Worker thread crashed"));
      return true;
    }
  );
});

test("terminate: terminates worker and cancels pending requests", async () => {
  let mockWorker!: MockWorker;
  const client = createVisionWorkerClient(() => {
    mockWorker = new MockWorker();
    return mockWorker as unknown as Worker;
  });

  const matchPromise = client.matchFrame("frame");
  client.terminate();

  assert.equal(mockWorker.terminated, true);
  assert.equal(client.isReady(), false);
  assert.equal(client.isLoading(), false);

  await assert.rejects(
    async () => await matchPromise,
    (err: Error) => {
      assert.ok(err.message.includes("terminated"));
      return true;
    }
  );
});

test("onProgress: unsubscribing stops receiving progress updates", async () => {
  let mockWorker!: MockWorker;
  const client = createVisionWorkerClient(() => {
    mockWorker = new MockWorker();
    return mockWorker as unknown as Worker;
  });

  const calls: number[] = [];
  const unsubscribe = client.onProgress((p) => {
    calls.push(p);
  });

  client.init();
  mockWorker.emitMessage({ type: "PROGRESS", progress: 10 });
  assert.deepEqual(calls, [10]);

  unsubscribe();
  mockWorker.emitMessage({ type: "PROGRESS", progress: 20 });
  assert.deepEqual(calls, [10]); // Unchanged
});

test("fallback: createVisionWorkerClient without worker support throws descriptive error when initialized", async () => {
  // In Node environment without global Worker and without workerFactory
  const client = createVisionWorkerClient();

  await assert.rejects(
    async () => await client.init(),
    (err: Error) => {
      assert.ok(err.message.includes("Web Worker is not supported"));
      return true;
    }
  );
});
