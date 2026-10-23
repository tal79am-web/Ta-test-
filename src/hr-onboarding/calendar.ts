// Date helpers. Dates are ISO "YYYY-MM-DD" strings handled in UTC, so string
// comparison matches chronological order.

export interface Calendar {
  readonly holidays: ReadonlySet<string>;
}

export const NO_HOLIDAYS: Calendar = { holidays: new Set<string>() };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function toUtcDate(iso: string): Date {
  if (!DATE_RE.test(iso)) throw new Error(`Invalid date "${iso}", expected YYYY-MM-DD`);
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) {
    throw new Error(`Invalid date "${iso}"`);
  }
  return d;
}

export function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  try {
    toUtcDate(value);
    return true;
  } catch {
    return false;
  }
}

export function addDays(iso: string, days: number): string {
  const d = toUtcDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isBusinessDay(iso: string, cal: Calendar): boolean {
  const day = toUtcDate(iso).getUTCDay();
  return day !== 0 && day !== 6 && !cal.holidays.has(iso);
}

/** Adds business days; negative counts step backwards. */
export function addBusinessDays(iso: string, count: number, cal: Calendar): string {
  const step = count < 0 ? -1 : 1;
  let remaining = Math.abs(count);
  let cur = iso;
  while (remaining > 0) {
    cur = addDays(cur, step);
    if (isBusinessDay(cur, cal)) remaining -= 1;
  }
  return cur;
}

export function utcDate(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}
