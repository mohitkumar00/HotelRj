import { describe, expect, it } from 'vitest';
import { addDaysToDateString, daysInMonth, localDateString, localMonthString, monthDatesList } from './dates';

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
  it('computes month strings, calendar days, and date lists', () => {
    expect(localMonthString(0, new Date(2026, 10, 26))).toBe('2026-11');
    expect(localMonthString(-1, new Date(2026, 0, 15))).toBe('2025-12');
    expect(daysInMonth('2026-02')).toBe(28);
    expect(daysInMonth('2028-02')).toBe(29);
    expect(daysInMonth('2026-11')).toBe(30);
    expect(daysInMonth('2026-12')).toBe(31);
    const list = monthDatesList('2026-11');
    expect(list).toHaveLength(30);
    expect(list[0]).toBe('2026-11-01');
    expect(list[29]).toBe('2026-11-30');
  });
});
