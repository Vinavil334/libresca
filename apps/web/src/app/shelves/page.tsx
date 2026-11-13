import { listOwnShelves, listOwnTana } from '@libresca/data';
import { editionCoverUrl } from '@libresca/domain';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

import { BookCover } from '@/components/book-cover';
import { CanopyHeader } from '@/components/canopy-header';
import { AppShell } from '@/components/nav-bar';
import { supabaseEnv } from '@/lib/supabase/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { NewShelf } from './shelf-forms';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('shelves');
  return { title: t('title') };
}

/** "Scaffali": one card per shelf with up to three covers, its name and how many books it holds. */
export default async function ShelvesPage() {
  const t = await getTranslations('shelves');
  const tTana = await getTranslations('tana');
  const client = await createSupabaseServerClient();
  const [shelves, books] = await Promise.all([listOwnShelves(client), listOwnTana(client)]);
  const { url } = supabaseEnv();

  return (
    <AppShell>
      <CanopyHeader title={t('title')} subtitle={t('subtitle', { count: shelves?.length ?? 0 })} />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pt-6 pb-8 sm:px-6">
        <NewShelf />
        {!shelves || !books ? (
          <p role="alert" className="type-body text-danger">
            {tTana('error')}
          </p>
        ) : shelves.length === 0 ? (
          <p className="type-body text-text">{t('empty')}</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shelves.map((shelf) => {
              const held = books.filter((book) => book.shelfIds.includes(shelf.id));
              return (
                <li key={shelf.id}>
                  <Link
                    href={`/shelves/${shelf.id}`}
                    className="flex items-center gap-4 rounded-card border-(length:--border-ink) border-border bg-surface-raised p-4 shadow-card"
                  >
                    {held.length > 0 && (
                      <span aria-hidden className="flex min-w-[5.5rem]">
                        {held.slice(0, 3).map((book, index) => (
                          <span key={book.workId} className={index > 0 ? '-ml-[2rem]' : ''}>
                            <BookCover title={book.title} url={editionCoverUrl(book.coverEdition, url)} size="small" />
                          </span>
                        ))}
                      </span>
                    )}
                    <span className="flex min-w-[0] flex-col">
                      <span className="type-title-s wrap-break-word text-text">{shelf.name}</span>
                      <span className="type-small text-text-muted">{t('books', { count: held.length })}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <p className="type-small text-text-muted">{t('note')}</p>
      </main>
    </AppShell>
  );
}
