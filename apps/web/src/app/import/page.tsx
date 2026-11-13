import { type StoredCandidate, getImportProgress, getLatestImport, listImportRowsInReview } from '@libresca/data';
import type { GoodreadsBook } from '@libresca/domain';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { CanopyHeader } from '@/components/canopy-header';
import { AppShell } from '@/components/nav-bar';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { ImportGoodreads, type ReviewItem } from './import-goodreads';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('import');
  return { title: t('title') };
}

/**
 * Importing a Goodreads library: the latest import is resumed where it stopped, and its
 * rows in review are listed for the user's choice.
 */
export default async function ImportPage() {
  const t = await getTranslations('import');
  const client = await createSupabaseServerClient();
  const job = await getLatestImport(client);
  const [progress, review] = job
    ? await Promise.all([getImportProgress(client, job.id), listImportRowsInReview(client, job.id)])
    : [null, []];
  const items: ReviewItem[] = review.map((row) => {
    const book = row.raw as unknown as GoodreadsBook;
    return {
      rowId: row.id,
      line: row.line,
      title: book.title,
      author: book.author,
      candidates: (row.candidates ?? []) as unknown as StoredCandidate[],
    };
  });

  return (
    <AppShell>
      <CanopyHeader title={t('title')} subtitle={t('subtitle')} />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-6 pb-8 sm:px-6">
        <ImportGoodreads latest={progress} review={items} />
      </main>
    </AppShell>
  );
}
