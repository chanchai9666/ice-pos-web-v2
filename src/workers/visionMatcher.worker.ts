/**
 * Web Worker สำหรับคำนวณเวกเตอร์รูปภาพและค้นหาความคล้ายคลึงของสินค้า (Vision AI)
 * ใช้ Transformers.js เพื่อสกัด Feature Vector บนพื้นฐานของแบบจำลอง CLIP
 */

import { pipeline, env } from "@xenova/transformers";
import {
  matchQueryVector,
  type CatalogItemEmbedding,
  type MatchOptions,
} from "../services/visualMatch.ts";

// ตั้งค่า Transformers.js สำหรับสภาพแวดล้อม Client-side Web Worker
env.allowLocalModels = false;
env.useBrowserCache = true;

const DEFAULT_MODEL = "Xenova/clip-vit-base-patch32";

type ExtractorPipeline = (
  image: unknown,
  options?: { pooling?: string; normalize?: boolean }
) => Promise<{ data: Float32Array | number[] }>;

let extractorPromise: Promise<ExtractorPipeline> | null = null;
let currentModelName = DEFAULT_MODEL;
let catalog: CatalogItemEmbedding[] = [];

// Helper สำหรับโพสต์ข้อความกลับไปยัง Main Thread
function postWorkerMessage(message: unknown) {
  (self as unknown as Worker).postMessage(message);
}

interface ProgressEventPayload {
  status?: string;
  name?: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
  [key: string]: unknown;
}

// ตัวแปรเก็บความคืบหน้าระหว่างดาวน์โหลดโมเดล
let highestProgress = 0;

async function getExtractor(
  modelName = DEFAULT_MODEL
): Promise<ExtractorPipeline> {
  if (!extractorPromise || currentModelName !== modelName) {
    currentModelName = modelName;
    highestProgress = 0;

    extractorPromise = (
      pipeline as unknown as (
        task: string,
        model: string,
        options: {
          progress_callback: (data: ProgressEventPayload | number) => void;
        }
      ) => Promise<ExtractorPipeline>
    )("image-feature-extraction", modelName, {
      progress_callback: (progressData: ProgressEventPayload | number) => {
        if (typeof progressData === "number") {
          highestProgress = Math.max(highestProgress, progressData);
          postWorkerMessage({
            type: "PROGRESS",
            progress: highestProgress,
          });
          return;
        }

        const { status, file, progress, loaded } = progressData || {};
        let total = progressData?.total;

        // หาก browser CORS ไม่ส่ง content-length ทำให้ total เป็น 0 หรือไม่มี
        // ให้ใช้ขนาดโมเดลประมาณ (~89.1 MB) สำหรับไฟล์ .onnx ในการคำนวณความคืบหน้า
        const ESTIMATED_ONNX_BYTES = 89_117_000;
        if (
          (!total || total <= 0) &&
          file?.endsWith(".onnx") &&
          typeof loaded === "number"
        ) {
          total = ESTIMATED_ONNX_BYTES;
        }

        let calculatedProgress =
          typeof progress === "number" && Number.isFinite(progress)
            ? progress
            : 0;

        if (
          typeof loaded === "number" &&
          typeof total === "number" &&
          total > 0
        ) {
          calculatedProgress = Math.min(100, (loaded / total) * 100);
        }

        highestProgress = Math.max(
          highestProgress,
          Math.min(100, calculatedProgress)
        );

        if (status === "done" && file?.endsWith(".onnx")) {
          highestProgress = 100;
        } else if (status === "ready") {
          highestProgress = 100;
        }

        postWorkerMessage({
          type: "PROGRESS",
          progress: highestProgress,
          status,
          file,
          loaded,
          total,
        });
      },
    });
  }
  return extractorPromise;
}

interface WorkerIncomingData {
  type: string;
  id?: string;
  modelName?: string;
  catalog?: CatalogItemEmbedding[];
  image?: unknown;
  options?: MatchOptions;
}

self.addEventListener("message", async (event: MessageEvent<unknown>) => {
  const data = event.data as WorkerIncomingData | undefined;
  if (!data || typeof data !== "object") return;

  switch (data.type) {
    case "INIT": {
      try {
        const model = data.modelName || DEFAULT_MODEL;
        await getExtractor(model);
        postWorkerMessage({ type: "INIT_SUCCESS", modelName: model });
      } catch (err: unknown) {
        postWorkerMessage({
          type: "ERROR",
          error: err instanceof Error ? err.message : String(err),
        });
      }
      break;
    }

    case "SET_CATALOG": {
      catalog = Array.isArray(data.catalog) ? data.catalog : [];
      break;
    }

    case "MATCH_FRAME": {
      const { id, image, options } = data;
      try {
        const extractor = await getExtractor();
        const output = await extractor(image, {
          pooling: "mean",
          normalize: true,
        });
        const queryEmbedding = Array.from(output.data);
        const result = matchQueryVector(queryEmbedding, catalog, options);
        postWorkerMessage({ type: "MATCH_RESULT", id, result });
      } catch (err: unknown) {
        postWorkerMessage({
          type: "ERROR",
          id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      break;
    }

    case "EXTRACT_EMBEDDING": {
      const { id, image } = data;
      try {
        let processableImage = image;
        if (typeof Blob !== "undefined" && image instanceof Blob) {
          processableImage = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(image);
          });
        }
        const extractor = await getExtractor();
        const output = await extractor(processableImage, {
          pooling: "mean",
          normalize: true,
        });
        const embedding = Array.from(output.data);
        postWorkerMessage({
          type: "EXTRACT_RESULT",
          id,
          embedding,
          modelName: currentModelName,
        });
      } catch (err: unknown) {
        postWorkerMessage({
          type: "ERROR",
          id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      break;
    }

    default:
      break;
  }
});
