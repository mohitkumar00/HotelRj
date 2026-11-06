import { describe, expect, it } from 'vitest';
import { parseItemPrice } from './priceUtils';

describe('parseItemPrice', () => {
  it('passes numbers through and guards NaN', () => {
    expect(parseItemPrice(120)).toBe(120);
    expect(parseItemPrice(NaN)).toBe(0);
  });
  it('returns the base of a range, never a concatenation', () => {
    expect(parseItemPrice('20-40')).toBe(20);
    expect(parseItemPrice('₹20 - ₹40')).toBe(20);
  });
  it('parses symbols and decimals', () => {
    expect(parseItemPrice('₹50')).toBe(50);
    expect(parseItemPrice('50/-')).toBe(50);
    expect(parseItemPrice('12.5')).toBe(12.5);
  });
  it('handles empty input', () => {
    expect(parseItemPrice(undefined)).toBe(0);
    expect(parseItemPrice('')).toBe(0);
    expect(parseItemPrice('abc')).toBe(0);
  });
});
