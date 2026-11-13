'use client';

import {
  type TanaFilter,
  type TanaOrder,
  matchesTana,
  sortTana,
  tanaCopyFilters,
  tanaCounts,
  tanaOrders,
  tanaReadingFilters,
} from '@libresca/domain';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useMemo, useState, useSyncExternalStore } from 'react';

import { BookCover } from '@/components/book-cover';
import { BookRow, type TanaEntry } from '@/components/book-row';
import { ButtonLink, buttonClasses } from '@/components/button';
import { SearchIcon } from '@/components/icons';
import { RatingNumber } from '@/components/mushroom-rating';
import { StatusPill } from '@/components/status-pill';

type View = 'list' | 'grid';

/** A shelf in the side column of the Tana. */
export interface ShelfLink {
  id: string;
  name: string;
  count: number;
}

const wideQuery = '(min-width: 64rem)';

/** Whether the screen is desktop-wide; `false` on the server and before hydration. */
function useWide(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(wideQuery);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    () => window.matchMedia(wideQuery).matches,
    () => false,
  );
}

/** A filter chip (DESIGN_SYSTEM.md, Chip): pressed in honey, with its count on desktop. */
function Chip({
  label,
  count,
  pressed,
  onToggle,
}: {
  label: string;
  count: number;
  pressed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className={`inline-flex min-h-[2.75rem] items-center gap-2 rounded-pill border-(length:--border-ink) border-border px-4 type-label ${pressed ? 'bg-honey text-on-honey' : 'bg-surface-raised text-text'}`}
    >
      {label}
      <span className="hidden type-small lg:inline">{count}</span>
    </button>
  );
}

/** "Elenco / Griglia" (DESIGN_SYSTEM.md, Segmented): the selected view in inverse. */
function Segmented({ view, onChange }: { view: View; onChange: (view: View) => void }) {
  const t = useTranslations('tana.view');
  return (
    <div
      role="group"
      aria-label={t('label')}
      className="inline-flex rounded-pill border-(length:--border-ink) border-border bg-surface-raised p-1"
    >
      {(['list', 'grid'] as const).map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={view === value}
          onClick={() => onChange(value)}
          className={`min-h-[2.5rem] rounded-pill px-4 type-label ${view === value ? 'bg-inverse text-on-inverse' : 'text-text'}`}
        >
          {t(value)}
        </button>
      ))}
    </div>
  );
}

/** A cover in the grid: title and author below, the status on desktop. */
function BookTile({ book }: { book: TanaEntry }) {
  const format = useFormatter();
  return (
    <li>
      <Link href={`/books/${book.workId}`} className="flex flex-col gap-2 rounded-card">
        <BookCover title={book.title} url={book.coverUrl} size="fill" />
        <span className="flex flex-col">
          <span className="type-title-s line-clamp-3 wrap-break-word text-text">{book.title}</span>
          {book.authors.length > 0 && (
            <span className="type-small line-clamp-2 wrap-break-word text-text-muted">
              {format.list(book.authors, { type: 'conjunction' })}
            </span>
          )}
        </span>
        {(book.status || book.ratingQuarter !== null) && (
          <span className="hidden flex-wrap items-center gap-2 lg:flex">
            {book.status && <StatusPill status={book.status} readCount={book.readCount} />}
            {book.ratingQuarter !== null && <RatingNumber ratingQuarter={book.ratingQuarter} />}
          </span>
        )}
      </Link>
    </li>
  );
}

/**
 * The Tana, or one of its shelves: search, chips and order on the books already loaded,
 * so filtering is instant. "Stai leggendo" comes first when nothing narrows the list.
 * On desktop the books start as a grid of covers, on a phone as a list.
 */
export function Tana({
  books,
  shelves,
  inShelf = false,
}: {
  books: TanaEntry[];
  shelves?: ShelfLink[];
  inShelf?: boolean;
}) {
  const t = useTranslations('tana');
  const tFilters = useTranslations('tana.filters');
  const format = useFormatter();
  const locale = useLocale();
  const wide = useWide();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<TanaFilter[]>([]);
  const [order, setOrder] = useState<TanaOrder>('recent');
  const [chosenView, setChosenView] = useState<View | null>(null);
  const view: View = chosenView ?? (wide || inShelf ? 'grid' : 'list');

  const counts = useMemo(() => tanaCounts(books), [books]);
  const sorted = useMemo(() => sortTana(books, order, locale), [books, order, locale]);
  const shown = useMemo(() => sorted.filter((book) => matchesTana(book, query, filters)), [sorted, query, filters]);
  const narrowed = query.trim() !== '' || filters.length > 0;
  const readingNow = narrowed || inShelf ? [] : sorted.filter((book) => book.status === 'reading');

  const toggle = (filter: TanaFilter) =>
    setFilters((current) => (current.includes(filter) ? current.filter((f) => f !== filter) : [...current, filter]));
  const total = narrowed
    ? filters.length > 0
      ? t('shownOnly', {
          shown: shown.length,
          total: books.length,
          filters: format.list(
            filters.map((filter) => tFilters(filter)),
            { type: 'disjunction' },
          ),
        })
      : t('shown', { shown: shown.length, total: books.length })
    : t('count', { count: books.length });

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 pt-6 pb-8 sm:px-6 lg:grid-cols-[16rem_1fr] lg:items-start">
      <aside className="flex flex-col gap-4">
        <div className="relative">
          <label htmlFor="tana-query" className="sr-only">
            {t('search')}
          </label>
          <SearchIcon className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-text-muted" />
          <input
            id="tana-query"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('search')}
            autoComplete="off"
            enterKeyHint="search"
            className="min-h-[3.25rem] w-full rounded-pill border-(length:--border-ink) border-border bg-surface-raised py-3 pr-4 pl-[3rem] type-body text-text placeholder:text-text-muted"
          />
        </div>
        <div role="group" aria-labelledby="tana-reading-filters" className="flex flex-col gap-2">
          <p id="tana-reading-filters" className="hidden type-label text-text lg:block">
            {t('filterGroups.reading')}
          </p>
          <div className="flex flex-wrap gap-2">
            {tanaReadingFilters.map((filter) => (
              <Chip
                key={filter}
                label={tFilters(filter)}
                count={counts[filter]}
                pressed={filters.includes(filter)}
                onToggle={() => toggle(filter)}
              />
            ))}
          </div>
        </div>
        <div role="group" aria-labelledby="tana-copy-filters" className="hidden flex-col gap-2 lg:flex">
          <p id="tana-copy-filters" className="type-label text-text">
            {t('filterGroups.copies')}
          </p>
          <div className="flex flex-wrap gap-2">
            {tanaCopyFilters.map((filter) => (
              <Chip
                key={filter}
                label={tFilters(filter)}
                count={counts[filter]}
                pressed={filters.includes(filter)}
                onToggle={() => toggle(filter)}
              />
            ))}
          </div>
        </div>
        {shelves && (
          <nav aria-labelledby="tana-shelves" className="hidden flex-col gap-2 lg:flex">
            <p id="tana-shelves" className="type-label text-text">
              {t('filterGroups.shelves')}
            </p>
            <ul className="flex flex-col">
              {shelves.map((shelf) => (
                <li key={shelf.id}>
                  <Link
                    href={`/shelves/${shelf.id}`}
                    className="flex min-h-[2.75rem] items-center justify-between gap-2 type-body text-text"
                  >
                    <span className="wrap-break-word">{shelf.name}</span>
                    <span className="type-small text-text-muted">{shelf.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/shelves" className="type-label text-link underline underline-offset-4">
              {t('allShelves')}
            </Link>
          </nav>
        )}
      </aside>

      <div className="flex min-w-[0] flex-col gap-6">
        {readingNow.length > 0 && (
          <section aria-labelledby="tana-reading-now" className="flex flex-col gap-3">
            <h2 id="tana-reading-now" className="type-heading text-text">
              {t('readingNow')}
            </h2>
            <ul className="grid gap-3 lg:grid-cols-2">
              {readingNow.map((book) => (
                <BookRow key={book.workId} book={book} />
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="tana-all" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <div className="flex flex-col">
              {!inShelf && (
                <h2 id="tana-all" className="type-heading text-text">
                  {t('all')}
                </h2>
              )}
              <p id={inShelf ? 'tana-all' : undefined} role="status" className="type-small text-text-muted">
                {total}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Segmented view={view} onChange={setChosenView} />
              <label htmlFor="tana-order" className="sr-only">
                {t('orderLabel')}
              </label>
              <select
                id="tana-order"
                value={order}
                onChange={(event) => setOrder(event.target.value as TanaOrder)}
                className="min-h-[2.75rem] rounded-pill border-(length:--border-ink) border-border bg-surface-raised px-4 type-label text-text"
              >
                {tanaOrders.map((value) => (
                  <option key={value} value={value}>
                    {t(`orders.${value}`)}
                  </option>
                ))}
              </select>
              {shelves && (
                <Link href="/shelves" className={buttonClasses('quiet', 'min-h-[2.75rem] lg:hidden')}>
                  {t('filterGroups.shelves')}
                </Link>
              )}
            </div>
          </div>

          {shown.length > 0 ? (
            view === 'list' ? (
              <ul className="flex flex-col gap-3">
                {shown.map((book) => (
                  <BookRow key={book.workId} book={book} />
                ))}
              </ul>
            ) : (
              <ul className="grid grid-cols-3 gap-x-3 gap-y-5 lg:grid-cols-[repeat(auto-fill,minmax(8.75rem,1fr))] lg:gap-x-5">
                {shown.map((book) => (
                  <BookTile key={book.workId} book={book} />
                ))}
              </ul>
            )
          ) : (
            books.length > 0 && (
              <NoResults
                query={query.trim()}
                filters={filters}
                onClearFilters={() => setFilters([])}
                onClearQuery={() => setQuery('')}
              />
            )
          )}
        </section>
      </div>
    </div>
  );
}

/** "Nessun libro letto con «lezioni americane»": what was searched, and the ways out. */
function NoResults({
  query,
  filters,
  onClearFilters,
  onClearQuery,
}: {
  query: string;
  filters: TanaFilter[];
  onClearFilters: () => void;
  onClearQuery: () => void;
}) {
  const t = useTranslations('tana.noResults');
  const tFilters = useTranslations('tana.filters');
  const only = filters.length === 1 ? filters[0] : undefined;
  const filter = filters.length === 0 ? 'none' : (only ?? 'many');
  const title = t('title', { filter }) + (query ? t('query', { query }) : '');

  return (
    <div className="flex flex-col gap-3 rounded-card border-(length:--border-ink) border-border bg-surface-raised p-4">
      <p className="type-title text-text">{title}</p>
      <p className="type-body text-text-muted">{only === 'read' ? t('textRead') : t('text')}</p>
      <div className="flex flex-wrap gap-3">
        {filters.length > 0 && (
          <button type="button" onClick={onClearFilters} className={buttonClasses('secondary')}>
            {only ? t('clearFilter', { name: tFilters(only) }) : t('clearFilters')}
          </button>
        )}
        {filters.length === 0 && query && (
          <button type="button" onClick={onClearQuery} className={buttonClasses('secondary')}>
            {t('clearQuery')}
          </button>
        )}
        {query && <ButtonLink href={`/add?q=${encodeURIComponent(query)}`}>{t('searchCatalog')}</ButtonLink>}
      </div>
    </div>
  );
}
