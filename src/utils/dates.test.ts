import { describe, expect, it } from 'vitest';
import { addDaysToDateString, localDateString } from './dates';

describe('dates', () => {
  it('formats local dates without UTC shift', () => {
    expect(localDateString(0, new Date(2026, 10, 6, 0, 30))).toBe('2026-11-06');
    expect(localDateString(0, new Date(2026, 10, 6, 23, 59))).toBe('2026-11-06');
  });
  it('adds days across month and year boundaries', () => {
    expect(localDateString(3, new Date(2026, 10, 29))).toBe('2026-12-02');
    expect(addDaysToDateString('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToDateString('2028-02-28', 1)).toBe('2028-02-29');
  });
});
