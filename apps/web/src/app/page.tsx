import { getOwnProfile } from '@libresca/data';
import { getTranslations } from 'next-intl/server';

import { Button, ButtonLink } from '@/components/button';
import { signOut } from '@/lib/auth-actions';
import { createSupabaseServerClient, currentUserId } from '@/lib/supabase/server';

/** Only active accounts reach this page: the proxy sends everyone else away. */
export default async function HomePage() {
  const t = await getTranslations('home');
  const tAuth = await getTranslations('auth');
  const supabase = await createSupabaseServerClient();
  const userId = await currentUserId(supabase);
  const profile = userId ? await getOwnProfile(supabase, userId) : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 p-6">
      <h1 className="type-display-xl text-text">{t('title')}</h1>
      <p className="type-heading text-text-muted">{t('intro')}</p>
      {profile && <p className="type-title text-text">{t('greeting', { name: profile.display_name })}</p>}
      <p className="type-body text-text">{t('body')}</p>
      <ButtonLink href="/add" className="self-start">
        {t('addBook')}
      </ButtonLink>
      <form action={signOut}>
        <Button type="submit" variant="quiet">
          {tAuth('signOut')}
        </Button>
      </form>
    </main>
  );
}
