import { getWork, listOwnCopies } from '@libresca/data';
import { editionCoverUrl } from '@libresca/domain';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { BackIcon } from '@/components/icons';
import { supabaseEnv } from '@/lib/supabase/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { EditBook } from './edit-book';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ edition?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('edit');
  return { title: t('title') };
}

/**
 * "Correggi la scheda": the work and one of its editions, as a task screen without the
 * canopy (SCHERMATE_TANA.md). The edition of the user's copy comes first.
 */
export default async function EditBookPage({ params, searchParams }: Props) {
  const client = await createSupabaseServerClient();
  const { id } = await params;
  const [work, copies] = await Promise.all([getWork(client, id), listOwnCopies(client, id)]);
  if (!work || work.editions.length === 0) notFound();
  const t = await getTranslations('edit');
  const { url } = supabaseEnv();

  const owned = new Set(copies.map((copy) => copy.edition_id));
  const editions = [...work.editions].sort(
    (a, b) => Number(owned.has(b.id)) - Number(owned.has(a.id)) || (b.published_year ?? 0) - (a.published_year ?? 0),
  );
  const requested = (await searchParams).edition;
  const edition = editions.find((item) => item.id === requested) ?? editions[0];
  if (!edition) notFound();

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-2">
        <Link
          href={`/books/${work.id}`}
          className="inline-flex min-h-[2.75rem] items-center gap-1 self-start type-label text-link"
        >
          <BackIcon />
          {t('back')}
        </Link>
        <h1 className="type-display-l text-text">{t('title')}</h1>
        <p className="type-body text-text-muted">{t('intro')}</p>
      </header>
      <EditBook
        key={edition.id}
        work={{
          id: work.id,
          title: work.title,
          authors: work.authors.map((author) => ({ id: author.id, name: author.name })),
          firstPublishedYear: work.first_published_year,
          description: work.description,
        }}
        edition={{
          id: edition.id,
          title: edition.title === work.title ? null : edition.title,
          publisher: edition.publisher,
          publishedYear: edition.published_year,
          pageCount: edition.page_count,
          format: edition.format,
          language: edition.language,
          translators: edition.contributors.filter((c) => c.role === 'translator').map((c) => c.name),
          coverUrl: editionCoverUrl(edition, url),
        }}
        editions={editions.map((item) => ({
          id: item.id,
          label: [item.publisher ?? item.title, item.published_year, item.isbn13].filter(Boolean).join(' · '),
        }))}
      />
    </main>
  );
}
