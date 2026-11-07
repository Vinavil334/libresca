import { getTranslations } from 'next-intl/server';

export default async function HomePage() {
  const t = await getTranslations('home');
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 p-6">
      <h1 className="type-display-xl text-text">{t('title')}</h1>
      <p className="type-heading text-text-muted">{t('intro')}</p>
      <p className="type-body text-text">{t('body')}</p>
    </main>
  );
}
