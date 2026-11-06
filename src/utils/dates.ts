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
