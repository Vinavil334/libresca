import { type Access, isProfileStatus } from '@libresca/domain';

import type { LibrescaClient } from './client';
import type { Tables } from './database.types';

export type OwnProfile = Pick<Tables<'profiles'>, 'id' | 'display_name' | 'handle' | 'locale' | 'status'>;

/** The signed-in account's own profile, or `null` when it cannot be read. RLS limits the query to that row. */
export async function getOwnProfile(client: LibrescaClient, userId: string): Promise<OwnProfile | null> {
  const { data, error } = await client
    .from('profiles')
    .select('id, display_name, handle, locale, status')
    .eq('id', userId)
    .maybeSingle();
  if (error) return null;
  return data;
}

/**
 * The access of a request, from the user id in its verified token.
 * A failed read yields `unknown`, which the app treats like a pending account: never wider access.
 */
export async function getAccess(client: LibrescaClient, userId: string | null | undefined): Promise<Access> {
  if (!userId) return 'anonymous';
  const profile = await getOwnProfile(client, userId);
  return profile && isProfileStatus(profile.status) ? profile.status : 'unknown';
}
