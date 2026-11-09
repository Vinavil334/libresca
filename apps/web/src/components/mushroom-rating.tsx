'use client';

import { maxRatingHalf, ratingMushrooms } from '@libresca/domain';
import { useTranslations } from 'next-intl';

const cap = 'M2 18C2 8 10 2 20 2s18 6 18 16Z';
/** The left half of the cap, for half a mushroom: no clip paths, so ids never collide. */
const leftHalf = 'M2 18C2 8 10 2 20 2V18Z';

/** One mushroom cap: full, half or empty. */
function Mushroom({ fill }: { fill: 'full' | 'half' | 'empty' }) {
  return (
    <svg viewBox="0 0 40 20" className="h-[1.25rem] w-[2.5rem]" aria-hidden focusable="false">
      <path d={cap} className={fill === 'full' ? 'fill-cap' : 'fill-surface'} />
      {fill === 'half' && <path d={leftHalf} className="fill-cap" />}
      <path d={cap} className="fill-none stroke-border" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * The rating as half to five mushroom caps (DESIGN_SYSTEM.md, MushroomRating), with the
 * value in words for screen readers: "4,5 funghetti".
 */
export function MushroomRating({ ratingHalf }: { ratingHalf: number }) {
  const t = useTranslations('readings.rating');
  return (
    <span role="img" aria-label={t('value', { count: ratingMushrooms(ratingHalf) })} className="inline-flex gap-1">
      {Array.from({ length: maxRatingHalf / 2 }, (_, i) => {
        const filled = ratingHalf - i * 2;
        return <Mushroom key={i} fill={filled >= 2 ? 'full' : filled === 1 ? 'half' : 'empty'} />;
      })}
    </span>
  );
}

/**
 * Picks a rating in half mushrooms. A native range input: arrow keys, swipes and screen
 * readers work out of the box; 0 means no rating, which is not a low rating.
 */
export function RatingInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const t = useTranslations('readings');
  const current = value ?? 0;
  const label = value ? t('rating.value', { count: ratingMushrooms(value) }) : t('rating.none');
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="type-label text-text">
        {t('fields.rating')}
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <MushroomRating ratingHalf={current} />
        <span aria-hidden className="type-small text-text-muted">
          {label}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={maxRatingHalf}
        step={1}
        value={current}
        aria-valuetext={label}
        onChange={(event) => onChange(Number(event.target.value) || null)}
        className="min-h-[2.75rem] w-full max-w-[20rem] accent-accent"
      />
      {value !== null && (
        <button type="button" onClick={() => onChange(null)} className="self-start type-label text-link underline">
          {t('rating.clear')}
        </button>
      )}
    </div>
  );
}
