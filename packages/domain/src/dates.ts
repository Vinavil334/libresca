/** Calendar dates as `YYYY-MM-DD`, the way Postgres `date` columns store them. */

/** A real calendar date in `YYYY-MM-DD`, from 1450 (printing) on. */
export function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    year >= 1450 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/** Today's date as `YYYY-MM-DD` in a time zone (the runtime's when omitted). */
export function localDate(now: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export type DateIssueCode = 'invalid_date' | 'future_date';

/** Cleans an optional date: `null` when empty, an issue code when wrong. */
export function checkPastDate(value: string | undefined | null, today: string): string | null | DateIssueCode {
  const clean = value?.trim() || null;
  if (!clean) return null;
  if (!isCalendarDate(clean)) return 'invalid_date';
  return clean > today ? 'future_date' : clean;
}
