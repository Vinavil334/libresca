import { getOwnShelf, listOwnTana } from '@libresca/data';
import { editionCoverUrl } from '@libresca/domain';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import { CanopyHeader } from '@/components/canopy-header';
import { BackIcon } from '@/components/icons';
import { AppShell } from '@/components/nav-bar';
import { supabaseEnv } from '@/lib/supabase/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { Tana } from '../../tana';
import { EditShelf } from '../shelf-forms';

type Props = { params: Promise<{ id: string }> };

const loadShelf = cache(async (id: string) => getOwnShelf(await createSupabaseServerClient(), id));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const shelf = await loadShelf((await params).id);
  return { title: shelf?.name };
}

/** One shelf as a grid of covers, with the same search and chips as the Tana. */
export default async function ShelfPage({ params }: Props) {
  const shelf = await loadShelf((await params).id);
  if (!shelf) notFound();
  const t = await getTranslations('shelves');
  const tTana = await getTranslations('tana');
  const books = await listOwnTana(await createSupabaseServerClient());
  const { url } = supabaseEnv();
  const held = (books ?? [])
    .filter((book) => book.shelfIds.includes(shelf.id))
    .map((book) => ({ ...book, coverUrl: editionCoverUrl(book.coverEdition, url) }));

  return (
    <AppShell>
      <CanopyHeader title={shelf.name} subtitle={t('shelfSubtitle', { count: held.length })} />
      <main className="flex flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-6">
          <Link href="/shelves" className="inline-flex min-h-[2.75rem] items-center gap-1 type-label text-link">
            <BackIcon />
            {t('all')}
          </Link>
          <span className="text-link">
            <EditShelf shelfId={shelf.id} name={shelf.name} />
          </span>
        </div>
        {!books ? (
          <p role="alert" className="mx-auto w-full max-w-5xl px-4 pt-6 type-body text-danger sm:px-6">
            {tTana('error')}
          </p>
        ) : held.length === 0 ? (
          <p className="mx-auto w-full max-w-5xl px-4 pt-6 type-body text-text sm:px-6">{t('shelfEmpty')}</p>
        ) : (
          <Tana books={held} inShelf />
        )}
      </main>
    </AppShell>
  );
}
