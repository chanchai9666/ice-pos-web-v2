# Implementation Plan: Camera-based Product Recognition

- **Spec:** `design_draft.md`, `concepts_brief.md`, `/Users/chanchai/workshop/CODE/ice-pos-api-v2/docs/FRONTEND_VISION_AI_INTEGRATION.md`, `/Users/chanchai/workshop/CODE/ice-pos-api-v2/docs/API_SPEC.md`
- **Target Workspace:** `.worktrees/feat-camera-product-recognition`

## Global Constraints

1. **Strict TDD:** Every feature, utility, and service MUST start with a failing test (RED), followed by minimal implementation (GREEN), and refactoring (REFACTOR). Never commit code without verified passing tests.
2. **Offline-First:** All product vector comparisons and lookups must function without an internet connection using IndexedDB (`src/services/offlineStorage.ts`).
3. **No UI Freezing:** Vector similarity search and inference processing must never block the React 19 main thread.
4. **Code Reuse:** Reuse existing audio feedback (`src/utils/audio.ts`) and camera logic patterns from `src/components/common/BarcodeScannerModal.tsx`.
5. **TypeScript & Linter Cleanliness:** All code must pass `npm run typecheck` and `npm run lint` cleanly.

---

## Tasks Breakdown

### Task 1: Reusable Camera Stream Hook (`src/hooks/useCameraStream.ts`)

- **Goal:** Extract and isolate camera stream lifecycle, device enumeration, front/back switching, torch control, and error handling into a clean, reusable React hook.
- **TDD Test:** `src/hooks/useCameraStream.test.ts` (test media stream attachment, facing mode toggle, error states, cleanup on unmount).
- **Target Files:**
  - `src/hooks/useCameraStream.ts` (Create)
  - `src/hooks/useCameraStream.test.ts` (Create)

### Task 2: Vector Math & Similarity Matching Service (`src/services/visualMatch.ts`)

- **Goal:** Implement L2 normalization, dot product cosine similarity, threshold classification (High >= 0.85, Ambiguous 0.70-0.84, Low < 0.70), and Top-K ranking for image embeddings.
- **TDD Test:** `src/services/visualMatch.test.ts` (test exact matches, orthogonal vectors, threshold tiering, top-k ranking, edge cases with zero/mismatched dimensions).
- **Target Files:**
  - `src/services/visualMatch.ts` (Create)
  - `src/services/visualMatch.test.ts` (Create)

### Task 3: Product Embedding Schema & In-Memory Cache in `offlineStorage.ts`

- **Goal:** Update `offlineStorage.ts` and `api.ts` types to support `ProductImage` with `embedding: number[]` and `embedding_model: string`. Provide in-memory flat cached arrays of active product embeddings for instant sub-millisecond retrieval.
- **TDD Test:** Update `src/services/offlineStorage.test.ts` to test saving products with images/embeddings and loading flat vector caches.
- **Target Files:**
  - `src/types/api.ts` (Modify: add `ProductImage` interface to `Product`)
  - `src/services/offlineStorage.ts` (Modify: handle image embeddings in IndexedDB & memory cache)
  - `src/services/offlineStorage.test.ts` (Modify: unit test embedding storage and cache)

### Task 4: Vision AI Worker & Client Bridge (`src/services/visionWorkerClient.ts`)

- **Goal:** Setup client-side Vision feature extraction worker bridge with `@xenova/transformers`. Worker receives canvas ImageData or blob, computes vector via CLIP model, matches against catalog vectors, and returns ranked matches.
- **TDD Test:** `src/services/visionWorkerClient.test.ts` (test message protocol, worker response handling, fallback/error handling).
- **Target Files:**
  - `src/workers/visionMatcher.worker.ts` (Create)
  - `src/services/visionWorkerClient.ts` (Create)
  - `src/services/visionWorkerClient.test.ts` (Create)

### Task 5: Camera Product Scanner Modal UI Component (`src/components/pos/CameraProductScannerModal.tsx`)

- **Goal:** Build the cashier camera scanning modal. Uses `useCameraStream`, runs interval capture frames, queries vision worker, displays visual reticle, and renders matches:
  - High confidence match: prominent card with single-tap "Add to Cart" and sound.
  - Ambiguous match: list of Top 3-5 candidates for cashier selection.
  - Low confidence: scanning helper prompt.
- **Target Files:**
  - `src/components/pos/CameraProductScannerModal.tsx` (Create)
  - `src/components/pos/BarcodeScannerInput.tsx` (Modify: add camera vision scan trigger button alongside barcode scanner)
  - `src/app/page.tsx` (Modify: wire CameraProductScannerModal to cart addition)

### Task 6: Admin Catalog Image Embedding Extraction (`src/components/catalog/ProductFormModal.tsx`)

- **Goal:** Allow store admins to upload or capture 1-4 product images with embedding extraction via `visionWorkerClient` and submit to `POST /api/v1/products/:id/images`.
- **Target Files:**
  - `src/components/catalog/ProductFormModal.tsx` (Modify: support image upload with embedding extraction)
  - `src/services/apiClient.ts` (Modify: add `uploadProductImageWithEmbedding` helper)
