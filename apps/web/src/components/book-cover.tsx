import { type CoverTone, coverTone } from '@libresca/domain';

/** `fill` takes the width of its container, as in a grid of covers. */
type Size = 'small' | 'medium' | 'large' | 'fill';

const widths: Record<Size, string> = {
  small: 'w-[3.5rem]',
  medium: 'w-[5.5rem]',
  large: 'w-[8.5rem]',
  fill: 'w-full',
};

const tones: Record<CoverTone, string> = {
  canopy: 'bg-canopy text-on-canopy',
  honey: 'bg-honey text-on-honey',
  inverse: 'bg-inverse text-on-inverse',
  accent: 'bg-accent text-on-accent',
};

/**
 * A 2:3 cover with the ink outline (DESIGN_SYSTEM.md, "Copertine"). Real covers load
 * straight from their source, whole and unfiltered; without one, a generated cover
 * with a mushroom cap and the title, in a tone stable for that title.
 *
 * `alt`: the description when the cover stands for the book; leave it empty when the
 * title is written next to it, so screen readers do not hear it twice.
 */
export function BookCover({
  title,
  url,
  size = 'medium',
  alt = '',
}: {
  title: string;
  url?: string | null;
  size?: Size;
  alt?: string;
}) {
  const frame = `${widths[size]} aspect-[2/3] shrink-0 overflow-hidden rounded-cover border-(length:--border-ink) border-border`;

  if (url) {
    return (
      // Covers come straight from Open Library or Google Books: no Vercel image optimisation (CLAUDE.md).
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={alt} loading="lazy" decoding="async" className={`${frame} bg-surface-raised object-cover`} />
    );
  }

  return (
    <div
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      className={`${frame} ${tones[coverTone(title)]} flex flex-col items-center gap-1 p-1`}
    >
      <svg viewBox="0 0 40 20" className="w-3/5 shrink-0" aria-hidden focusable="false">
        <path d="M2 18C2 8 10 2 20 2s18 6 18 16Z" className="fill-cap stroke-border" strokeWidth="2" />
        <circle cx="14" cy="10" r="2" className="fill-surface" />
        <circle cx="24" cy="7" r="1.5" className="fill-surface" />
      </svg>
      {size !== 'small' && (
        <span className="type-title-s line-clamp-4 w-full text-center wrap-break-word hyphens-auto">{title}</span>
      )}
    </div>
  );
}
