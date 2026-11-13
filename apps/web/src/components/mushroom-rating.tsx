'use client';

import { maxRatingHalf, ratingMushrooms, tapRating } from '@libresca/domain';
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
 * Picks a rating by tapping the mushrooms (SCHERMATE_TANA.md): a tap gives that many,
 * a second tap on the same one takes half off, "Senza voto" clears it. Each mushroom is a
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
          {Array.from({ length: maxRatingHalf / 2 }, (_, i) => {
            const mushroom = i + 1;
            const next = tapRating(value, mushroom);
            const filled = current - i * 2;
            return (
              <button
                key={mushroom}
                type="button"
                aria-label={t('tap', { count: ratingMushrooms(next) })}
                onClick={() => onChange(next)}
                className="grid size-[2.75rem] place-items-center rounded-card"
              >
                <Mushroom fill={filled >= 2 ? 'full' : filled === 1 ? 'half' : 'empty'} />
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
