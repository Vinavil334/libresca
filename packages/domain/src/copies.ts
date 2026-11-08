/**
 * Owned copies (F1.5): what a person may say about a volume on their shelves.
 * Format belongs to the edition; condition and location are not tracked for now.
 * The database repeats the essential checks as constraints.
 */

export const visibilities = ['private', 'friends', 'public'] as const;
export type Visibility = (typeof visibilities)[number];

/** Until friends exist (F2) a copy is only visible to its owner, whatever this says. */
export const defaultVisibility: Visibility = 'friends';

export const copyNotesMaxLength = 2000;

/** What the form sends; every field is optional, the defaults live in the database. */
export interface CopyInput {
  isLendable?: boolean;
  /** `YYYY-MM-DD`, or empty when unknown. */
  acquiredOn?: string;
  notes?: string;
  visibility?: Visibility;
}

/** Columns of `public.copies` the owner may write. */
export interface CopyPayload {
  is_lendable?: boolean;
  acquired_on: string | null;
  notes: string | null;
  visibility?: Visibility;
}

export type CopyIssueCode = 'invalid_date' | 'future_date' | 'too_long' | 'invalid_option';

export interface CopyIssue {
  path: 'isLendable' | 'acquiredOn' | 'notes' | 'visibility';
  code: CopyIssueCode;
}

export type CopyValidation = { ok: true; payload: CopyPayload } | { ok: false; issues: CopyIssue[] };

/** A real calendar date in `YYYY-MM-DD`, from 1450 on. */
function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    year >= 1450 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/**
 * Checks and normalises a copy. `today` (`YYYY-MM-DD`, in the user's time zone) refuses
 * acquisition dates in the future; tests pass a fixed day.
 */
export function validateCopy(input: CopyInput, today: string): CopyValidation {
  const issues: CopyIssue[] = [];

  const acquiredOn = input.acquiredOn?.trim() || null;
  if (acquiredOn && !isCalendarDate(acquiredOn)) issues.push({ path: 'acquiredOn', code: 'invalid_date' });
  else if (acquiredOn && acquiredOn > today) issues.push({ path: 'acquiredOn', code: 'future_date' });

  const notes = input.notes?.trim() || null;
  if (notes && notes.length > copyNotesMaxLength) issues.push({ path: 'notes', code: 'too_long' });

  if (input.visibility !== undefined && !visibilities.includes(input.visibility)) {
    issues.push({ path: 'visibility', code: 'invalid_option' });
  }
  if (input.isLendable !== undefined && typeof input.isLendable !== 'boolean') {
    issues.push({ path: 'isLendable', code: 'invalid_option' });
  }

  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    payload: {
      ...(input.isLendable === undefined ? {} : { is_lendable: input.isLendable }),
      acquired_on: acquiredOn,
      notes,
      ...(input.visibility === undefined ? {} : { visibility: input.visibility }),
    },
  };
}

/** Today's date as `YYYY-MM-DD` in a time zone, for `validateCopy`. */
export function localDate(now: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
