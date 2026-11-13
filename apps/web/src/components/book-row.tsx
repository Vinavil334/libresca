import type { TanaBook } from '@libresca/domain';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';

import { BookCover } from './book-cover';
import { RatingNumber } from './mushroom-rating';
import { StatusPill } from './status-pill';

/** A book of the Tana with the URL of its cover, computed on the server. */
export type TanaEntry = TanaBook & { coverUrl: string | null };

/**
 * A row of the Tana (DESIGN_SYSTEM.md, BookRow): cover, title, author, one status and
 * the rating. A book read but not owned says so next to the author.
 */
export function BookRow({ book }: { book: TanaEntry }) {
  const t = useTranslations('tana');
  const format = useFormatter();
  const authors = book.authors.length > 0 ? format.list(book.authors, { type: 'conjunction' }) : null;
  const byline = [authors, book.copies === 0 ? t('notOwned') : null].filter(Boolean).join(' · ');
  return (
    <li>
      <Link
        href={`/books/${book.workId}`}
        className="flex items-center gap-3 rounded-card border-(length:--border-ink) border-border bg-surface-raised p-3 shadow-card transition-[transform,box-shadow] duration-(--motion-gentle) ease-gentle active:translate-y-1 active:shadow-none motion-reduce:transition-none motion-reduce:active:translate-none"
      >
        <BookCover title={book.title} url={book.coverUrl} size="small" />
        <div className="flex min-w-[0] flex-1 flex-col gap-1">
          <p className="type-title-s wrap-break-word text-text">{book.title}</p>
          {byline && <p className="type-small wrap-break-word text-text-muted">{byline}</p>}
          {(book.status || book.ratingQuarter !== null) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {book.status && <StatusPill status={book.status} readCount={book.readCount} />}
              {book.ratingQuarter !== null && <RatingNumber ratingQuarter={book.ratingQuarter} />}
            </div>
          )}
        </div>
      </Link>
    </li>
  );
}
