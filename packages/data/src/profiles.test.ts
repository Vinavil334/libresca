import { describe, expect, it } from 'vitest';

import type { LibrescaClient } from './client';
import { getAccess } from './profiles';

/** Minimal stand-in for the query builder chain used by getOwnProfile. */
function fakeClient(result: { data: unknown; error: unknown }): LibrescaClient {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => result,
  };
  return { from: () => chain } as unknown as LibrescaClient;
}

const userId = '11111111-1111-1111-1111-111111111111';

describe('getAccess', () => {
  it('is anonymous without a user id, without querying', async () => {
    const client = {
      from: () => {
        throw new Error('should not query');
      },
    } as unknown as LibrescaClient;
    expect(await getAccess(client, null)).toBe('anonymous');
    expect(await getAccess(client, undefined)).toBe('anonymous');
  });

  it('returns the profile status', async () => {
    for (const status of ['pending', 'active', 'suspended'] as const) {
      expect(await getAccess(fakeClient({ data: { id: userId, status }, error: null }), userId)).toBe(status);
    }
  });

  it('is unknown when the profile is missing or the query fails', async () => {
    expect(await getAccess(fakeClient({ data: null, error: null }), userId)).toBe('unknown');
    expect(await getAccess(fakeClient({ data: null, error: { message: 'network' } }), userId)).toBe('unknown');
  });

  it('is unknown when the status is not one the app knows', async () => {
    expect(await getAccess(fakeClient({ data: { id: userId, status: 'admin' }, error: null }), userId)).toBe('unknown');
  });
});
