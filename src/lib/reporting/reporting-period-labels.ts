/** True when start/end are the first and last day of the same UTC calendar month. */
export function isFullCalendarMonthRange(startIso: string, endIso: string): boolean {
  const a = startIso.trim();
  const b = endIso.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) return false;
  const s = new Date(`${a}T12:00:00.000Z`);
  const e = new Date(`${b}T12:00:00.000Z`);
  if (!Number.isFinite(s.getTime()) || !Number.isFinite(e.getTime())) return false;
  const sy = s.getUTCFullYear();
  const sm = s.getUTCMonth();
  const sd = s.getUTCDate();
  const ey = e.getUTCFullYear();
  const em = e.getUTCMonth();
  const ed = e.getUTCDate();
  const lastDayOfMonth = new Date(Date.UTC(ey, em + 1, 0)).getUTCDate();
  return sy === ey && sm === em && sd === 1 && ed === lastDayOfMonth;
}

/** Compact label for a YYYY-MM-DD range: full calendar month → "Mar 2026", else "start–end" ISO. */
export function compactPeriodLabelFromIsoRange(startIso: string, endIso: string): string {
  const a = startIso.trim();
  const b = endIso.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) {
    return `${a}–${b}`;
  }
  const s = new Date(`${a}T12:00:00.000Z`);
  const e = new Date(`${b}T12:00:00.000Z`);
  if (!Number.isFinite(s.getTime()) || !Number.isFinite(e.getTime())) {
    return `${a}–${b}`;
  }
  if (isFullCalendarMonthRange(a, b)) {
    return s.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
  }
  return `${a}–${b}`;
}
