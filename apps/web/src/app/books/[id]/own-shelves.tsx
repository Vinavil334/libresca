'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useOptimistic, useState, useTransition } from 'react';

import { setBookOnShelf } from '../../shelves/actions';

/**
 * "Sui tuoi scaffali": one chip per shelf, pressed when the book sits on it. A tap puts
 * the book on the shelf or takes it off; the chip changes at once and the page catches up.
 */
export function OwnShelves({
  workId,
  shelves,
  onShelves,
}: {
  workId: string;
  shelves: { id: string; name: string }[];
  onShelves: string[];
}) {
  const t = useTranslations('shelves.onBook');
  const [failed, setFailed] = useState(false);
  const [, startSaving] = useTransition();
  const [current, setCurrent] = useOptimistic(onShelves, (state: string[], change: { shelfId: string; on: boolean }) =>
    change.on ? [...state, change.shelfId] : state.filter((id) => id !== change.shelfId),
  );

  const toggle = (shelfId: string) => {
    const on = !current.includes(shelfId);
    startSaving(async () => {
      setCurrent({ shelfId, on });
      setFailed(!(await setBookOnShelf(shelfId, workId, on)));
    });
  };

  return (
    <section aria-labelledby="shelves-heading" className="flex flex-col gap-3">
      <h2 id="shelves-heading" className="type-heading text-text">
        {t('heading')}
      </h2>
      {shelves.length === 0 ? (
        <p className="type-body text-text">{t('none')}</p>
      ) : (
        <>
          <p className="type-small text-text-muted">{t('hint')}</p>
          <div className="flex flex-wrap gap-2">
            {shelves.map((shelf) => {
              const pressed = current.includes(shelf.id);
              return (
                <button
                  key={shelf.id}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => toggle(shelf.id)}
                  className={`inline-flex min-h-[2.75rem] items-center rounded-pill border-(length:--border-ink) border-border px-4 type-label ${pressed ? 'bg-honey text-on-honey' : 'bg-surface-raised text-text'}`}
                >
                  {shelf.name}
                </button>
              );
            })}
          </div>
        </>
      )}
      {failed && (
        <p role="alert" className="type-small text-danger">
          {t('failed')}
        </p>
      )}
      <Link href="/shelves" className="self-start type-label text-link underline underline-offset-4">
        {t('manage')}
      </Link>
    </section>
  );
}
