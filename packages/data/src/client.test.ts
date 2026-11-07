import { describe, expect, it } from 'vitest';

import { createLibrescaClient } from './client';

describe('createLibrescaClient', () => {
  it('creates a client from URL and key', () => {
    const client = createLibrescaClient({ url: 'http://127.0.0.1:54321', key: 'sb_publishable_test' });
    expect(typeof client.from).toBe('function');
  });

  it('rejects a missing URL', () => {
    expect(() => createLibrescaClient({ url: '', key: 'sb_publishable_test' })).toThrow('Missing Supabase URL.');
  });

  it('rejects a missing key', () => {
    expect(() => createLibrescaClient({ url: 'http://127.0.0.1:54321', key: '' })).toThrow('Missing Supabase key.');
  });
});
