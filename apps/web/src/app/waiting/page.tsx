import { getOwnProfile } from '@libresca/data';
import { getTranslations } from 'next-intl/server';

import { Button } from '@/components/button';
import { signOut } from '@/lib/auth-actions';
import { createSupabaseServerClient, currentUserId } from '@/lib/supabase/server';

/** For accounts that are signed in but not active. The proxy keeps everyone else out. */
export default async function WaitingPage() {
  const t = await getTranslations('waiting');
  const tAuth = await getTranslations('auth');
  const supabase = await createSupabaseServerClient();
  const userId = await currentUserId(supabase);
  const profile = userId ? await getOwnProfile(supabase, userId) : null;
  const state = profile?.status === 'suspended' ? 'suspended' : 'pending';

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 p-6">
      <h1 className="type-display-xl text-text">{t(`${state}.title`)}</h1>
      <p className="type-body text-text">{t(`${state}.body`)}</p>
      {profile && <p className="type-small text-text-muted">{t('signedInAs', { name: profile.display_name })}</p>}
      <form action={signOut}>
        <Button type="submit" variant="quiet">
          {tAuth('signOut')}
        </Button>
      </form>
    </main>
  );
}
