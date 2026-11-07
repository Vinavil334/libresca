import { getTranslations } from 'next-intl/server';

import { Button } from '@/components/button';
import { signInWithGoogle } from '@/lib/auth-actions';

const errorKeys = ['start', 'callback'] as const;
type ErrorKey = (typeof errorKeys)[number];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const t = await getTranslations('login');
  const { error } = await searchParams;
  const errorKey = errorKeys.find((key): key is ErrorKey => key === error);

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="type-display-xl text-text">{t('title')}</h1>
        <p className="type-heading text-text-muted">{t('intro')}</p>
      </div>
      <p className="type-body text-text">{t('body')}</p>
      {errorKey && (
        <p role="alert" className="type-body text-danger">
          {t(`errors.${errorKey}`)}
        </p>
      )}
      <form action={signInWithGoogle}>
        <Button type="submit" className="w-full sm:w-auto">
          {t('google')}
        </Button>
      </form>
    </main>
  );
}
