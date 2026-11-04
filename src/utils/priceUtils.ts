/**
 * Safe parser for menu item prices.
 * Handles numbers, strings, and ranges like '20-40', '40-60', or '₹20 - ₹40'.
 * In case of a range like '20-40', returns the base number (20) instead of concatenating (2040).
 */
export function parseItemPrice(price: number | string | undefined | null): number {
  if (typeof price === 'number') {
    return isNaN(price) ? 0 : price;
  }
  if (!price) return 0;
  const str = String(price).trim();

  // If price is a range like "20-40", "40-60", "20 - 40", or "₹20-₹40":
  const rangeMatch = str.match(/(\d+(?:\.\d+)?)\s*[-/–]\s*(\d+(?:\.\d+)?)/);
  if (rangeMatch) {
    return parseFloat(rangeMatch[1]) || 0;
  }

  // Single number with symbols (e.g. '₹50', '50/-')
  const singleMatch = str.match(/(\d+(?:\.\d+)?)/);
  if (singleMatch) {
    return parseFloat(singleMatch[1]) || 0;
  }

  return 0;
}
