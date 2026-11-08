import { getWork } from '@libresca/data';
import { coverUrl } from '@libresca/domain';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import { BookCover } from '@/components/book-cover';
import { ButtonLink } from '@/components/button';
import { BackIcon } from '@/components/icons';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ added?: string; found?: string }> };

const loadWork = cache(async (id: string) => getWork(await createSupabaseServerClient(), id));

function editionCover(edition: { cover_source: string | null; cover_id: string | null }): string | null {
  const source = edition.cover_source;
  if (!edition.cover_id || (source !== 'openlibrary' && source !== 'googlebooks')) return null;
  return coverUrl(source, edition.cover_id);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const work = await loadWork((await params).id);
  return { title: work?.title };
}

/**
 * The essential book card: the work, its authors and its editions. F1.7 turns it into the
 * full card, with "Ce l'hai" and the readings as two separate blocks.
 */
export default async function BookPage({ params, searchParams }: Props) {
  const work = await loadWork((await params).id);
  if (!work) notFound();
  const { added, found } = await searchParams;
  const t = await getTranslations('book');
  const format = await getFormatter();

  const editions = [...work.editions].sort((a, b) => (b.published_year ?? 0) - (a.published_year ?? 0));
  const cover = editions.map(editionCover).find((url) => url !== null);
  const authors = work.authors.map((author) => author.name);

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-8 px-4 py-6 sm:px-6">
      <Link href="/" className="inline-flex min-h-[2.75rem] items-center gap-1 self-start type-label text-link">
        <BackIcon />
        {t('back')}
      </Link>

      {(added || found) && (
        <p
          role="status"
          className="rounded-card border-(length:--border-ink) border-border bg-ticket p-4 type-body text-text"
        >
          {added ? t('added') : t('found')}
        </p>
      )}

      <header className="flex flex-col gap-6 sm:flex-row sm:items-end">
        <BookCover title={work.title} url={cover} size="large" />
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="type-display-l break-words text-text">{work.title}</h1>
          <p className="type-body-strong break-words text-text">
            {authors.length > 0 ? format.list(authors, { type: 'conjunction' }) : t('unknownAuthor')}
          </p>
          {work.first_published_year !== null && (
            <p className="type-small text-text-muted">
              {t('firstPublished', { year: String(work.first_published_year) })}
            </p>
          )}
        </div>
      </header>

      {work.description && (
        <section aria-labelledby="description-heading" className="flex flex-col gap-2">
          <h2 id="description-heading" className="type-heading text-text">
            {t('description')}
          </h2>
          <p className="type-body whitespace-pre-line text-text">{work.description}</p>
        </section>
      )}

      <section aria-labelledby="editions-heading" className="flex flex-col gap-3">
        <h2 id="editions-heading" className="type-heading text-text">
          {t('editions')}
        </h2>
        <ul className="flex flex-col gap-3">
          {editions.map((edition) => (
            <li
              key={edition.id}
              className="flex items-center gap-4 rounded-card border-(length:--border-ink) border-border bg-surface-raised p-3"
            >
              <BookCover title={edition.title ?? work.title} url={editionCover(edition)} size="small" />
              <div className="flex min-w-0 flex-col">
                <p className="type-title-s break-words text-text">{edition.title ?? work.title}</p>
                <p className="type-small break-words text-text-muted">
                  {[
                    edition.publisher,
                    edition.published_year === null ? null : String(edition.published_year),
                    edition.page_count === null ? null : t('pages', { count: edition.page_count }),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <p className="type-small text-text-muted">
                  {edition.isbn13 ? t('isbn', { isbn: edition.isbn13 }) : t('noIsbn')}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <ButtonLink href="/add" variant="secondary" className="self-start">
        {t('addAnother')}
      </ButtonLink>
    </main>
  );
}
