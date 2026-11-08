'use client';

import { CloseIcon, PlusIcon } from '@/components/icons';

import { inputClasses } from './form-field';

export interface NameItem {
  key: number;
  name: string;
}

/** Rows for the form state, with stable keys; at least one empty row when `keepOne`. */
export function nameItems(names: string[], keepOne: boolean): NameItem[] {
  return (names.length > 0 || !keepOne ? names : ['']).map((name, key) => ({ key, name }));
}

/** A list of names, one per row, that can grow and shrink: authors, translators. */
export function NameListField({
  id,
  legend,
  hint,
  items,
  onChange,
  itemLabel,
  removeLabel,
  addLabel,
  error,
}: {
  id: string;
  legend: string;
  hint?: string;
  items: NameItem[];
  onChange: (items: NameItem[]) => void;
  itemLabel: (number: number) => string;
  removeLabel: (name: string) => string;
  addLabel: string;
  error?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 flex flex-wrap items-baseline gap-x-2 type-label text-text">
        {legend}
        {hint && <span className="type-small text-text-muted">{hint}</span>}
      </legend>
      {items.map((item, index) => (
        <div key={item.key} className="flex items-center gap-2">
          <label htmlFor={`${id}-${item.key}`} className="sr-only">
            {itemLabel(index + 1)}
          </label>
          <input
            id={`${id}-${item.key}`}
            value={item.name}
            onChange={(event) =>
              onChange(items.map((other) => (other.key === item.key ? { ...other, name: event.target.value } : other)))
            }
            aria-invalid={Boolean(error) || undefined}
            className={inputClasses}
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((other) => other.key !== item.key))}
            aria-label={removeLabel(item.name || itemLabel(index + 1))}
            className="inline-flex size-[2.75rem] shrink-0 items-center justify-center rounded-pill text-text-muted hover:text-text"
          >
            <CloseIcon />
          </button>
        </div>
      ))}
      {error && <p className="type-small text-danger">{error}</p>}
      <button
        type="button"
        onClick={() => onChange([...items, { key: Math.max(-1, ...items.map((item) => item.key)) + 1, name: '' }])}
        className="inline-flex min-h-[2.75rem] items-center gap-1 self-start type-label text-link"
      >
        <PlusIcon />
        {addLabel}
      </button>
    </fieldset>
  );
}
