import { describe, expect, it } from 'vitest';

import {
  type ReadingStatus,
  finishesReading,
  openReading,
  ratingMushrooms,
  reviewMaxLength,
  sortReadings,
  tapRating,
  validateReading,
} from './readings';

const today = '2026-11-08';

describe('validateReading', () => {
  it('accepts a finished reading with dates, rating and notes', () => {
    expect(
      validateReading(
        {
          status: 'read',
          startedOn: '2024-03-01',
          finishedOn: '2024-03-20',
          ratingQuarter: 17,
          review: '  Bellissimo  ',
        },
        today,
      ),
    ).toEqual({
      ok: true,
      payload: {
        status: 'read',
        started_on: '2024-03-01',
        finished_on: '2024-03-20',
        rating_quarter: 17,
        review: 'Bellissimo',
      },
    });
  });

  it('drops what the status does not allow instead of refusing it', () => {
    const fields = { startedOn: '2024-03-01', finishedOn: '2024-03-20', ratingQuarter: 18 };
    expect(validateReading({ status: 'want', ...fields }, today)).toMatchObject({
      ok: true,
      payload: { started_on: null, finished_on: null, rating_quarter: null },
    });
    expect(validateReading({ status: 'reading', ...fields }, today)).toMatchObject({
      ok: true,
      payload: { started_on: '2024-03-01', finished_on: null, rating_quarter: null },
    });
    expect(validateReading({ status: 'abandoned', ...fields }, today)).toMatchObject({
      ok: true,
      payload: { finished_on: '2024-03-20', rating_quarter: 18 },
    });
  });

  it('refuses wrong dates, an end before the start, and odd ratings', () => {
    expect(validateReading({ status: 'read', finishedOn: '2027-01-01' }, today)).toEqual({
      ok: false,
      issues: [{ path: 'finishedOn', code: 'future_date' }],
    });
    expect(validateReading({ status: 'read', startedOn: '2024-02-30' }, today)).toEqual({
      ok: false,
      issues: [{ path: 'startedOn', code: 'invalid_date' }],
    });
    expect(validateReading({ status: 'read', startedOn: '2024-03-02', finishedOn: '2024-03-01' }, today)).toEqual({
      ok: false,
      issues: [{ path: 'finishedOn', code: 'dates_order' }],
    });
    for (const ratingQuarter of [0, 21, 4.5]) {
      expect(validateReading({ status: 'read', ratingQuarter }, today)).toEqual({
        ok: false,
        issues: [{ path: 'ratingQuarter', code: 'invalid_rating' }],
      });
    }
  });

  it('refuses long notes, bad edition ids and unknown statuses', () => {
    expect(validateReading({ status: 'read', review: 'x'.repeat(reviewMaxLength + 1) }, today)).toMatchObject({
      ok: false,
      issues: [{ path: 'review', code: 'too_long' }],
    });
    expect(validateReading({ status: 'read', editionId: 'nope' }, today)).toMatchObject({
      ok: false,
      issues: [{ path: 'editionId', code: 'invalid_id' }],
    });
    expect(validateReading({ status: 'finished' as never }, today)).toEqual({
      ok: false,
      issues: [{ path: 'status', code: 'invalid_option' }],
    });
  });

  it('keeps a cleared rating as no rating', () => {
    expect(validateReading({ status: 'read', ratingQuarter: null }, today)).toMatchObject({
      ok: true,
      payload: { rating_quarter: null },
    });
  });
});

describe('ratingMushrooms', () => {
  it('turns quarter steps into mushrooms', () => {
    expect(ratingMushrooms(17)).toBe(4.25);
    expect(ratingMushrooms(18)).toBe(4.5);
    expect(ratingMushrooms(1)).toBe(0.25);
  });
});

describe('openReading and sortReadings', () => {
  const reading = (status: ReadingStatus, started_on: string | null, finished_on: string | null, created: string) => ({
    status,
    started_on,
    finished_on,
    created_at: `${created}T10:00:00Z`,
  });

  it('puts the open reading first, then the most recent', () => {
    const first = reading('read', null, '2019-05-01', '2026-01-01');
    const second = reading('abandoned', '2023-02-01', null, '2026-01-02');
    const open = reading('reading', '2026-10-01', null, '2026-10-01');
    const sorted = sortReadings([first, open, second]);
    expect(sorted).toEqual([open, second, first]);
    expect(openReading(sorted)).toBe(open);
    expect(openReading([first, second])).toBeUndefined();
  });
});

describe('tapRating', () => {
  it('gives the tapped mushrooms, then a quarter less at each new tap, then starts again', () => {
    expect(tapRating(null, 3)).toBe(12);
    expect(tapRating(12, 3)).toBe(11);
    expect(tapRating(11, 3)).toBe(10);
    expect(tapRating(10, 3)).toBe(9);
    expect(tapRating(9, 3)).toBe(12);
    expect(tapRating(12, 4)).toBe(16);
    expect(tapRating(16, 3)).toBe(12);
    expect(tapRating(4, 1)).toBe(3);
  });
});

describe('finishesReading', () => {
  it('is the moment an open reading becomes read', () => {
    expect(finishesReading('reading', 'read')).toBe(true);
    expect(finishesReading('want', 'read')).toBe(true);
    expect(finishesReading('read', 'read')).toBe(false);
    expect(finishesReading('abandoned', 'read')).toBe(false);
    expect(finishesReading('reading', 'abandoned')).toBe(false);
    expect(finishesReading(null, 'read')).toBe(false);
  });
});
