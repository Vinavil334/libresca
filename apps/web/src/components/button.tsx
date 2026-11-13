import Link from 'next/link';
import type { ButtonHTMLAttributes, ComponentProps } from 'react';

type Variant = 'primary' | 'secondary' | 'quiet' | 'danger';

const base =
  'inline-flex min-h-[3rem] items-center justify-center gap-2 rounded-pill type-label transition-[transform,box-shadow] duration-(--motion-gentle) ease-gentle motion-reduce:transition-none disabled:cursor-wait disabled:opacity-70';

const pressable =
  'px-6 border-(length:--border-ink) border-border shadow-card active:translate-y-1 active:shadow-none motion-reduce:active:translate-none';

const variants: Record<Variant, string> = {
  // One primary action per screen (DESIGN_SYSTEM.md): ink outline and a solid shadow that sinks on press.
  primary: `${pressable} bg-accent text-on-accent`,
  secondary: `${pressable} bg-surface-raised text-text`,
  quiet: 'text-link underline underline-offset-4',
  // Removing something: a quiet link in the danger colour, always followed by a confirmation.
  danger: 'text-danger underline underline-offset-4',
};

/** The classes of a button, for elements that look like one, such as links. */
export function buttonClasses(variant: Variant = 'primary', className = ''): string {
  return `${base} ${variants[variant]} ${className}`;
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button {...props} className={buttonClasses(variant, className)} />;
}

/** A link that looks like a button: navigation, not an action. */
export function ButtonLink({
  variant = 'primary',
  className = '',
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link {...props} className={buttonClasses(variant, className)} />;
}
