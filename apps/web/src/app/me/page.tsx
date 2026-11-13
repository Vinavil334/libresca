import { getOwnProfile } from '@libresca/data';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { Button, ButtonLink } from '@/components/button';
import { CanopyHeader } from '@/components/canopy-header';
import { AppShell } from '@/components/nav-bar';
import { signOut } from '@/lib/auth-actions';
import { createSupabaseServerClient, currentUserId } from '@/lib/supabase/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('me');
  return { title: t('title') };
}

/** "Tu": for now the account and the way out; the real profile arrives with F2.1. */
export default async function MePage() {
  const t = await getTranslations('me');
  const tAuth = await getTranslations('auth');
  const supabase = await createSupabaseServerClient();
  const userId = await currentUserId(supabase);
  const profile = userId ? await getOwnProfile(supabase, userId) : null;

  return (
    <AppShell>
      <CanopyHeader title={t('title')} subtitle={t('subtitle')} />
      <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pt-6 pb-8 sm:px-6">
        {profile && (
          <p className="type-title wrap-break-word text-text">{t('greeting', { name: profile.display_name })}</p>
        )}
        <p className="type-body text-text-muted">{t('soon')}</p>
        <ButtonLink href="/import" variant="secondary" className="self-start">
          {t('import')}
        </ButtonLink>
        <form action={signOut}>
          <Button type="submit" variant="secondary">
            {tAuth('signOut')}
          </Button>
        </form>
      </main>
    </AppShell>
  );
}
