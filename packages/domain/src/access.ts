/**
 * Who may see which part of the app (ADR-0006).
 *
 * Authentication only says who someone is; `profiles.status` says whether they may
 * use the app. This module turns that into a routing decision that the web proxy
 * and the future mobile app share.
 */

export const profileStatuses = ['pending', 'active', 'suspended'] as const;
export type ProfileStatus = (typeof profileStatuses)[number];

/** `anonymous`: not signed in. `unknown`: signed in, but the profile could not be read. */
export type Access = 'anonymous' | 'unknown' | ProfileStatus;

/** The three areas of the app, each with its own entry page. */
export type Area = 'sign-in' | 'waiting' | 'app';

export const areaEntry: Record<Area, string> = {
  'sign-in': '/login',
  waiting: '/waiting',
  app: '/',
};

/** Paths reachable whatever the access, such as the OAuth callback. */
const openPaths = ['/auth/'];

export function isProfileStatus(value: unknown): value is ProfileStatus {
  return typeof value === 'string' && (profileStatuses as readonly string[]).includes(value);
}

/** The only area this access may use. A suspended account waits like a pending one. */
export function areaFor(access: Access): Area {
  switch (access) {
    case 'anonymous':
      return 'sign-in';
    case 'active':
      return 'app';
    case 'pending':
    case 'suspended':
    case 'unknown':
      return 'waiting';
  }
}

function areaOfPath(pathname: string): Area | 'open' {
  if (openPaths.some((prefix) => pathname.startsWith(prefix))) return 'open';
  if (pathname === areaEntry['sign-in'] || pathname.startsWith(`${areaEntry['sign-in']}/`)) return 'sign-in';
  if (pathname === areaEntry.waiting || pathname.startsWith(`${areaEntry.waiting}/`)) return 'waiting';
  return 'app';
}

/**
 * Where to send a request, or `null` to let it through.
 * Every path outside the sign-in and waiting pages belongs to the app and needs an active account.
 */
export function redirectFor(access: Access, pathname: string): string | null {
  const requested = areaOfPath(pathname);
  if (requested === 'open') return null;
  const allowed = areaFor(access);
  return requested === allowed ? null : areaEntry[allowed];
}
