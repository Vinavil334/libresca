import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

import { BackIcon } from '@/components/icons';

import { AddBook } from './add-book';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('add');
  return { title: t('title') };
}

export default async function AddPage({ searchParams }: { searchParams: Promise<{ scan?: string }> }) {
  const t = await getTranslations('add');
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-2">
        <Link href="/" className="inline-flex min-h-[2.75rem] items-center gap-1 self-start type-label text-link">
          <BackIcon />
          {t('back')}
        </Link>
        <h1 className="type-display-xl text-text">{t('title')}</h1>
        <p className="type-body text-text-muted">{t('intro')}</p>
      </header>
      <AddBook startScanning={(await searchParams).scan === '1'} />
    </main>
  );
}
