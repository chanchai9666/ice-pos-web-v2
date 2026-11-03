/**
 * Currency utilities for ICE POS v2.
 * All API amounts are represented in integer Satang (1 Baht = 100 Satang).
 */

/**
 * Converts Satang (integer) to Baht (number)
 */
export function satangToBaht(satang: number): number {
  if (!Number.isFinite(satang)) return 0;
  return satang / 100;
}

/**
 * Converts Baht (number) to Satang (integer) with proper rounding to prevent floating-point errors
 */
export function bahtToSatang(baht: number): number {
  if (!Number.isFinite(baht)) return 0;
  return Math.round(baht * 100);
}

/**
 * Formats a Satang amount into a display Baht string with 2 decimal places and the Baht symbol (฿)
 * Example: formatBaht(5000) -> "50.00 ฿"
 */
export function formatBaht(satang: number): string {
  const baht = satangToBaht(satang);
  return `${baht.toFixed(2)} ฿`;
}

/**
 * Calculates smart cash tendered suggestions based on real-world Thai payment behavior.
 * Generates dynamic suggestions strictly greater than totalBaht (exact amount is handled separately).
 *
 * Examples:
 * - 3 Baht -> [5, 10, 20, 50, 100, 500, 1000]
 * - 55 Baht -> [60, 100, 500, 1000]
 * - 1240 Baht -> [1250, 1260, 1300, 1500, 2000]
 */
export function getSmartCashSuggestions(totalBaht: number): number[] {
  if (!Number.isFinite(totalBaht) || totalBaht <= 0) {
    return [];
  }

  const suggestions = new Set<number>();

  // 1. Coins for small amounts (< 20 Baht)
  if (totalBaht < 5) suggestions.add(5);
  if (totalBaht < 10) suggestions.add(10);
  if (totalBaht < 20) suggestions.add(20);

  // 2. Next 10s and avoiding coin change
  const remainder10 = totalBaht % 10;
  const remainder100 = totalBaht % 100;

  if (remainder10 !== 0) {
    const next10 = Math.ceil(totalBaht / 10) * 10;
    suggestions.add(next10);
    if (remainder10 < 5) {
      suggestions.add(Math.floor(totalBaht / 10) * 10 + 5);
    }
  } else if (remainder100 !== 0) {
    // Ends in tens but not hundreds (e.g. 1240, 240, 70)
    // Customers often add +10 or +20 to get rounded banknote change
    suggestions.add(totalBaht + 10);
    suggestions.add(totalBaht + 20);
  }

  // 3. Next 50s and 100s
  const next50 = Math.ceil(totalBaht / 50) * 50;
  if (next50 > totalBaht) suggestions.add(next50);

  const next100 = Math.ceil(totalBaht / 100) * 100;
  if (next100 > totalBaht) suggestions.add(next100);

  // 4. Next 500s and 1000s
  const next500 = Math.ceil(totalBaht / 500) * 500;
  if (next500 > totalBaht) suggestions.add(next500);

  const next1000 = Math.ceil(totalBaht / 1000) * 1000;
  if (next1000 > totalBaht) suggestions.add(next1000);

  // 5. Standard Thai Banknotes (20, 50, 100, 500, 1000)
  const standardBanknotes = [20, 50, 100, 500, 1000];
  for (const note of standardBanknotes) {
    if (note > totalBaht) {
      suggestions.add(note);
    }
  }

  // Filter strictly > totalBaht, sort ascending
  const sorted = Array.from(suggestions)
    .filter((amt) => amt > totalBaht)
    .sort((a, b) => a - b);

  // Limit to at most 7 suggestions to keep UI clean and consistent
  return sorted.slice(0, 7);
}
