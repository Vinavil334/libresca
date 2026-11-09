import { checkPastDate } from './dates';

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

/**
 * Checks and normalises a copy. `today` (`YYYY-MM-DD`, in the user's time zone) refuses
 * acquisition dates in the future; tests pass a fixed day.
 */
export function validateCopy(input: CopyInput, today: string): CopyValidation {
  const issues: CopyIssue[] = [];

  const date = checkPastDate(input.acquiredOn, today);
  const acquiredOn = date === 'invalid_date' || date === 'future_date' ? null : date;
  if (date === 'invalid_date' || date === 'future_date') issues.push({ path: 'acquiredOn', code: date });

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
