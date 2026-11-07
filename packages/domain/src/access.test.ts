import { describe, expect, it } from 'vitest';

import { type Access, areaFor, isProfileStatus, redirectFor } from './access';

describe('areaFor', () => {
  it.each<[Access, string]>([
    ['anonymous', 'sign-in'],
    ['pending', 'waiting'],
    ['suspended', 'waiting'],
    ['unknown', 'waiting'],
    ['active', 'app'],
  ])('%s → %s', (access, area) => {
    expect(areaFor(access)).toBe(area);
  });
});

describe('redirectFor', () => {
  it('sends anonymous visitors to the sign-in page from anywhere in the app', () => {
    expect(redirectFor('anonymous', '/')).toBe('/login');
    expect(redirectFor('anonymous', '/books/123')).toBe('/login');
    expect(redirectFor('anonymous', '/waiting')).toBe('/login');
  });

  it('lets anonymous visitors see the sign-in page', () => {
    expect(redirectFor('anonymous', '/login')).toBeNull();
  });

  it('keeps pending and suspended accounts on the waiting page', () => {
    for (const access of ['pending', 'suspended', 'unknown'] as const) {
      expect(redirectFor(access, '/')).toBe('/waiting');
      expect(redirectFor(access, '/login')).toBe('/waiting');
      expect(redirectFor(access, '/waiting')).toBeNull();
    }
  });

  it('lets active accounts into the app and away from sign-in and waiting', () => {
    expect(redirectFor('active', '/')).toBeNull();
    expect(redirectFor('active', '/books/123')).toBeNull();
    expect(redirectFor('active', '/login')).toBe('/');
    expect(redirectFor('active', '/waiting')).toBe('/');
  });

  it('never redirects the OAuth callback', () => {
    for (const access of ['anonymous', 'pending', 'active'] as const) {
      expect(redirectFor(access, '/auth/callback')).toBeNull();
    }
  });

  it('does not mistake look-alike paths for the sign-in page', () => {
    expect(redirectFor('anonymous', '/loginx')).toBe('/login');
    expect(redirectFor('active', '/waitingroom')).toBeNull();
  });
});

describe('isProfileStatus', () => {
  it('accepts the three statuses and nothing else', () => {
    expect(isProfileStatus('active')).toBe(true);
    expect(isProfileStatus('pending')).toBe(true);
    expect(isProfileStatus('suspended')).toBe(true);
    expect(isProfileStatus('admin')).toBe(false);
    expect(isProfileStatus(null)).toBe(false);
  });
});
