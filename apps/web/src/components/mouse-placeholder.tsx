/**
 * The placeholder mouse librarian (`docs/design/assets/motivi/topina-provvisoria.svg`),
 * drawn with the theme tokens so it follows day and night. Decorative only; the real
 * creature arrives with D4.
 */
export function MousePlaceholder({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 130 84" className={className} aria-hidden focusable="false">
      <g className="stroke-border" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
        <path d="M86 82V52q0-6 6-6h6q6 0 6 6v30Z" className="fill-stem" />
        <path d="M60 52c0-26 16-40 35-40s33 14 33 40Z" className="fill-cap" />
        <path d="M14 76C2 74 2 60 12 60" fill="none" />
        <ellipse cx="30" cy="64" rx="18" ry="15" className="fill-mouse" />
        <circle cx="48" cy="46" r="12" className="fill-mouse" />
        <circle cx="42" cy="34" r="6" className="fill-mouse-inner" />
        <circle cx="55" cy="35" r="5" className="fill-mouse-inner" />
        <path d="M36 62q8-4 14 0 6-4 14 0v12q-8-4-14 0-6-4-14 0Z" className="fill-surface-raised" />
        <path d="M50 62v12" fill="none" />
      </g>
      <circle cx="52" cy="45" r="1.8" className="fill-border" />
      <circle cx="60" cy="49" r="2.2" className="fill-mouse-inner" />
      <g className="fill-on-accent">
        <circle cx="82" cy="30" r="4" />
        <circle cx="104" cy="24" r="3" />
        <circle cx="114" cy="40" r="3.5" />
      </g>
    </svg>
  );
}
