import type { Product } from "../../types/api.ts";
import type { MatchCandidate, MatchTier } from "../../services/visualMatch.ts";

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
