import type { ReactNode } from 'react';

export const inputClasses =
  'min-h-[3rem] w-full rounded-card border-(length:--border-ink) border-border bg-surface-raised px-4 py-2 type-body text-text aria-[invalid=true]:border-danger';

/** A labelled field with an optional source hint ("da SBN") and error text. */
export function FormField({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex flex-wrap items-baseline gap-x-2 type-label text-text">
        {label}
        {hint && <span className="type-small text-text-muted">{hint}</span>}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="type-small text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
