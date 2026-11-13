import { type Visibility, visibilities } from './copies';
import { checkPastDate } from './dates';

/**
 * Readings (F1.6). Every reading is an event: a reread is a new reading. At most one
 * reading per work is open (in the Dispensa or in progress). The database repeats
 * these rules as constraints.
 */

export const readingStatuses = ['want', 'reading', 'read', 'abandoned'] as const;
export type ReadingStatus = (typeof readingStatuses)[number];

/** Open readings: at most one per person and work. */
export function isOpenStatus(status: ReadingStatus): boolean {
  return status === 'want' || status === 'reading';
}

/** Only a finished reading, read or abandoned, has an end date and a rating. */
export function isFinishedStatus(status: ReadingStatus): boolean {
  return status === 'read' || status === 'abandoned';
}

/** The rating in half mushrooms: 1 is half a mushroom, 10 is five. */
export const maxRatingHalf = 10;
export const reviewMaxLength = 5000;

/** Mushrooms for a rating, for display and screen readers: 9 gives 4.5. */
export function ratingMushrooms(ratingHalf: number): number {
  return ratingHalf / 2;
}

export interface ReadingInput {
  status: ReadingStatus;
  /** `YYYY-MM-DD`, or empty when unknown. */
  startedOn?: string;
  finishedOn?: string;
  /** 1 to 10, or null for no rating. */
  ratingHalf?: number | null;
  review?: string;
  editionId?: string | null;
  visibility?: Visibility;
}

/** Columns of `public.readings` the owner may write. */
export interface ReadingPayload {
  status: ReadingStatus;
  started_on: string | null;
  finished_on: string | null;
  rating_half: number | null;
  review: string | null;
  edition_id?: string | null;
  visibility?: Visibility;
}

export type ReadingIssueCode =
  'invalid_option' | 'invalid_date' | 'future_date' | 'dates_order' | 'invalid_rating' | 'too_long' | 'invalid_id';

export interface ReadingIssue {
  path: 'status' | 'startedOn' | 'finishedOn' | 'ratingHalf' | 'review' | 'editionId' | 'visibility';
  code: ReadingIssueCode;
}

export type ReadingValidation = { ok: true; payload: ReadingPayload } | { ok: false; issues: ReadingIssue[] };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Checks and normalises a reading. Fields the status does not allow are dropped rather
 * than refused, so switching a reading from "letto" back to "in lettura" just works:
 * the Dispensa has no dates, a reading in progress has no end date and no rating.
 * `today` (`YYYY-MM-DD`, the user's day) refuses dates in the future.
 */
export function validateReading(input: ReadingInput, today: string): ReadingValidation {
  const issues: ReadingIssue[] = [];
  const status = input.status;
  if (!readingStatuses.includes(status)) return { ok: false, issues: [{ path: 'status', code: 'invalid_option' }] };

  const date = (path: 'startedOn' | 'finishedOn', value: string | undefined): string | null => {
    const checked = checkPastDate(value, today);
    if (checked === 'invalid_date' || checked === 'future_date') {
      issues.push({ path, code: checked });
      return null;
    }
    return checked;
  };

  const startedOn = status === 'want' ? null : date('startedOn', input.startedOn);
  const finishedOn = isFinishedStatus(status) ? date('finishedOn', input.finishedOn) : null;
  if (startedOn && finishedOn && startedOn > finishedOn) issues.push({ path: 'finishedOn', code: 'dates_order' });

  const rating = isFinishedStatus(status) ? (input.ratingHalf ?? null) : null;
  if (rating !== null && !(Number.isInteger(rating) && rating >= 1 && rating <= maxRatingHalf)) {
    issues.push({ path: 'ratingHalf', code: 'invalid_rating' });
  }

  const review = input.review?.trim() || null;
  if (review && review.length > reviewMaxLength) issues.push({ path: 'review', code: 'too_long' });

  if (input.editionId && !uuidPattern.test(input.editionId)) issues.push({ path: 'editionId', code: 'invalid_id' });
  if (input.visibility !== undefined && !visibilities.includes(input.visibility)) {
    issues.push({ path: 'visibility', code: 'invalid_option' });
  }

  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    payload: {
      status,
      started_on: startedOn,
      finished_on: finishedOn,
      rating_half: rating,
      review,
      ...(input.editionId === undefined ? {} : { edition_id: input.editionId }),
      ...(input.visibility === undefined ? {} : { visibility: input.visibility }),
    },
  };
}

interface DatedReading {
  status: ReadingStatus;
  started_on: string | null;
  finished_on: string | null;
  created_at: string;
}

/** The open reading among a person's readings of a work, if any. */
export function openReading<T extends DatedReading>(readings: T[]): T | undefined {
  return readings.find((reading) => isOpenStatus(reading.status));
}

/** Readings newest first: the open one, then by end date, start date, creation. */
export function sortReadings<T extends DatedReading>(readings: T[]): T[] {
  const key = (reading: T) => reading.finished_on ?? reading.started_on ?? reading.created_at.slice(0, 10);
  return [...readings].sort((a, b) => {
    if (isOpenStatus(a.status) !== isOpenStatus(b.status)) return isOpenStatus(a.status) ? -1 : 1;
    return key(b).localeCompare(key(a)) || b.created_at.localeCompare(a.created_at);
  });
}
