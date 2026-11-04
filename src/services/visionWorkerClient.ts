/**
 * บริการเชื่อมต่อ Web Worker สำหรับ Vision AI (Transformers.js Feature Extraction & Visual Matching)
 * ทำงานแบบ Asynchronous นอก UI Thread หลักเพื่อไม่ให้กระทบต่อประสิทธิภาพหน้าจอ POS
 */

import type {
  CatalogItemEmbedding,
  MatchOptions,
  MatchResult,
} from "./visualMatch.ts";

export const DEFAULT_VISION_MODEL = "Xenova/clip-vit-base-patch32";

export interface VisionWorkerClient {
  init(modelName?: string): Promise<void>;
  updateCatalog(catalog: CatalogItemEmbedding[]): void;
  matchFrame(
    imageSource: ImageData | ImageBitmap | string,
    options?: MatchOptions
  ): Promise<MatchResult>;
  extractEmbedding(
    imageSource: ImageData | ImageBitmap | string | Blob
  ): Promise<{ embedding: number[]; modelName: string }>;
  isReady(): boolean;
  isLoading(): boolean;
  onProgress(callback: (progress: number) => void): () => void;
  terminate(): void;
}

interface WorkerMessageData {
  type: string;
  id?: string;
  progress?: number;
  modelName?: string;
  result?: MatchResult;
  embedding?: number[];
  error?: string;
}

export function createVisionWorkerClient(
  workerFactory?: () => Worker
): VisionWorkerClient {
  let worker: Worker | null = null;
  let ready = false;
  let loading = false;
  let initPromise: Promise<void> | null = null;
  let initResolver: {
    resolve: () => void;
    reject: (err: Error) => void;
  } | null = null;
  let cachedCatalog: CatalogItemEmbedding[] = [];
  const progressCallbacks = new Set<(progress: number) => void>();
  let reqIdCounter = 0;
  const pendingMatchRequests = new Map<
    string,
    {
      resolve: (data: MatchResult) => void;
      reject: (err: Error) => void;
    }
  >();
  const pendingExtractRequests = new Map<
    string,
    {
      resolve: (data: { embedding: number[]; modelName: string }) => void;
      reject: (err: Error) => void;
    }
  >();

  function handleWorkerMessage(data: unknown) {
    if (!data || typeof data !== "object") return;
    const msg = data as WorkerMessageData;

    switch (msg.type) {
      case "PROGRESS": {
        if (typeof msg.progress === "number") {
          for (const cb of progressCallbacks) {
            try {
              cb(msg.progress);
            } catch (err) {
              console.error("Error in onProgress callback:", err);
            }
          }
        }
        break;
      }
      case "INIT_SUCCESS": {
        ready = true;
        loading = false;
        if (initResolver) {
          initResolver.resolve();
          initResolver = null;
        }
        break;
      }
      case "MATCH_RESULT": {
        if (msg.id && msg.result && pendingMatchRequests.has(msg.id)) {
          const req = pendingMatchRequests.get(msg.id)!;
          pendingMatchRequests.delete(msg.id);
          req.resolve(msg.result);
        }
        break;
      }
      case "EXTRACT_RESULT": {
        if (msg.id && msg.embedding && pendingExtractRequests.has(msg.id)) {
          const req = pendingExtractRequests.get(msg.id)!;
          pendingExtractRequests.delete(msg.id);
          req.resolve({
            embedding: msg.embedding,
            modelName: msg.modelName || DEFAULT_VISION_MODEL,
          });
        }
        break;
      }
      case "ERROR": {
        const error = new Error(msg.error || "Worker operation failed");
        if (msg.id) {
          if (pendingMatchRequests.has(msg.id)) {
            const req = pendingMatchRequests.get(msg.id)!;
            pendingMatchRequests.delete(msg.id);
            req.reject(error);
          } else if (pendingExtractRequests.has(msg.id)) {
            const req = pendingExtractRequests.get(msg.id)!;
            pendingExtractRequests.delete(msg.id);
            req.reject(error);
          }
        } else {
          ready = false;
          loading = false;
          initPromise = null;
          if (initResolver) {
            initResolver.reject(error);
            initResolver = null;
          }
        }
        break;
      }
    }
  }

  function handleWorkerError(event: unknown) {
    ready = false;
    loading = false;
    initPromise = null;
    let errorMsg = "Vision worker error";
    if (event instanceof Error) {
      errorMsg = event.message;
    } else if (
      event &&
      typeof event === "object" &&
      "message" in event &&
      typeof (event as { message: unknown }).message === "string"
    ) {
      errorMsg = (event as { message: string }).message;
    }
    const error = new Error(errorMsg);

    if (initResolver) {
      initResolver.reject(error);
      initResolver = null;
    }

    for (const [, req] of pendingMatchRequests) {
      req.reject(error);
    }
    pendingMatchRequests.clear();

    for (const [, req] of pendingExtractRequests) {
      req.reject(error);
    }
    pendingExtractRequests.clear();
  }

  function getOrCreateWorker(): Worker {
    if (!worker) {
      if (workerFactory) {
        worker = workerFactory();
      } else if (typeof Worker !== "undefined") {
        worker = new Worker(
          new URL("../workers/visionMatcher.worker.ts", import.meta.url),
          { type: "module" }
        );
      } else {
        throw new Error("Web Worker is not supported in this environment");
      }

      const handleMsg = (event: MessageEvent<unknown>) =>
        handleWorkerMessage(event.data);
      const handleErr = (event: Event | ErrorEvent) => handleWorkerError(event);

      if (typeof worker.addEventListener === "function") {
        worker.addEventListener("message", handleMsg);
        worker.addEventListener("error", handleErr);
      } else {
        worker.onmessage = handleMsg;
        worker.onerror = handleErr;
      }

      if (cachedCatalog.length > 0) {
        worker.postMessage({
          type: "SET_CATALOG",
          catalog: cachedCatalog,
        });
      }
    }
    return worker;
  }

  return {
    async init(modelName?: string): Promise<void> {
      if (ready) {
        return;
      }
      if (initPromise) {
        return initPromise;
      }

      loading = true;
      initPromise = new Promise<void>((resolve, reject) => {
        initResolver = { resolve, reject };
        try {
          const w = getOrCreateWorker();
          w.postMessage({
            type: "INIT",
            modelName: modelName || DEFAULT_VISION_MODEL,
          });
        } catch (err) {
          loading = false;
          initPromise = null;
          initResolver = null;
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      });

      return initPromise;
    },

    updateCatalog(catalog: CatalogItemEmbedding[]): void {
      cachedCatalog = catalog;
      try {
        const w = getOrCreateWorker();
        w.postMessage({
          type: "SET_CATALOG",
          catalog: cachedCatalog,
        });
      } catch {
        // ในสภาพแวดล้อมที่ไม่มี Worker (เช่น SSR) ให้เก็บแคชไว้เพื่อส่งเมื่อ Worker พร้อม
      }
    },

    async matchFrame(
      imageSource: ImageData | ImageBitmap | string,
      options?: MatchOptions
    ): Promise<MatchResult> {
      const w = getOrCreateWorker();
      const id = `match_${++reqIdCounter}_${Date.now()}`;

      return new Promise<MatchResult>((resolve, reject) => {
        pendingMatchRequests.set(id, { resolve, reject });
        w.postMessage({
          type: "MATCH_FRAME",
          id,
          image: imageSource,
          options,
        });
      });
    },

    async extractEmbedding(
      imageSource: ImageData | ImageBitmap | string | Blob
    ): Promise<{ embedding: number[]; modelName: string }> {
      const w = getOrCreateWorker();
      const id = `extract_${++reqIdCounter}_${Date.now()}`;

      return new Promise<{ embedding: number[]; modelName: string }>(
        (resolve, reject) => {
          pendingExtractRequests.set(id, { resolve, reject });
          w.postMessage({
            type: "EXTRACT_EMBEDDING",
            id,
            image: imageSource,
          });
        }
      );
    },

    isReady(): boolean {
      return ready;
    },

    isLoading(): boolean {
      return loading;
    },

    onProgress(callback: (progress: number) => void): () => void {
      progressCallbacks.add(callback);
      return () => {
        progressCallbacks.delete(callback);
      };
    },

    terminate(): void {
      if (worker) {
        worker.terminate();
        worker = null;
      }
      ready = false;
      loading = false;
      initPromise = null;
      if (initResolver) {
        initResolver.reject(new Error("Vision worker terminated"));
        initResolver = null;
      }
      for (const [, req] of pendingMatchRequests) {
        req.reject(new Error("Vision worker terminated"));
      }
      pendingMatchRequests.clear();

      for (const [, req] of pendingExtractRequests) {
        req.reject(new Error("Vision worker terminated"));
      }
      pendingExtractRequests.clear();
    },
  };
}

export const visionWorkerClient: VisionWorkerClient =
  createVisionWorkerClient();
