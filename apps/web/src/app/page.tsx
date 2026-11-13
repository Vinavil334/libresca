import { listOwnShelves, listOwnTana } from '@libresca/data';
import { editionCoverUrl } from '@libresca/domain';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { ButtonLink } from '@/components/button';
import { CanopyHeader } from '@/components/canopy-header';
import { MousePlaceholder } from '@/components/mouse-placeholder';
import { AppShell } from '@/components/nav-bar';
import { supabaseEnv } from '@/lib/supabase/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { Tana } from './tana';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('tana');
  return { title: t('title') };
}

/** "Hai già i tuoi libri su Goodreads?": the import arrives with F1.8. */
async function EmptyTana() {
  const t = await getTranslations('tana.empty');
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 px-4 pt-8 pb-8 text-center sm:px-6">
      <MousePlaceholder className="w-[10rem]" />
      <div className="flex flex-col gap-2">
        <h2 className="type-title text-text">{t('title')}</h2>
        <p className="type-body text-text">{t('text')}</p>
      </div>
      <div className="flex w-full flex-col gap-3 sm:w-auto">
        <ButtonLink href="/add?scan=1">{t('scan')}</ButtonLink>
        <ButtonLink href="/add" variant="secondary">
          {t('search')}
        </ButtonLink>
      </div>
      <div className="flex w-full flex-col gap-2 rounded-card border-(length:--border-ink) border-dashed border-border bg-ticket p-4 text-left">
        <p className="type-body-strong text-text">{t('importTitle')}</p>
        <p className="type-body text-text">{t('importText')}</p>
        <ButtonLink href="/import" variant="secondary" className="self-start">
          {t('import')}
        </ButtonLink>
      </div>
    </div>
  );
}

/** The Tana: the books the person owns, reads or keeps on a shelf. Only active accounts get here. */
export default async function TanaPage() {
  const t = await getTranslations('tana');
  const client = await createSupabaseServerClient();
  const [books, shelves] = await Promise.all([listOwnTana(client), listOwnShelves(client)]);
  const { url } = supabaseEnv();
  const entries = books?.map((book) => ({ ...book, coverUrl: editionCoverUrl(book.coverEdition, url) }));
  const shelfLinks = (shelves ?? []).map((shelf) => ({
    id: shelf.id,
    name: shelf.name,
    count: entries?.filter((book) => book.shelfIds.includes(shelf.id)).length ?? 0,
  }));

  return (
    <AppShell>
      <CanopyHeader
        title={t('title')}
        subtitle={entries && entries.length > 0 ? t('subtitle', { count: entries.length }) : t('subtitleEmpty')}
      />
      <main className="flex flex-1 flex-col">
        {!entries ? (
          <p role="alert" className="mx-auto w-full max-w-5xl px-4 pt-6 type-body text-danger sm:px-6">
            {t('error')}
          </p>
        ) : entries.length === 0 ? (
          <EmptyTana />
        ) : (
          <Tana books={entries} shelves={shelfLinks} />
        )}
      </main>
    </AppShell>
  );
}
