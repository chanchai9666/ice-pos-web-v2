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
