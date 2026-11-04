/**
 * บริการคำนวณเวกเตอร์และการจับคู่ความคล้ายคลึงของรูปภาพสินค้า (Vector Math & Similarity Matching)
 * ใช้สำหรับการระบุสินค้าด้วยภาพถ่ายบนระบบ POS แบบ Client-side
 */

export interface CatalogItemEmbedding {
  productId: string;
  imageId?: string;
  embedding: number[];
}

export type MatchTier = "HIGH_CONFIDENCE" | "AMBIGUOUS" | "NO_MATCH";

export interface MatchCandidate {
  productId: string;
  imageId?: string;
  score: number; // 0.0 ถึง 1.0
}

export interface MatchResult {
  tier: MatchTier;
  bestMatch: MatchCandidate | null;
  candidates: MatchCandidate[]; // เรียงลำดับจากคะแนนมากไปน้อย สูงสุดไม่เกิน topK
}

export interface MatchOptions {
  highThreshold?: number; // ค่าเริ่มต้น 0.85
  lowThreshold?: number; // ค่าเริ่มต้น 0.70
  ambiguityMargin?: number; // ค่าเริ่มต้น 0.05 (ถ้าความต่างระหว่างอันดับ 1 และ 2 น้อยกว่าค่านี้ ถือว่า AMBIGUOUS)
  topK?: number; // ค่าเริ่มต้น 5
}

/**
 * ปรับขนาดเวกเตอร์ให้อยู่ในรูป Unit Vector (L2 Normalization)
 * คำนวณจาก norm = sqrt(sum(x_i^2))
 */
export function l2Normalize(vec: number[]): number[] {
  if (!vec || vec.length === 0) {
    return [];
  }

  let sumSq = 0;
  for (let i = 0; i < vec.length; i++) {
    sumSq += vec[i] * vec[i];
  }

  const norm = Math.sqrt(sumSq);
  if (norm === 0 || !Number.isFinite(norm)) {
    return vec.slice();
  }

  return vec.map((v) => v / norm);
}

/**
 * คำนวณ Cosine Similarity ระหว่างเวกเตอร์สองตัว
 * คืนค่าระหว่าง -1.0 ถึง 1.0 (หากขนาดไม่เท่ากันหรือเป็นเวกเตอร์ศูนย์ จะคืนค่า 0)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (
    normA === 0 ||
    normB === 0 ||
    !Number.isFinite(normA) ||
    !Number.isFinite(normB)
  ) {
    return 0;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) {
    return 0;
  }

  const sim = dot / denominator;
  return Math.max(-1.0, Math.min(1.0, sim));
}

/**
 * เปรียบเทียบเวกเตอร์ของรูปภาพค้นหากับรายการเวกเตอร์ในแคตตาล็อกสินค้า
 * คืนผลลัพธ์พร้อมจัดกลุ่มความมั่นใจ (HIGH_CONFIDENCE, AMBIGUOUS, NO_MATCH)
 */
export function matchQueryVector(
  query: number[],
  catalog: CatalogItemEmbedding[],
  options?: MatchOptions
): MatchResult {
  const highThreshold = options?.highThreshold ?? 0.85;
  const lowThreshold = options?.lowThreshold ?? 0.7;
  const ambiguityMargin = options?.ambiguityMargin ?? 0.05;
  const topK = options?.topK ?? 5;

  if (!query || query.length === 0 || !catalog || catalog.length === 0) {
    return {
      tier: "NO_MATCH",
      bestMatch: null,
      candidates: [],
    };
  }

  const normQuery = l2Normalize(query);
  let queryNormSq = 0;
  for (let i = 0; i < normQuery.length; i++) {
    queryNormSq += normQuery[i] * normQuery[i];
  }

  if (queryNormSq === 0) {
    return {
      tier: "NO_MATCH",
      bestMatch: null,
      candidates: [],
    };
  }

  // รวบรวมคะแนนตาม productId (หากสินค้านั้นมีหลายรูปภาพ ให้เก็บเฉพาะรูปภาพที่ได้คะแนนสูงสุด)
  const productMap = new Map<string, MatchCandidate>();

  for (const item of catalog) {
    if (!item.embedding || item.embedding.length !== normQuery.length) {
      continue;
    }

    const sim = cosineSimilarity(normQuery, item.embedding);
    const score = Math.max(0.0, Math.min(1.0, sim));

    const existing = productMap.get(item.productId);
    if (!existing || score > existing.score) {
      productMap.set(item.productId, {
        productId: item.productId,
        imageId: item.imageId,
        score,
      });
    }
  }

  // เรียงลำดับคะแนนจากมากไปน้อย และจำกัดจำนวนไม่เกิน topK
  const candidates = Array.from(productMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  if (candidates.length === 0) {
    return {
      tier: "NO_MATCH",
      bestMatch: null,
      candidates: [],
    };
  }

  const best = candidates[0];
  const second = candidates.length > 1 ? candidates[1] : null;

  // หากคะแนนสูงสุดต่ำกว่าเกณฑ์ขั้นต่ำ ถือว่าไม่พบสินค้าที่ตรงกัน
  if (best.score < lowThreshold) {
    return {
      tier: "NO_MATCH",
      bestMatch: null,
      candidates,
    };
  }

  let tier: MatchTier;
  if (best.score >= highThreshold) {
    if (
      second &&
      second.score >= lowThreshold &&
      best.score - second.score < ambiguityMargin
    ) {
      tier = "AMBIGUOUS";
    } else {
      tier = "HIGH_CONFIDENCE";
    }
  } else {
    // คะแนนอยู่ระหว่าง lowThreshold ถึง highThreshold
    tier = "AMBIGUOUS";
  }

  return {
    tier,
    bestMatch: best,
    candidates,
  };
}
