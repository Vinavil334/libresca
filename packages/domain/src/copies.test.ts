import { describe, expect, it } from 'vitest';

import { copyNotesMaxLength, validateCopy } from './copies';
import { localDate } from './dates';

const today = '2026-11-08';

describe('validateCopy', () => {
  it('accepts an empty copy and leaves the defaults to the database', () => {
    expect(validateCopy({}, today)).toEqual({ ok: true, payload: { acquired_on: null, notes: null } });
  });

  it('cleans notes and dates', () => {
    expect(
      validateCopy(
        { isLendable: false, acquiredOn: ' 2024-02-29 ', notes: '  Regalo di Ada  ', visibility: 'private' },
        today,
      ),
    ).toEqual({
      ok: true,
      payload: { is_lendable: false, acquired_on: '2024-02-29', notes: 'Regalo di Ada', visibility: 'private' },
    });
  });

  it('refuses impossible and future dates', () => {
    expect(validateCopy({ acquiredOn: '2023-02-29' }, today)).toEqual({
      ok: false,
      issues: [{ path: 'acquiredOn', code: 'invalid_date' }],
    });
    expect(validateCopy({ acquiredOn: '08/11/2026' }, today)).toMatchObject({ ok: false });
    expect(validateCopy({ acquiredOn: '1300-01-01' }, today)).toMatchObject({ ok: false });
    expect(validateCopy({ acquiredOn: '2026-11-09' }, today)).toEqual({
      ok: false,
      issues: [{ path: 'acquiredOn', code: 'future_date' }],
    });
    expect(validateCopy({ acquiredOn: today }, today).ok).toBe(true);
  });

  it('refuses notes that are too long and unknown visibilities', () => {
    const result = validateCopy({ notes: 'x'.repeat(copyNotesMaxLength + 1), visibility: 'everyone' as never }, today);
    expect(result).toEqual({
      ok: false,
      issues: [
        { path: 'notes', code: 'too_long' },
        { path: 'visibility', code: 'invalid_option' },
      ],
    });
  });
});

describe('localDate', () => {
  it('gives the calendar day in the requested time zone', () => {
    const lateEvening = new Date('2026-11-08T23:30:00Z');
    expect(localDate(lateEvening, 'UTC')).toBe('2026-11-08');
    expect(localDate(lateEvening, 'Europe/Rome')).toBe('2026-11-09');
  });
});
