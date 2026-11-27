const pad = (n: number) => String(n).padStart(2, '0');

/** Local-time YYYY-MM-DD, optionally offset by N days. (toISOString() shifts the day in UTC+5:30.) */
export function localDateString(offsetDays = 0, from: Date = new Date()): string {
  const d = new Date(from.getTime());
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Adds days to a YYYY-MM-DD string using local calendar math. */
export function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return localDateString(days, new Date(y, (m || 1) - 1, d || 1));
}

/** Local-time YYYY-MM, optionally offset by N calendar months. */
export function localMonthString(offsetMonths = 0, from: Date = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth() + offsetMonths, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** Returns actual calendar day count (28-31) for a YYYY-MM month string. */
export function daysInMonth(monthStr: string): number {
  const [yearStr, monthPart] = monthStr.split('-');
  const year = Number(yearStr);
  const month = Number(monthPart);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return 30;
  }
  return new Date(year, month, 0).getDate();
}

/** Returns all local YYYY-MM-DD date strings in a YYYY-MM month in ascending order. */
export function monthDatesList(monthStr: string): string[] {
  const count = daysInMonth(monthStr);
  const [yearStr, monthPart] = monthStr.split('-');
  const prefix = `${yearStr}-${String(Number(monthPart) || 1).padStart(2, '0')}`;
  const dates: string[] = [];
  for (let day = 1; day <= count; day++) {
    dates.push(`${prefix}-${pad(day)}`);
  }
  return dates;
}
