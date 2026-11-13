import {
  type Edition,
  getWork,
  listOwnCopies,
  listOwnReadings,
  listOwnShelves,
  listShelvesOfWork,
} from '@libresca/data';
import { editionCoverUrl } from '@libresca/domain';
import type { Metadata } from 'next';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import { BookCover } from '@/components/book-cover';
import { ButtonLink } from '@/components/button';
import { CanopyHeader } from '@/components/canopy-header';
import { BackIcon } from '@/components/icons';
import { Mushroom } from '@/components/mushroom-rating';
import { AppShell } from '@/components/nav-bar';
import { StatusPill } from '@/components/status-pill';
import { supabaseEnv } from '@/lib/supabase/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { OwnCopies } from './own-copies';
import { OwnReadings } from './own-readings';
import { OwnShelves } from './own-shelves';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ added?: string; found?: string }> };

const loadWork = cache(async (id: string) => getWork(await createSupabaseServerClient(), id));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const work = await loadWork((await params).id);
  return { title: work?.title };
}

const tile =
  'flex min-h-[4.5rem] flex-col justify-center gap-1 rounded-card border-(length:--border-ink) border-border bg-surface-raised p-3 shadow-card';

/**
 * The book card (SCHERMATE_TANA.md): low canopy, the cover over it with the rating
 * badge, two tiles that sum up copies and readings and lead to their blocks, the
 * blocks themselves, the notes, what the book is about and its editions.
 */
export default async function BookPage({ params, searchParams }: Props) {
  const work = await loadWork((await params).id);
  if (!work) notFound();
  const { added, found } = await searchParams;
  const t = await getTranslations('book');
  const tReadings = await getTranslations('readings');
  const format = await getFormatter();
  const { url: supabaseUrl } = supabaseEnv();

  const editions = [...work.editions].sort((a, b) => (b.published_year ?? 0) - (a.published_year ?? 0));
  const authors = work.authors.map((author) => author.name);
  const locale = await getLocale();
  const languageNames = new Intl.DisplayNames([locale], { type: 'language' });
  const languageName = (code: string | null) => (code ? (languageNames.of(code) ?? code) : null);
  const client = await createSupabaseServerClient();
  const [copies, readings, shelves, onShelves] = await Promise.all([
    listOwnCopies(client, work.id),
    listOwnReadings(client, work.id),
    listOwnShelves(client),
    listShelvesOfWork(client, work.id),
  ]);
  const ownedEditions = new Set(copies.map((copy) => copy.edition_id));
  // The cover of the copy you hold comes first, then any edition with one.
  const cover = [...editions.filter((edition) => ownedEditions.has(edition.id)), ...editions]
    .map((edition) => editionCoverUrl(edition, supabaseUrl))
    .find((url) => url !== null);
  const editionLabel = (edition: Edition) =>
    [
      edition.publisher ?? edition.title ?? work.title,
      edition.published_year === null ? null : String(edition.published_year),
      edition.isbn13 ? t('isbn', { isbn: edition.isbn13 }) : t('noIsbn'),
    ]
      .filter(Boolean)
      .join(' · ');
  const editionChoices = editions.map((edition) => ({ id: edition.id, label: editionLabel(edition) }));

  // Readings come newest first (`sortReadings`).
  const finished = readings.filter((reading) => reading.status === 'read');
  const lastFinished = finished.find((reading) => reading.finished_on !== null)?.finished_on;
  const rating = readings.find((reading) => reading.rating_quarter !== null)?.rating_quarter ?? null;
  const latest = readings[0];
  const notes = readings.flatMap((reading, index) =>
    reading.review ? [{ id: reading.id, number: readings.length - index, review: reading.review }] : [],
  );
  const inTana = copies.length > 0 || readings.length > 0;

  return (
    <AppShell>
      <CanopyHeader low>
        <Link href="/" className="inline-flex min-h-[2.75rem] items-center gap-1 self-start type-label">
          <BackIcon />
          {t('back')}
        </Link>
        <Link
          href={`/books/${work.id}/edit`}
          className="inline-flex min-h-[2.75rem] items-center type-label underline underline-offset-4"
        >
          {t('edit')}
        </Link>
      </CanopyHeader>

      <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 pb-8 sm:px-6">
        <header className="relative flex flex-col gap-4">
          <div className="-mt-[3.5rem] flex items-end gap-4">
            <div className="rounded-cover shadow-lift">
              <BookCover title={work.title} url={cover} size="large" />
            </div>
            {rating !== null && (
              <span className="mb-2 inline-flex items-center gap-1 rounded-pill border-(length:--border-ink) border-border bg-honey py-1 pr-3 pl-2 type-label text-on-honey">
                <Mushroom />
                {tReadings('rating.value', { count: rating / 4 })}
              </span>
            )}
          </div>
          <div className="flex min-w-[0] flex-col gap-2">
            <h1 className="type-display-l wrap-break-word text-text">{work.title}</h1>
            <p className="type-body-strong wrap-break-word text-text">
              {authors.length > 0 ? format.list(authors, { type: 'conjunction' }) : t('unknownAuthor')}
            </p>
            {work.first_published_year !== null && (
              <p className="type-small text-text-muted">
                {t('firstPublished', { year: String(work.first_published_year) })}
              </p>
            )}
          </div>
        </header>

        {(added || found) && (
          <p
            role="status"
            className="rounded-card border-(length:--border-ink) border-border bg-ticket p-4 type-body text-text"
          >
            {added === 'tana' ? t('addedToTana') : added ? t('addedToCatalog') : t('found')}
          </p>
        )}

        {inTana && (
          <nav aria-label={t('summary.label')} className="grid grid-cols-2 gap-3">
            <a href="#copies-heading" className={tile}>
              <span className="type-title-s text-text">
                {copies.length > 0 ? t('summary.copies') : t('summary.copiesNone')}
              </span>
              <span className="type-small text-text-muted">
                {copies.length > 0
                  ? t('summary.copiesDetail', {
                      count: copies.length,
                      lendable: copies.some((copy) => copy.is_lendable) ? 'yes' : 'no',
                    })
                  : t('summary.copiesNoneDetail')}
              </span>
            </a>
            <a href="#readings-heading" className={tile}>
              {finished.length === 0 && latest ? (
                <span className="self-start">
                  <StatusPill status={latest.status} />
                </span>
              ) : (
                <span className="type-title-s text-text">{t('summary.read', { count: finished.length })}</span>
              )}
              {(lastFinished || !latest) && (
                <span className="type-small text-text-muted">
                  {lastFinished
                    ? t('summary.lastRead', {
                        date: format.dateTime(new Date(`${lastFinished}T12:00:00`), {
                          month: 'long',
                          year: 'numeric',
                        }),
                      })
                    : t('summary.noReadings')}
                </span>
              )}
            </a>
          </nav>
        )}

        <OwnCopies workId={work.id} copies={copies} editions={editionChoices} />
        <OwnReadings workId={work.id} title={work.title} cover={cover} readings={readings} editions={editionChoices} />

        <OwnShelves
          workId={work.id}
          shelves={(shelves ?? []).map(({ id, name }) => ({ id, name }))}
          onShelves={onShelves}
        />

        {notes.length > 0 && (
          <section aria-labelledby="notes-heading" className="flex flex-col gap-3">
            <h2 id="notes-heading" className="type-heading text-text">
              {t('notesHeading')}
            </h2>
            {notes.map((note) => (
              <figure key={note.id} className="flex flex-col gap-1">
                <blockquote className="type-note whitespace-pre-line text-text">{note.review}</blockquote>
                {readings.length > 1 && (
                  <figcaption className="type-small text-text-muted">
                    {tReadings('number', { number: note.number })}
                  </figcaption>
                )}
              </figure>
            ))}
          </section>
        )}

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
                <BookCover
                  title={edition.title ?? work.title}
                  url={editionCoverUrl(edition, supabaseUrl)}
                  size="small"
                />
                <div className="flex min-w-[0] flex-col">
                  {ownedEditions.has(edition.id) && (
                    <span className="mb-1 self-start rounded-pill border-(length:--border-ink) border-border bg-canopy-soft px-2 type-small text-text">
                      {t('yourCopy')}
                    </span>
                  )}
                  <p className="type-title-s wrap-break-word text-text">{edition.title ?? work.title}</p>
                  <p className="type-small wrap-break-word text-text-muted">
                    {[
                      edition.publisher,
                      edition.published_year === null ? null : String(edition.published_year),
                      edition.page_count === null ? null : t('pages', { count: edition.page_count }),
                      languageName(edition.language),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {edition.contributors.some((c) => c.role === 'translator') && (
                    <p className="type-small wrap-break-word text-text-muted">
                      {t('translatedBy', {
                        names: format.list(
                          edition.contributors.filter((c) => c.role === 'translator').map((c) => c.name),
                          { type: 'conjunction' },
                        ),
                      })}
                    </p>
                  )}
                  <p className="type-small text-text-muted">
                    {edition.isbn13 ? t('isbn', { isbn: edition.isbn13 }) : t('noIsbn')}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className="flex flex-wrap gap-3">
          {added && <ButtonLink href="/add?scan=1">{t('scanAnother')}</ButtonLink>}
          <ButtonLink href="/add" variant="secondary">
            {t('addAnother')}
          </ButtonLink>
        </div>
      </main>
    </AppShell>
  );
}
