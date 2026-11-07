import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'quiet';

const base =
  'inline-flex min-h-[3rem] items-center justify-center gap-2 rounded-pill type-label transition-[transform,box-shadow] duration-(--motion-gentle) ease-gentle motion-reduce:transition-none';

const variants: Record<Variant, string> = {
  // One primary action per screen (DESIGN_SYSTEM.md): ink outline and a solid shadow that sinks on press.
  primary:
    'px-6 border-(length:--border-ink) border-border bg-accent text-on-accent shadow-card active:translate-y-1 active:shadow-none motion-reduce:active:translate-none',
  quiet: 'text-link underline underline-offset-4',
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button {...props} className={`${base} ${variants[variant]} ${className}`} />;
}
