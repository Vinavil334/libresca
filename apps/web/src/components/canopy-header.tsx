import type { ReactNode } from 'react';

/** The mushrooms of the canopy (`docs/design/assets/motivi/funghi.svg`), drawn with theme tokens. */
function Mushrooms({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 150 120" className={className} aria-hidden focusable="false">
      <g className="stroke-border" strokeWidth="3" strokeLinejoin="round">
        <path d="M60 116V84q0-6 6-6h8q6 0 6 6v32Z" className="fill-stem" />
        <path d="M34 82c0-26 16-42 36-42s36 16 36 42Z" className="fill-cap" />
        <path d="M108 116V96q0-4 4-4h6q4 0 4 4v20Z" className="fill-stem" />
        <path d="M94 96c0-16 10-26 21-26s21 10 21 26Z" className="fill-cap" />
        <path d="M20 116v-14q0-4 4-4h4q4 0 4 4v14Z" className="fill-stem" />
        <path d="M10 102c0-12 7-18 16-18s16 6 16 18Z" className="fill-honey" />
      </g>
      <g className="fill-on-accent">
        <circle cx="56" cy="58" r="5" />
        <circle cx="80" cy="52" r="3.5" />
        <circle cx="88" cy="68" r="4" />
        <circle cx="110" cy="80" r="3" />
        <circle cx="124" cy="86" r="2.5" />
      </g>
    </svg>
  );
}

/**
 * The canopy header (DESIGN_SYSTEM.md, CanopyHeader): title, subtitle, mushrooms and the
 * scalloped edge that only canopies have. `low` is the book page's version: no title,
 * just its links, with room for the cover that climbs over it.
 */
export function CanopyHeader({
  title,
  subtitle,
  children,
  low = false,
}: {
  title?: string;
  subtitle?: ReactNode;
  children?: ReactNode;
  low?: boolean;
}) {
  return (
    <header className="relative mb-4 bg-canopy text-on-canopy">
      <div
        className={`mx-auto flex justify-between gap-4 px-4 sm:px-6 ${low ? 'min-h-[7.5rem] max-w-2xl items-start pt-2' : 'max-w-5xl items-end pt-6 pb-2'}`}
      >
        {title && (
          <div className="flex min-w-[0] flex-col gap-1">
            <h1 className="type-display-xl wrap-break-word">{title}</h1>
            {subtitle && <p className="type-body">{subtitle}</p>}
          </div>
        )}
        {children}
        {!low && <Mushrooms className="w-[5.5rem] shrink-0 self-end" />}
      </div>
      <div
        aria-hidden
        className="absolute inset-x-[0] top-full h-[13px] bg-[radial-gradient(circle_at_13px_0,var(--color-canopy)_13px,transparent_13.5px)] bg-size-[26px_13px] bg-repeat-x"
      />
    </header>
  );
}
