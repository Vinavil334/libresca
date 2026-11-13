'use client';

import { maxRatingQuarter, ratingMushrooms, tapRating } from '@libresca/domain';
import { useFormatter, useTranslations } from 'next-intl';

const cap = 'M2 18C2 8 10 2 20 2s18 6 18 16Z';
const mushrooms = maxRatingQuarter / 4;

/**
 * One mushroom cap, filled by quarters from the left (0 to 4). The filling is the same
 * cap drawn inside a narrower nested <svg>, which clips it: no clip path ids to collide.
 */
export function Mushroom({ quarters = 4 }: { quarters?: number }) {
  // The cap runs from x 2 to 38: each quarter is 9 units wide.
  const width = quarters >= 4 ? 40 : 2 + 9 * quarters;
  return (
    <svg viewBox="0 0 40 20" className="h-[1.25rem] w-[2.5rem]" aria-hidden focusable="false">
      <path d={cap} className="fill-surface" />
      {quarters > 0 && (
        <svg x="0" y="0" width={width} height="20" viewBox={`0 0 ${width} 20`}>
          <path d={cap} className="fill-cap" />
        </svg>
      )}
      <path d={cap} className="fill-none stroke-border" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

/** How many quarters of the i-th mushroom a rating fills. */
const quartersOf = (rating: number, index: number) => Math.min(4, Math.max(0, rating - index * 4));

/**
 * The rating as a quarter to five mushroom caps (DESIGN_SYSTEM.md, MushroomRating), with
 * the value in words for screen readers: "4,25 funghetti".
 */
export function MushroomRating({ ratingQuarter }: { ratingQuarter: number }) {
  const t = useTranslations('readings.rating');
  return (
    <span role="img" aria-label={t('value', { count: ratingMushrooms(ratingQuarter) })} className="inline-flex gap-1">
      {Array.from({ length: mushrooms }, (_, i) => (
        <Mushroom key={i} quarters={quartersOf(ratingQuarter, i)} />
      ))}
    </span>
  );
}

/**
 * The rating in a small space, such as a row of the Tana: one cap and the number,
 * "4,25", read as "4,25 funghetti".
 */
export function RatingNumber({ ratingQuarter }: { ratingQuarter: number }) {
  const t = useTranslations('readings.rating');
  const format = useFormatter();
  const value = ratingMushrooms(ratingQuarter);
  return (
    <span role="img" aria-label={t('value', { count: value })} className="inline-flex items-center gap-1">
      <Mushroom />
      <span aria-hidden className="type-label text-text">
        {format.number(value)}
      </span>
    </span>
  );
}

/**
 * Picks a rating by tapping the mushrooms: a tap gives that many, each new tap on the
 * same one takes a quarter off (`tapRating`), "Senza voto" clears it. Each mushroom is a
 * button that says what it will do; the current value is announced politely.
 */
export function RatingInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const t = useTranslations('readings.rating');
  const current = value ?? 0;
  return (
    <div role="group" aria-labelledby={`${id}-label`} className="flex flex-col gap-2">
      <p id={`${id}-label`} className="type-label text-text">
        {label}
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="flex">
          {Array.from({ length: mushrooms }, (_, i) => {
            const mushroom = i + 1;
            const next = tapRating(value, mushroom);
            return (
              <button
                key={mushroom}
                type="button"
                aria-label={t('tap', { count: ratingMushrooms(next) })}
                onClick={() => onChange(next)}
                className="grid size-[2.75rem] place-items-center rounded-card"
              >
                <Mushroom quarters={quartersOf(current, i)} />
              </button>
            );
          })}
        </div>
        <span aria-live="polite" className="type-small text-text-muted">
          {value ? t('value', { count: ratingMushrooms(value) }) : t('none')}
        </span>
      </div>
      {value !== null && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="min-h-[2.75rem] self-start type-label text-link underline underline-offset-4"
        >
          {t('none')}
        </button>
      )}
    </div>
  );
}
