import type { Product } from "../../types/api.ts";
import type {
  MatchCandidate,
  MatchResult,
  MatchTier,
} from "../../services/visualMatch.ts";

/**
 * ตัดสินใจว่าควรส่งเสียง Beep และสั่งสั่น (Haptic) หรือไม่ โดยป้องกันการส่งเสียงซ้ำสำหรับสินค้าเดิมภายในระยะ cooldown
 */
export function shouldTriggerSound(
  currentTier: MatchTier | null | undefined,
  currentProductId: string | undefined,
  lastAlertedProductId: string | null,
  lastAlertedTime: number,
  currentTime: number,
  cooldownMs = 3000
): boolean {
  if (currentTier !== "HIGH_CONFIDENCE" || !currentProductId) {
    return false;
  }
  if (currentProductId !== lastAlertedProductId) {
    return true;
  }
  return currentTime - lastAlertedTime >= cooldownMs;
}

/**
 * คืนค่า CSS classes ของกรอบเล็งเป้า (Viewfinder) ตามระดับความมั่นใจของการจับคู่ภาพ
 */
export function getViewfinderBorderClass(tier?: MatchTier | null): string {
  switch (tier) {
    case "HIGH_CONFIDENCE":
      return "border-success shadow-[0_0_28px_rgba(34,197,94,0.6)]";
    case "AMBIGUOUS":
      return "border-warning shadow-[0_0_24px_rgba(234,179,8,0.6)]";
    case "NO_MATCH":
    default:
      return "border-primary/70 shadow-[0_0_16px_rgba(59,130,246,0.3)]";
  }
}

/**
 * จัดรูปแบบตัวเลขทศนิยมความมั่นใจ (0.0 - 1.0) ให้อยู่ในรูปเปอร์เซ็นต์
 */
export function formatConfidencePercent(score?: number): string {
  if (typeof score !== "number" || !Number.isFinite(score) || score <= 0) {
    return "0%";
  }
  return `${Math.round(score * 100)}%`;
}

export interface ConsensusTracker {
  productId: string | null;
  consecutiveCount: number;
}

/**
 * ติดตามผลการสแกนหลายเฟรมติดต่อกัน (Consecutive Frames Consensus)
 * ต้องพบสินค้าตัวเดิมที่เป็น HIGH_CONFIDENCE ครบตามจำนวนเฟรมที่กำหนด (เช่น 2 เฟรม) จึงถือว่าผ่านฉันทามติ
 */
export function updateConsensusTracker(
  tracker: ConsensusTracker,
  matchedProductId: string | null | undefined,
  tier: MatchTier | null | undefined,
  requiredFrames = 2
): { updatedTracker: ConsensusTracker; isConsensusReached: boolean } {
  if (tier !== "HIGH_CONFIDENCE" || !matchedProductId) {
    return {
      updatedTracker: { productId: null, consecutiveCount: 0 },
      isConsensusReached: false,
    };
  }

  if (tracker.productId === matchedProductId) {
    const count = tracker.consecutiveCount + 1;
    return {
      updatedTracker: { productId: matchedProductId, consecutiveCount: count },
      isConsensusReached: count >= requiredFrames,
    };
  }

  return {
    updatedTracker: { productId: matchedProductId, consecutiveCount: 1 },
    isConsensusReached: requiredFrames <= 1,
  };
}

/**
 * จับคู่ MatchCandidate เข้ากับข้อมูลสินค้า Product จาก Catalog
 */
export function getCandidatesWithProducts(
  candidates: MatchCandidate[],
  productsMap: Map<string, Product>
): Array<{ candidate: MatchCandidate; product: Product }> {
  const result: Array<{ candidate: MatchCandidate; product: Product }> = [];
  for (const c of candidates) {
    const prod = productsMap.get(c.productId);
    if (prod) {
      result.push({ candidate: c, product: prod });
    }
  }
  return result;
}

/**
 * ตัดสินใจอัปเดตผลการตรวจจับสินค้า เพื่อให้ผลลัพธ์ค้างอยู่บนหน้าจอแม้จะนำสินค้าออกจากกล้องแล้ว
 * - หากสแกนพบสินค้าใหม่ (HIGH_CONFIDENCE หรือ AMBIGUOUS) จะอัปเดตเป็นผลลัพธ์ใหม่
 * - หากเฟรมปัจจุบันไม่พบสินค้า (NO_MATCH) จะคงผลลัพธ์เดิมไว้ ไม่ล้างออก
 */
export function resolvePersistentMatchResult(
  currentDisplayedResult: MatchResult | null,
  newFrameResult: MatchResult
): MatchResult | null {
  if (
    newFrameResult.tier === "HIGH_CONFIDENCE" ||
    newFrameResult.tier === "AMBIGUOUS"
  ) {
    return newFrameResult;
  }
  // หากเป็น NO_MATCH ให้แสดงผลลัพธ์เดิมที่ค้างไว้ (Sticky)
  return currentDisplayedResult;
}

/**
 * แปลงผลลัพธ์จาก Server-side Match API (/api/v1/vision/match) ให้อยู่ในโครงสร้าง MatchResult
 */
export function mapBackendVisionResponseToMatchResult(
  response: {
    query_model?: string;
    matches?: Array<{
      product_id: string;
      confidence: number;
      product_name?: string;
      price?: number;
      image_url?: string;
    }>;
  },
  highThreshold = 0.85,
  ambiguousThreshold = 0.7
): {
  tier: MatchTier;
  bestMatch: MatchCandidate | null;
  candidates: MatchCandidate[];
} {
  const matches = response?.matches || [];
  const candidates: MatchCandidate[] = matches.map((m) => ({
    productId: m.product_id,
    score: m.confidence,
  }));

  const bestMatch = candidates[0] || null;
  let tier: MatchTier = "NO_MATCH";

  if (bestMatch && bestMatch.score >= highThreshold) {
    tier = "HIGH_CONFIDENCE";
  } else if (bestMatch && bestMatch.score >= ambiguousThreshold) {
    tier = "AMBIGUOUS";
  }

  return {
    tier,
    bestMatch,
    candidates,
  };
}
